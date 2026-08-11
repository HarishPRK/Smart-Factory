import type {
  AgentDecision,
  AgentActivity,
  AgentQuestionResponse,
  BootstrapResponse,
  DecisionReviewRequest,
  EventPage,
  IncidentRecord,
  ObservationBatch,
  OperationsTask,
  PresenceFrame,
  PropertyHistoryResponse,
  SensorBinding,
  SimulatorControlRequest,
  SimulatorState,
  StoreEventEnvelope,
  StoreManifest,
  TelemetrySourceStatus,
  TwinSnapshot,
  TwinPatch,
} from "../../packages/agentic-store-contracts/src/index.js";
import {
  AgentOrchestrator,
  AgenticStoreConflictError,
  AgenticStoreNotFoundError,
  type StoreActionTarget,
} from "./application/agent-orchestrator.js";
import { createAgentProvider } from "./application/agent-provider.js";
import { IncidentService } from "./application/incident-service.js";
import {
  ObservationService,
  type ObservationIngestResult,
  type ObservationSource,
} from "./application/observation-service.js";
import { loadAgenticStoreConfig, type AgenticStoreConfig } from "./config.js";
import { validateStoreConfiguration } from "./domain/manifest-validation.js";
import { createSensorBindings, createStoreManifest } from "./domain/store-catalog.js";
import { loadSensorBindingsFile } from "./infrastructure/load-bindings.js";
import {
  SqliteAgenticStore,
  type ListStoreEventsOptions,
} from "./infrastructure/sqlite-store.js";
import { StoreEventBus, type StoreEventListener } from "./infrastructure/store-event-bus.js";
import {
  createStoreSimulator,
  STORE_SCENARIO_IDS,
  type StoreScenarioId,
  type StoreSimulator,
} from "./simulation/store-simulator.js";

const STREAM_HEARTBEAT_SECONDS = 15;
const CLEANUP_INTERVAL_MS = 60_000;
const FRESHNESS_SWEEP_INTERVAL_MS = 1_000;

export interface AgenticStoreRuntimeOptions {
  config?: AgenticStoreConfig;
  manifest?: StoreManifest;
  bindings?: SensorBinding[];
  simulator?: StoreSimulator;
}

export interface AgenticStoreHealth {
  ok: true;
  storeId: string;
  mode: "local-first";
  simulation: boolean;
  simulatorRunning: boolean;
  latestSequence: number;
  snapshotVersion: number;
  activeIncidents: number;
  aiProvider: "deterministic" | "openai-compatible";
}

/**
 * Composition root for the local Agentic Store backend.
 *
 * All inputs, including the simulator and future PLC adapters, enter through
 * ObservationService. Consumers see one semantic event stream regardless of
 * where the readings originated.
 */
export class AgenticStoreRuntime {
  readonly config: AgenticStoreConfig;
  readonly manifest: StoreManifest;
  readonly bindings: SensorBinding[];
  readonly store: SqliteAgenticStore;
  readonly bus: StoreEventBus;
  readonly simulator: StoreSimulator;

  private readonly observations: ObservationService;
  private readonly orchestrator: AgentOrchestrator;
  private readonly incidents: IncidentService;
  private readonly externallyOwnedEntities: Set<string>;
  private readonly unsubscribeSimulator: Array<() => void> = [];
  private cleanupTimer?: NodeJS.Timeout;
  private freshnessTimer?: NodeJS.Timeout;
  private lastPresencePersistedAt = 0;
  private suppressIncidentEvaluation = false;
  private started = false;
  private disposed = false;

  constructor(options: AgenticStoreRuntimeOptions = {}) {
    this.config = options.config ?? loadAgenticStoreConfig();
    this.manifest = options.manifest ?? createStoreManifest(this.config.storeId);
    if (options.bindings) {
      this.bindings = options.bindings;
    } else {
      const externalBindings = loadSensorBindingsFile(this.config.bindingsPath);
      const externallyOwnedProperties = new Set(
        externalBindings.map((binding) => bindingTarget(binding)),
      );
      // A semantic property has one authoritative source. Real bindings take
      // ownership property-by-property while the simulator continues to fill
      // uninstrumented parts of the store.
      this.bindings = [
        ...createSensorBindings(this.config.storeId).filter(
          (binding) => !externallyOwnedProperties.has(bindingTarget(binding)),
        ),
        ...externalBindings,
      ];
    }
    validateStoreConfiguration(this.manifest, this.bindings);

    this.store = new SqliteAgenticStore(this.config.databasePath);
    this.bus = new StoreEventBus();
    this.simulator = options.simulator ?? createStoreSimulator({
      storeId: this.config.storeId,
      tickIntervalMs: this.config.simulationTickMs,
    });
    this.observations = new ObservationService(this.store, this.bus, this.bindings);
    this.externallyOwnedEntities = new Set(
      this.bindings
        .filter((binding) => binding.sourceId !== this.simulator.sourceId)
        .map((binding) => binding.entityId),
    );
    const actionTarget: StoreActionTarget = {
      applyAction: (action) => {
        if (action.kind === "CREATE_TASK") {
          return {
            accepted: true,
            message: "Task recorded in the local operations queue.",
            executor: "LOCAL_WORKFLOW",
          };
        }
        const taskBacked = [
          "DISPATCH_RESTOCK",
          "REQUEST_MAINTENANCE",
          "CLEAR_AISLE",
        ].includes(action.kind);
        if (this.externallyOwnedEntities.has(action.targetEntityId)) {
          return taskBacked
            ? {
                accepted: true,
                message:
                  "Task dispatched locally; recovery must be confirmed by authoritative PLC evidence.",
                executor: "LOCAL_WORKFLOW",
              }
            : {
                accepted: false,
                message:
                  "No external action adapter is configured for this PLC-owned entity.",
                executor: "LOCAL_WORKFLOW",
              };
        }
        if (!this.config.simulationEnabled) {
          return taskBacked
            ? {
                accepted: true,
                message: "Task dispatched to the local operations queue.",
                executor: "LOCAL_WORKFLOW",
              }
            : {
                accepted: false,
                message: "No physical or digital action adapter is enabled.",
                executor: "LOCAL_WORKFLOW",
              };
        }
        const result = this.simulator.applyAction(action);
        if (!result.accepted && taskBacked) {
          return {
            accepted: true,
            message: "Task dispatched to the local operations queue.",
            executor: "LOCAL_WORKFLOW",
          };
        }
        return {
          accepted: result.accepted,
          message: result.message,
          executor: "SIMULATOR",
        };
      },
    };
    this.orchestrator = new AgentOrchestrator(
      this.config.storeId,
      this.store,
      this.bus,
      createAgentProvider(this.config),
      actionTarget,
    );
    this.orchestrator.reconcileInterruptedWorkflows();
    this.incidents = new IncidentService(
      this.config.storeId,
      this.store,
      this.bus,
      this.orchestrator,
    );

    this.unsubscribeSimulator.push(
      this.simulator.onObservationBatch((batch) => this.handleSimulatorBatch(batch)),
      this.simulator.onPresenceFrame((frame) => this.persistPresenceFrame(frame)),
      this.simulator.onStateChange((state) => this.persistSimulatorState(state)),
      this.bus.subscribe(this.config.storeId, (event) => {
        if (event.type === "task.updated") this.syncSimulatorTaskCount();
      }),
    );
    this.syncSimulatorTaskCount();
  }

  start(): void {
    this.assertUsable();
    if (this.started) return;
    this.started = true;
    this.pruneHistory();
    this.cleanupTimer = setInterval(() => this.pruneHistory(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
    this.freshnessTimer = setInterval(
      () => this.sweepFreshness(),
      FRESHNESS_SWEEP_INTERVAL_MS,
    );
    this.freshnessTimer.unref();
    this.incidents.resumeUnplannedIncidents();

    if (this.config.simulationEnabled) {
      // Prime the projection so bootstrap is useful immediately after startup.
      this.simulator.advanceBy(1_000);
      this.simulator.start();
    }
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.freshnessTimer) clearInterval(this.freshnessTimer);
    this.cleanupTimer = undefined;
    this.freshnessTimer = undefined;
    this.simulator.pause();
    await this.incidents.drain();
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    await this.stop();
    this.disposed = true;
    for (const unsubscribe of this.unsubscribeSimulator.splice(0)) unsubscribe();
    this.simulator.dispose();
    this.bus.clear();
    this.store.close();
  }

  health(): AgenticStoreHealth {
    const snapshot = this.store.getSnapshot(this.config.storeId);
    return {
      ok: true,
      storeId: this.config.storeId,
      mode: "local-first",
      simulation: this.config.simulationEnabled,
      simulatorRunning: this.simulator.getState().running,
      latestSequence: this.store.latestSequence(this.config.storeId),
      snapshotVersion: snapshot.version,
      activeIncidents: this.store.listIncidents(
        this.config.storeId,
        ["OPEN", "ACKNOWLEDGED"],
      ).length,
      aiProvider: this.aiProviderName(),
    };
  }

  bootstrap(streamUrl = "/api/agentic-store/stream"): BootstrapResponse {
    const latestSequence = this.store.latestSequence(this.config.storeId);
    const separator = streamUrl.includes("?") ? "&" : "?";
    return {
      schemaVersion: this.manifest.schemaVersion,
      serverTime: new Date().toISOString(),
      manifest: this.manifest,
      snapshot: this.snapshot(),
      incidents: this.listIncidents(),
      decisions: this.listDecisions(),
      tasks: this.listTasks(),
      activities: this.listActivities(),
      sources: this.sourceStatuses(),
      simulator: this.simulator.getState(),
      capabilities: {
        simulation: this.config.simulationEnabled,
        simulationScenarios: this.config.simulationEnabled ? [...STORE_SCENARIO_IDS] : [],
        externalIngest: true,
        replay: true,
        approvals: true,
        agentQuestion: true,
        mutationAuthRequired: Boolean(this.config.apiToken),
        localAi: this.aiProviderName() === "openai-compatible",
        aiProvider: this.aiProviderName(),
      },
      stream: {
        url: `${streamUrl}${separator}after=${latestSequence}`,
        latestSequence,
        heartbeatSeconds: STREAM_HEARTBEAT_SECONDS,
      },
    };
  }

  ingest(batch: ObservationBatch, source: ObservationSource = "PLC"): ObservationIngestResult {
    this.assertStore(batch.storeId);
    const result = this.observations.ingest(batch, source);
    if (result.accepted > 0 && !this.suppressIncidentEvaluation) this.incidents.evaluate();
    return result;
  }

  snapshot(): TwinSnapshot {
    return this.store.getSnapshot(this.config.storeId);
  }

  listEvents(options: Omit<ListStoreEventsOptions, "storeId"> = {}): EventPage {
    return this.store.listEvents({ ...options, storeId: this.config.storeId });
  }

  history(
    entityId: string,
    property: string,
    from: string,
    to: string,
    limit?: number,
  ): PropertyHistoryResponse {
    return this.store.getPropertyHistory(
      this.config.storeId,
      entityId,
      property,
      from,
      to,
      limit,
    );
  }

  listIncidents(): IncidentRecord[] {
    return this.store.listIncidents(this.config.storeId);
  }

  listDecisions(limit?: number): AgentDecision[] {
    return this.store.listDecisions(this.config.storeId, limit);
  }

  listTasks(): OperationsTask[] {
    return this.store.listTasks(this.config.storeId);
  }

  listActivities(limit = 100): AgentActivity[] {
    return this.store
      .listRecentEvents(this.config.storeId, ["agent.activity"], limit)
      .map((event) => event.data as unknown as AgentActivity);
  }

  sourceStatuses(now = Date.now()): TelemetrySourceStatus[] {
    const snapshot = this.snapshot();
    const bindingsBySource = new Map<string, SensorBinding[]>();
    for (const binding of this.bindings) {
      const current = bindingsBySource.get(binding.sourceId) ?? [];
      current.push(binding);
      bindingsBySource.set(binding.sourceId, current);
    }
    return [...bindingsBySource.entries()].map(([sourceId, bindings]) => {
      const expectedTargets = new Set(bindings.map(bindingTarget));
      const properties = snapshot.properties.filter(
        (property) => property.sourceId === sourceId
          && expectedTargets.has(
            `${this.config.storeId}\u0000${property.entityId}\u0000${property.property}`,
          ),
      );
      const lastSeenAt = properties
        .map((property) => property.receivedAt)
        .sort()
        .at(-1);
      const kind = sourceId === this.simulator.sourceId ? "SIMULATOR" : "PLC";
      let status: TelemetrySourceStatus["status"];
      if (kind === "SIMULATOR" && !this.simulator.getState().running) {
        status = "PAUSED";
      } else if (!lastSeenAt) {
        status = "WAITING";
      } else if (properties.length < bindings.length) {
        status = "STALE";
      } else {
        const stale = properties.some((property) => {
          const binding = bindings.find(
            (candidate) => candidate.entityId === property.entityId
              && candidate.property === property.property,
          );
          return now - Date.parse(property.receivedAt) > (binding?.staleAfterMs ?? 30_000);
        });
        status = stale ? "STALE" : "LIVE";
      }
      return {
        sourceId,
        kind,
        status,
        configuredBindings: bindings.length,
        reportingProperties: properties.length,
        lastSeenAt,
      };
    });
  }

  sweepFreshness(now = new Date()): number {
    const snapshot = this.snapshot();
    const bindings = new Map(
      this.bindings.map((binding) => [bindingTarget(binding), binding]),
    );
    const stale = snapshot.properties.filter((property) => {
      if (property.quality === "STALE") return false;
      const binding = bindings.get(
        `${this.config.storeId}\u0000${property.entityId}\u0000${property.property}`,
      );
      if (!binding || binding.sourceId !== property.sourceId) return true;
      if (
        binding.sourceId === this.simulator.sourceId
        && !this.simulator.getState().running
      ) return false;
      const receivedAt = Date.parse(property.receivedAt);
      return !Number.isFinite(receivedAt)
        || now.getTime() - receivedAt > (binding.staleAfterMs ?? 30_000);
    });
    if (stale.length === 0) return 0;

    let event: StoreEventEnvelope<TwinPatch> | undefined;
    let changed = 0;
    this.store.transaction(() => {
      event = this.store.appendEvent<TwinPatch>({
        storeId: this.config.storeId,
        type: "twin.patch",
        source: "SYSTEM",
        occurredAt: now.toISOString(),
        data: {
          changes: stale.map((property) => ({
            entityId: property.entityId,
            property: property.property,
            value: property.value,
            unit: property.unit,
            quality: "STALE",
            sampledAt: property.sampledAt,
            receivedAt: property.receivedAt,
            sourceId: property.sourceId,
          })),
        },
      });
      changed = this.store.markPropertiesStale(
        this.config.storeId,
        stale.map((property) => ({
          entityId: property.entityId,
          property: property.property,
        })),
        event.sequence,
      );
    });
    if (event && changed > 0) {
      this.bus.publish(event);
      this.incidents.evaluate();
    }
    return changed;
  }

  acknowledgeIncident(
    incidentId: string,
    review: DecisionReviewRequest,
  ): IncidentRecord {
    if (!this.store.getIncident(incidentId)) {
      throw new AgenticStoreNotFoundError(`Incident ${incidentId} was not found.`);
    }
    return this.incidents.acknowledge(incidentId, review);
  }

  reviewDecision(
    decisionId: string,
    review: DecisionReviewRequest,
    approved: boolean,
  ): Promise<AgentDecision> {
    return this.orchestrator.reviewDecision(decisionId, review, approved);
  }

  askAgent(question: string, entityIds?: string[]): Promise<AgentQuestionResponse> {
    return this.orchestrator.answerQuestion(question, entityIds);
  }

  controlSimulator(request: SimulatorControlRequest): SimulatorState {
    this.assertSimulationEnabled();
    if (request.action === "RESET") {
      const reason = "the local simulator was reset to a clean baseline";
      const resetContext = this.incidents.prepareSourceReset(this.simulator.sourceId);
      // Reset rewinds virtual time and starts a new source session. Remove only
      // simulator-owned current values so its time-zero batch can establish the
      // new session without being rejected behind the previous virtual clock.
      this.store.clearCurrentPropertiesBySource(
        this.config.storeId,
        this.simulator.sourceId,
      );
      // RESET leaves the simulator paused, so its immediate empty/baseline
      // presence frame may be the only chance to clear shoppers from clients.
      this.lastPresencePersistedAt = Number.NEGATIVE_INFINITY;
      this.suppressIncidentEvaluation = true;
      try {
        const state = this.simulator.control(request);
        this.suppressIncidentEvaluation = false;
        this.incidents.completeSourceReset(resetContext, reason);
        this.incidents.evaluate();
        return state;
      } finally {
        this.suppressIncidentEvaluation = false;
      }
    }
    return this.simulator.control(request);
  }

  startScenario(id: string, durationSeconds?: number): SimulatorState {
    this.assertSimulationEnabled();
    if (!(STORE_SCENARIO_IDS as readonly string[]).includes(id)) {
      throw new RangeError(`Unknown store scenario: ${id}`);
    }
    const state = this.simulator.startScenario(id as StoreScenarioId, durationSeconds);
    if (!state.running) return this.simulator.start(state.speed);
    return state;
  }

  stopScenario(): SimulatorState {
    this.assertSimulationEnabled();
    return this.simulator.stopScenario();
  }

  subscribe(listener: StoreEventListener): () => void {
    return this.bus.subscribe(this.config.storeId, listener);
  }

  latestSequence(): number {
    return this.store.latestSequence(this.config.storeId);
  }

  async drain(): Promise<void> {
    await this.incidents.drain();
  }

  private handleSimulatorBatch(batch: ObservationBatch): void {
    try {
      this.ingest(batch, "SIMULATOR");
    } catch (error) {
      console.error("[agentic-store] simulator observation failed", error);
    }
  }

  private persistPresenceFrame(frame: PresenceFrame): void {
    try {
      const now = Date.now();
      if (now - this.lastPresencePersistedAt < 1_000) return;
      this.lastPresencePersistedAt = now;
      const event = this.store.appendEvent<PresenceFrame>({
        storeId: frame.storeId,
        type: "presence.frame",
        source: "SIMULATOR",
        occurredAt: frame.sampledAt,
        data: frame,
      });
      this.bus.publish(event);
    } catch (error) {
      console.error("[agentic-store] presence frame failed", error);
    }
  }

  private persistSimulatorState(state: SimulatorState): void {
    try {
      const event = this.store.appendEvent<SimulatorState>({
        storeId: this.config.storeId,
        type: "simulator.status",
        source: "SIMULATOR",
        data: state,
      });
      this.bus.publish(event);
    } catch (error) {
      console.error("[agentic-store] simulator state failed", error);
    }
  }

  private syncSimulatorTaskCount(): void {
    const open = this.store.listTasks(
      this.config.storeId,
      ["OPEN", "IN_PROGRESS"],
    ).length;
    this.simulator.setOpenOperationsTasks(open);
  }

  private pruneHistory(): void {
    const historyCutoff = new Date(
      Date.now() - this.config.historyRetentionHours * 60 * 60 * 1_000,
    ).toISOString();
    const eventCutoff = new Date(
      Date.now() - (this.config.eventRetentionHours ?? 24) * 60 * 60 * 1_000,
    ).toISOString();
    const presenceCutoff = new Date(
      Date.now() - (this.config.presenceRetentionMinutes ?? 5) * 60 * 1_000,
    ).toISOString();
    this.store.transaction(() => {
      this.store.pruneHistory(historyCutoff);
      this.store.pruneEvents(this.config.storeId, eventCutoff);
      this.store.pruneEventsByType(
        this.config.storeId,
        "presence.frame",
        presenceCutoff,
      );
    });
  }

  private aiProviderName(): "deterministic" | "openai-compatible" {
    return this.config.localAiBaseUrl && this.config.localAiModel
      ? "openai-compatible"
      : "deterministic";
  }

  private assertStore(storeId: string): void {
    if (storeId !== this.config.storeId) {
      throw new RangeError(
        `Observation storeId ${storeId} does not match runtime store ${this.config.storeId}.`,
      );
    }
  }

  private assertSimulationEnabled(): void {
    if (!this.config.simulationEnabled) {
      throw new AgenticStoreConflictError("Store simulation is disabled.");
    }
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error("AgenticStoreRuntime has been disposed.");
  }
}

export function createAgenticStoreRuntime(
  options: AgenticStoreRuntimeOptions = {},
): AgenticStoreRuntime {
  return new AgenticStoreRuntime(options);
}

export type AgenticStoreLiveEvent = StoreEventEnvelope<unknown>;

function bindingTarget(binding: SensorBinding): string {
  return `${binding.storeId}\u0000${binding.entityId}\u0000${binding.property}`;
}
