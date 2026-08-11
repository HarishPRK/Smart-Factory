// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AGENTIC_STORE_SCHEMA_VERSION,
  type ObservationBatch,
  type SensorBinding,
} from "../../packages/agentic-store-contracts/src/index.js";
import type { AgenticStoreConfig } from "./config.js";
import { createSensorBindings } from "./domain/store-catalog.js";
import { createAgenticStoreRuntime, type AgenticStoreRuntime } from "./runtime.js";
import { createStoreSimulator } from "./simulation/store-simulator.js";

const STORE_ID = "store-runtime-test";
const WALL_CLOCK_START = Date.parse("2026-08-10T12:00:00.000Z");

function config(simulationEnabled: boolean): AgenticStoreConfig {
  return {
    storeId: STORE_ID,
    databasePath: ":memory:",
    simulationEnabled,
    simulationTickMs: 5_000,
    historyRetentionHours: 72,
    localAiAllowRemote: false,
  };
}

function plcBinding(): SensorBinding {
  return {
    id: "plc-entry-rate",
    storeId: STORE_ID,
    sourceId: "plc:gateway-01",
    tag: "entry.rate",
    entityId: STORE_ID,
    property: "traffic.entriesPerMinute",
    valueType: "number",
    unit: "people/min",
    min: 0,
  };
}

function plcBatch(sequence: number, value: number): ObservationBatch {
  return {
    schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
    storeId: STORE_ID,
    sourceId: "plc:gateway-01",
    sourceSessionId: "gateway-session-01",
    sequence,
    sampledAt: new Date(WALL_CLOCK_START + sequence * 1_000).toISOString(),
    readings: [{ tag: "entry.rate", value }],
  };
}

describe("AgenticStoreRuntime integration", () => {
  const runtimes: AgenticStoreRuntime[] = [];

  afterEach(async () => {
    for (const runtime of runtimes.splice(0)) await runtime.dispose();
    vi.useRealTimers();
  });

  it("projects PLC ingest into bootstrap, event replay, health, and grounded agent answers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(WALL_CLOCK_START);
    const runtime = createAgenticStoreRuntime({
      config: config(false),
      bindings: [plcBinding()],
    });
    runtimes.push(runtime);

    const ingest = runtime.ingest(plcBatch(1, 17), "PLC");
    expect(ingest).toMatchObject({
      accepted: 1,
      rejected: 0,
      snapshotVersion: 1,
    });

    const bootstrap = runtime.bootstrap();
    expect(bootstrap).toMatchObject({
      manifest: { storeId: STORE_ID },
      snapshot: {
        storeId: STORE_ID,
        version: 1,
        properties: [
          expect.objectContaining({
            entityId: STORE_ID,
            property: "traffic.entriesPerMinute",
            value: 17,
            sourceId: "plc:gateway-01",
          }),
        ],
      },
      incidents: [],
      decisions: [],
      tasks: [],
      capabilities: {
        simulation: false,
        simulationScenarios: [],
        externalIngest: true,
        replay: true,
        aiProvider: "deterministic",
      },
      stream: { url: "/api/agentic-store/stream?after=1", latestSequence: 1 },
    });
    expect(runtime.listEvents().events).toEqual([
      expect.objectContaining({ type: "twin.patch", source: "PLC", sequence: 1 }),
    ]);
    expect(runtime.health()).toMatchObject({
      ok: true,
      simulation: false,
      latestSequence: 1,
      snapshotVersion: 1,
    });

    const answer = await runtime.askAgent("How busy is the entrance?", [STORE_ID]);
    expect(answer).toMatchObject({
      provider: "deterministic",
      evidence: [
        expect.objectContaining({
          entityId: STORE_ID,
          property: "traffic.entriesPerMinute",
          value: 17,
        }),
      ],
    });
    expect(answer.answer).toContain("There are no active incidents");

    expect(runtime.ingest(plcBatch(1, 17), "PLC")).toMatchObject({
      accepted: 0,
      rejected: 1,
      staleTags: ["entry.rate"],
      snapshotVersion: 1,
    });
    expect(() => runtime.ingest({ ...plcBatch(2, 20), storeId: "other-store" }, "PLC"))
      .toThrow(/does not match runtime store/);
  });

  it("runs a deterministic scenario through incident, agent action, and verified recovery", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(WALL_CLOCK_START);
    const simulator = createStoreSimulator({
      storeId: STORE_ID,
      seed: "runtime-accessibility-workflow",
      startTime: "2026-08-10T12:00:00.000Z",
      tickIntervalMs: 5_000,
    });
    const runtime = createAgenticStoreRuntime({
      config: config(true),
      simulator,
    });
    runtimes.push(runtime);

    expect(runtime.startScenario("accessibility-blocked", 30)).toMatchObject({
      running: true,
      activeScenario: "accessibility-blocked",
    });
    runtime.controlSimulator({ action: "PAUSE" });

    for (let second = 0; second < 3; second += 1) {
      vi.setSystemTime(WALL_CLOCK_START + second * 1_000);
      simulator.advanceBy(1_000);
    }
    await runtime.drain();

    expect(runtime.listIncidents()).toEqual([
      expect.objectContaining({
        kind: "ACCESSIBILITY_BLOCKED",
        status: "OPEN",
        decisionId: expect.any(String),
      }),
    ]);
    expect(runtime.listDecisions()).toEqual([
      expect.objectContaining({ status: "VERIFYING" }),
    ]);
    expect(runtime.listTasks()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "SAFETY", targetEntityId: "aisle-03" }),
      ]),
    );

    for (let second = 3; second <= 6; second += 1) {
      vi.setSystemTime(WALL_CLOCK_START + second * 1_000);
      simulator.advanceBy(1_000);
    }
    await runtime.drain();

    expect(runtime.listIncidents()[0]).toMatchObject({ status: "RESOLVED" });
    expect(runtime.listDecisions()[0]).toMatchObject({ status: "VERIFIED" });
    expect(runtime.snapshot().properties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "aisle-03",
          property: "accessibility.routeAvailable",
          value: true,
        }),
      ]),
    );
    const eventTypes = runtime.listEvents({ limit: 1_000 }).events.map((event) => event.type);
    expect(eventTypes).toEqual(expect.arrayContaining([
      "incident.opened",
      "decision.proposed",
      "task.updated",
      "incident.resolved",
      "decision.updated",
    ]));
  });

  it("resets the simulator projection and safely supersedes its active workflow", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(WALL_CLOCK_START);
    const simulator = createStoreSimulator({
      storeId: STORE_ID,
      seed: "runtime-reset-workflow",
      startTime: "2026-08-10T12:00:00.000Z",
      tickIntervalMs: 5_000,
    });
    const plcRouteBinding: SensorBinding = {
      id: "plc-aisle-route-context",
      storeId: STORE_ID,
      sourceId: "plc:aisle-controller",
      tag: "aisle03.routeAvailable",
      entityId: "aisle-03",
      property: "accessibility.routeAvailable",
      valueType: "boolean",
    };
    const bindings = [
      ...createSensorBindings(STORE_ID).filter(
        (binding) =>
          binding.entityId !== plcRouteBinding.entityId ||
          binding.property !== plcRouteBinding.property,
      ),
      plcRouteBinding,
    ];
    const runtime = createAgenticStoreRuntime({
      config: config(true),
      simulator,
      bindings,
    });
    runtimes.push(runtime);

    runtime.ingest({
      schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
      storeId: STORE_ID,
      sourceId: plcRouteBinding.sourceId,
      sourceSessionId: "aisle-controller-session",
      sequence: 1,
      sampledAt: new Date(WALL_CLOCK_START).toISOString(),
      readings: [{ tag: plcRouteBinding.tag, value: false }],
    }, "PLC");

    runtime.startScenario("accessibility-blocked", 30);
    runtime.controlSimulator({ action: "PAUSE" });
    for (let second = 0; second < 3; second += 1) {
      vi.setSystemTime(WALL_CLOCK_START + second * 1_000);
      simulator.advanceBy(1_000);
    }
    await runtime.drain();

    const beforeReset = runtime.snapshot();
    const activeIncident = runtime.listIncidents()[0];
    const activeDecision = runtime.listDecisions()[0];
    expect(activeIncident).toMatchObject({
      kind: "ACCESSIBILITY_BLOCKED",
      status: "OPEN",
      decisionId: activeDecision.id,
    });
    expect(new Set(activeIncident.evidence.map((evidence) => evidence.sourceId))).toEqual(
      new Set([simulator.sourceId, plcRouteBinding.sourceId]),
    );
    expect(activeIncident.triggerSourceIds).toEqual([simulator.sourceId]);
    expect(runtime.listTasks().some(
      (task) => task.status === "OPEN" || task.status === "IN_PROGRESS",
    )).toBe(true);
    const presenceEventsBeforeReset = runtime.listEvents({
      types: ["presence.frame"],
      limit: 1_000,
    }).events.length;

    const resetState = runtime.controlSimulator({ action: "RESET" });
    const afterReset = runtime.snapshot();

    expect(resetState).toMatchObject({ running: false, tick: 0 });
    expect(afterReset.version).toBeGreaterThan(beforeReset.version);
    expect(afterReset.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityId: "aisle-03",
        property: "accessibility.clearanceM",
        value: 1.65,
        sourceId: simulator.sourceId,
        sampledAt: "2026-08-10T12:00:00.000Z",
      }),
      expect.objectContaining({
        entityId: "aisle-03",
        property: "accessibility.routeAvailable",
        value: false,
        sourceId: plcRouteBinding.sourceId,
      }),
    ]));
    expect(runtime.listIncidents()[0]).toMatchObject({
      id: activeIncident.id,
      status: "RESOLVED",
      summary: expect.stringContaining("Closed without verification"),
    });
    expect(runtime.listDecisions()[0]).toMatchObject({
      id: activeDecision.id,
      status: "SUPERSEDED",
    });
    expect(runtime.listTasks().filter(
      (task) => task.decisionId === activeDecision.id,
    ).every((task) => task.status === "CANCELLED")).toBe(true);
    const presenceEventsAfterReset = runtime.listEvents({
      types: ["presence.frame"],
      limit: 1_000,
    }).events;
    expect(presenceEventsAfterReset).toHaveLength(presenceEventsBeforeReset + 1);
    expect(presenceEventsAfterReset.at(-1)?.data).toMatchObject({
      sampledAt: "2026-08-10T12:00:00.000Z",
      shoppers: [],
    });
  });

  it("detects a virtual-time scenario at maximum simulator speed before it expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(WALL_CLOCK_START);
    const simulator = createStoreSimulator({
      storeId: STORE_ID,
      seed: "runtime-max-speed-energy",
      startTime: "2026-08-10T12:00:00.000Z",
      tickIntervalMs: 250,
    });
    const runtime = createAgenticStoreRuntime({
      config: config(true),
      simulator,
    });
    runtimes.push(runtime);

    runtime.controlSimulator({ action: "START", speed: 20 });
    runtime.startScenario("energy-anomaly");
    await vi.advanceTimersByTimeAsync(1_000);
    await runtime.drain();
    runtime.controlSimulator({ action: "PAUSE" });

    expect(simulator.getState()).toMatchObject({
      speed: 20,
      activeScenario: "energy-anomaly",
    });
    expect(runtime.listIncidents()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "ENERGY_ANOMALY",
        status: "OPEN",
        decisionId: expect.any(String),
      }),
    ]));
  });

  it("does not supersede a PLC-triggered mixed-source queue incident on simulator reset", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(WALL_CLOCK_START);
    const simulator = createStoreSimulator({
      storeId: STORE_ID,
      seed: "runtime-plc-queue-causality",
      startTime: "2026-08-10T12:00:00.000Z",
      tickIntervalMs: 5_000,
    });
    const plcWaitBinding: SensorBinding = {
      id: "plc-checkout-wait",
      storeId: STORE_ID,
      sourceId: "plc:checkout-controller",
      tag: "checkout.waitSeconds",
      entityId: "checkout-cluster-01",
      property: "queue.waitSeconds",
      valueType: "number",
      unit: "s",
      min: 0,
    };
    const bindings = [
      ...createSensorBindings(STORE_ID).filter(
        (binding) =>
          binding.entityId !== plcWaitBinding.entityId ||
          binding.property !== plcWaitBinding.property,
      ),
      plcWaitBinding,
    ];
    const runtime = createAgenticStoreRuntime({
      config: config(true),
      simulator,
      bindings,
    });
    runtimes.push(runtime);

    const emitMixedQueueEvidence = (second: number, waitSeconds = 190) => {
      vi.setSystemTime(WALL_CLOCK_START + second * 1_000);
      simulator.advanceBy(1_000);
      runtime.ingest({
        schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
        storeId: STORE_ID,
        sourceId: plcWaitBinding.sourceId,
        sourceSessionId: "checkout-controller-session",
        sequence: second + 1,
        sampledAt: new Date(WALL_CLOCK_START + second * 1_000).toISOString(),
        readings: [{ tag: plcWaitBinding.tag, value: waitSeconds }],
      }, "PLC");
    };
    for (let second = 0; second <= 3; second += 1) {
      emitMixedQueueEvidence(second);
    }
    expect(runtime.listIncidents()).toEqual([]);

    // Resetting the normal simulator-owned queue length must not restart the
    // still-continuous PLC wait-time breach.
    runtime.controlSimulator({ action: "RESET" });
    emitMixedQueueEvidence(4);
    await runtime.drain();

    const incident = runtime.listIncidents()[0];
    const decision = runtime.listDecisions()[0];
    expect(incident).toMatchObject({
      kind: "QUEUE_PRESSURE",
      status: "OPEN",
      triggerSourceIds: [plcWaitBinding.sourceId],
    });
    expect(new Set(incident.evidence.map((evidence) => evidence.sourceId))).toEqual(
      new Set([simulator.sourceId, plcWaitBinding.sourceId]),
    );

    runtime.controlSimulator({ action: "RESET" });

    expect(runtime.listIncidents()[0]).toMatchObject({
      id: incident.id,
      status: "OPEN",
    });
    expect(runtime.listDecisions()[0]).toMatchObject({
      id: decision.id,
      status: decision.status,
    });

    // Shift the sole active cause from the opening-time PLC wait breach to the
    // simulator queue length without ever clearing the incident in between.
    runtime.startScenario("queue-surge", 150);
    runtime.controlSimulator({ action: "PAUSE" });
    let second = 5;
    const queueLength = (): number | undefined => {
      const value = runtime.snapshot().properties.find(
        (property) =>
          property.entityId === "checkout-cluster-01" &&
          property.property === "queue.length",
      )?.value;
      return typeof value === "number" ? value : undefined;
    };
    while ((queueLength() ?? -1) < 8 && second < 125) {
      emitMixedQueueEvidence(second);
      second += 1;
    }
    expect(queueLength()).toBeGreaterThanOrEqual(8);
    emitMixedQueueEvidence(second, 10);
    await runtime.drain();
    expect(runtime.listIncidents()[0]).toMatchObject({
      id: incident.id,
      status: "OPEN",
      // The persisted opening receipt remains historically accurate.
      triggerSourceIds: [plcWaitBinding.sourceId],
    });

    runtime.controlSimulator({ action: "RESET" });

    expect(runtime.listIncidents()[0]).toMatchObject({
      id: incident.id,
      status: "RESOLVED",
      summary: expect.stringContaining("Closed without verification"),
    });
    expect(runtime.listDecisions()[0]).toMatchObject({
      id: decision.id,
      status: "SUPERSEDED",
    });
  });
});
