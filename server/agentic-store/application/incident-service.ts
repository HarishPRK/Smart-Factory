import { randomUUID } from "node:crypto";
import type {
  DecisionReviewRequest,
  IncidentRecord,
} from "../../../packages/agentic-store-contracts/src/index.js";
import {
  IncidentRuleEngine,
  type IncidentCandidate,
} from "../domain/incident-rule-engine.js";
import { SqliteAgenticStore } from "../infrastructure/sqlite-store.js";
import { StoreEventBus } from "../infrastructure/store-event-bus.js";
import type { AgentOrchestrator } from "./agent-orchestrator.js";

type Clock = () => Date;
type IdGenerator = () => string;

export interface IncidentEvaluationResult {
  opened: IncidentRecord[];
  resolved: IncidentRecord[];
}

export interface SourceResetContext {
  sourceId: string;
  causalIncidentIds: string[];
}

export class IncidentService {
  private readonly pendingAgentWork = new Set<Promise<unknown>>();

  constructor(
    private readonly storeId: string,
    private readonly store: SqliteAgenticStore,
    private readonly bus: StoreEventBus,
    private readonly orchestrator: AgentOrchestrator,
    private readonly engine = new IncidentRuleEngine(),
    private readonly clock: Clock = () => new Date(),
    private readonly id: IdGenerator = randomUUID,
  ) {}

  evaluate(): IncidentEvaluationResult {
    const snapshot = this.store.getSnapshot(this.storeId);
    const active = this.store.listIncidents(this.storeId, ["OPEN", "ACKNOWLEDGED"]);
    const now = this.clock();
    const result = this.engine.evaluate(snapshot, active, now.getTime());
    const opened = result.open.map((candidate) => this.openIncident(candidate, now.toISOString()));
    const resolved = result.resolve.map((incident) => this.resolveIncident(incident, now.toISOString()));

    for (const incident of opened) {
      this.track(this.orchestrator.handleIncidentOpened(incident));
    }
    for (const incident of resolved) {
      this.orchestrator.handleIncidentResolved(incident);
    }
    return { opened, resolved };
  }

  acknowledge(incidentId: string, review: DecisionReviewRequest): IncidentRecord {
    const incident = this.store.getIncident(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} was not found.`);
    if (incident.status === "RESOLVED" || incident.status === "ACKNOWLEDGED") return incident;
    const occurredAt = this.clock().toISOString();
    const updated: IncidentRecord = {
      ...incident,
      status: "ACKNOWLEDGED",
      updatedAt: occurredAt,
      acknowledgement: {
        actorId: review.actorId,
        occurredAt,
        note: review.note,
      },
    };
    this.persist(updated, "incident.updated", "OPERATOR");
    return updated;
  }

  async drain(): Promise<void> {
    while (this.pendingAgentWork.size > 0) {
      await Promise.allSettled([...this.pendingAgentWork]);
    }
  }

  resumeUnplannedIncidents(): number {
    const incidents = this.store
      .listIncidents(this.storeId, ["OPEN", "ACKNOWLEDGED"])
      .filter((incident) => !incident.decisionId);
    for (const incident of incidents) {
      this.track(this.orchestrator.handleIncidentOpened(incident));
    }
    return incidents.length;
  }

  reset(): void {
    this.engine.reset();
  }

  prepareSourceReset(sourceId: string): SourceResetContext {
    const snapshot = this.store.getSnapshot(this.storeId);
    const causalIncidentIds = this.store
      .listIncidents(this.storeId, ["OPEN", "ACKNOWLEDGED"])
      .filter((incident) =>
        this.engine.currentTriggerSourceIds(snapshot, incident).includes(sourceId),
      )
      .map((incident) => incident.id);
    this.engine.resetForSource(snapshot, sourceId);
    return { sourceId, causalIncidentIds };
  }

  completeSourceReset(context: SourceResetContext, reason: string): IncidentRecord[] {
    const now = this.clock().toISOString();
    const snapshot = this.store.getSnapshot(this.storeId);
    const causalIncidentIds = new Set(context.causalIncidentIds);
    const affected = this.store
      .listIncidents(this.storeId, ["OPEN", "ACKNOWLEDGED"])
      .filter(
        (incident) =>
          causalIncidentIds.has(incident.id) &&
          !this.engine.isIncidentConditionActive(snapshot, incident),
      );

    return affected.map((incident) => {
      const resolved: IncidentRecord = {
        ...incident,
        status: "RESOLVED",
        updatedAt: now,
        resolvedAt: now,
        summary: `${incident.summary} Closed without verification because ${reason}.`,
      };
      this.persist(resolved, "incident.resolved", "SYSTEM");
      this.orchestrator.handleIncidentSuperseded(resolved, reason);
      return resolved;
    });
  }

  private openIncident(candidate: IncidentCandidate, now: string): IncidentRecord {
    const existing = this.store.getActiveIncident(
      this.storeId,
      candidate.kind,
      candidate.entityId,
    );
    if (existing) return existing;
    const incident: IncidentRecord = {
      id: this.id(),
      storeId: this.storeId,
      kind: candidate.kind,
      severity: candidate.severity,
      entityId: candidate.entityId,
      title: candidate.title,
      summary: candidate.summary,
      status: "OPEN",
      openedAt: now,
      updatedAt: now,
      evidence: candidate.evidence,
      triggerSourceIds: candidate.triggerSourceIds,
    };
    this.persist(incident, "incident.opened", "SYSTEM");
    return incident;
  }

  private resolveIncident(incident: IncidentRecord, now: string): IncidentRecord {
    const latest = this.store.getIncident(incident.id) ?? incident;
    const resolved: IncidentRecord = {
      ...latest,
      status: "RESOLVED",
      updatedAt: now,
      resolvedAt: now,
    };
    this.persist(resolved, "incident.resolved", "SYSTEM");
    return resolved;
  }

  private persist(
    incident: IncidentRecord,
    type: "incident.opened" | "incident.updated" | "incident.resolved",
    source: "SYSTEM" | "OPERATOR",
  ): void {
    let event;
    this.store.transaction(() => {
      this.store.upsertIncident(incident);
      event = this.store.appendEvent<IncidentRecord>({
        storeId: incident.storeId,
        type,
        entityId: incident.entityId,
        correlationId: incident.id,
        source,
        occurredAt: incident.updatedAt,
        data: incident,
      });
    });
    if (event) this.bus.publish(event);
  }

  private track(work: Promise<unknown>): void {
    const guarded = work.catch((error: unknown) => {
      // The telemetry loop must remain alive if an optional AI provider fails.
      // Provider-level fallback handles expected failures; this is the final
      // containment boundary for unexpected orchestration errors.
      console.error("[agentic-store] incident orchestration failed", error);
    });
    this.pendingAgentWork.add(guarded);
    void guarded.finally(() => this.pendingAgentWork.delete(guarded));
  }
}
