// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AGENTIC_STORE_SCHEMA_VERSION,
  type JsonPrimitive,
  type ObservationBatch,
  type RawReading,
  type SensorBinding,
} from "../../packages/agentic-store-contracts/src/index.js";
import { AgenticStoreConflictError } from "./application/agent-orchestrator.js";
import type { AgenticStoreConfig } from "./config.js";
import { createAgenticStoreRuntime, type AgenticStoreRuntime } from "./runtime.js";
import { createStoreSimulator } from "./simulation/store-simulator.js";

const STORE_ID = "store-hardening-test";
const START = Date.parse("2026-08-10T12:00:00.000Z");

function config(simulationEnabled = false): AgenticStoreConfig {
  return {
    storeId: STORE_ID,
    databasePath: ":memory:",
    simulationEnabled,
    simulationTickMs: 5_000,
    historyRetentionHours: 72,
    localAiAllowRemote: false,
  };
}

function binding(
  id: string,
  tag: string,
  entityId: string,
  property: string,
  options: Partial<SensorBinding> = {},
): SensorBinding {
  return {
    id,
    storeId: STORE_ID,
    sourceId: "plc:hardening",
    tag,
    entityId,
    property,
    valueType: "number",
    staleAfterMs: 60_000,
    ...options,
  };
}

function batch(
  sequence: number,
  readings: RawReading[],
  sourceId = "plc:hardening",
): ObservationBatch {
  return {
    schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
    storeId: STORE_ID,
    sourceId,
    sourceSessionId: "hardening-session-01",
    sequence,
    sampledAt: new Date(START + sequence * 1_000).toISOString(),
    readings,
  };
}

describe("AgenticStoreRuntime hardening", () => {
  const runtimes: AgenticStoreRuntime[] = [];

  afterEach(async () => {
    for (const runtime of runtimes.splice(0)) await runtime.dispose();
    vi.useRealTimers();
  });

  it("marks overdue PLC evidence STALE, opens SENSOR_STALE, then verifies fresh recovery", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    const freshnessBinding = binding(
      "entry-rate-freshness",
      "entry.rate",
      STORE_ID,
      "traffic.entriesPerMinute",
      { staleAfterMs: 1_000, unit: "people/min", min: 0 },
    );
    const runtime = createAgenticStoreRuntime({
      config: config(false),
      bindings: [freshnessBinding],
    });
    runtimes.push(runtime);

    runtime.ingest(batch(1, [{ tag: "entry.rate", value: 14 }]), "PLC");
    expect(runtime.sourceStatuses(START)).toEqual([
      expect.objectContaining({ sourceId: "plc:hardening", status: "LIVE" }),
    ]);

    vi.setSystemTime(START + 1_001);
    expect(runtime.sweepFreshness(new Date(START + 1_001))).toBe(1);
    await runtime.drain();

    expect(runtime.snapshot().properties).toEqual([
      expect.objectContaining({
        property: "traffic.entriesPerMinute",
        value: 14,
        quality: "STALE",
      }),
    ]);
    expect(runtime.sourceStatuses(START + 1_001)).toEqual([
      expect.objectContaining({ status: "STALE" }),
    ]);
    expect(runtime.listIncidents()).toEqual([
      expect.objectContaining({
        kind: "SENSOR_STALE",
        entityId: STORE_ID,
        status: "OPEN",
        decisionId: expect.any(String),
      }),
    ]);
    expect(runtime.listDecisions()).toEqual([
      expect.objectContaining({ status: "VERIFYING" }),
    ]);

    vi.setSystemTime(START + 2_000);
    expect(runtime.ingest(batch(2, [{ tag: "entry.rate", value: 16 }]), "PLC").accepted)
      .toBe(1);
    await runtime.drain();

    expect(runtime.snapshot().properties[0]).toMatchObject({ value: 16, quality: "GOOD" });
    expect(runtime.sourceStatuses(START + 2_000)[0]).toMatchObject({ status: "LIVE" });
    expect(runtime.listIncidents()[0]).toMatchObject({
      kind: "SENSOR_STALE",
      status: "RESOLVED",
    });
    expect(runtime.listDecisions()[0]).toMatchObject({ status: "VERIFIED" });
  });

  it("does not stale simulator-owned properties while the simulator is paused", () => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    const simulator = createStoreSimulator({
      storeId: STORE_ID,
      seed: "paused-freshness",
      startTime: new Date(START),
      tickIntervalMs: 5_000,
    });
    const runtime = createAgenticStoreRuntime({
      config: config(true),
      simulator,
    });
    runtimes.push(runtime);

    simulator.advanceBy(1_000);
    expect(simulator.getState().running).toBe(false);
    expect(runtime.snapshot().properties.length).toBeGreaterThan(20);

    expect(runtime.sweepFreshness(new Date(START + 120_000))).toBe(0);
    expect(runtime.snapshot().properties.every((property) => property.quality === "GOOD"))
      .toBe(true);
    expect(runtime.sourceStatuses(START + 120_000)).toEqual([
      expect.objectContaining({
        sourceId: simulator.sourceId,
        kind: "SIMULATOR",
        status: "PAUSED",
      }),
    ]);
    expect(runtime.listIncidents()).toEqual([]);
  });

  it("supersedes pending approvals after recovery and rejects a late review", async () => {
    vi.useFakeTimers();
    const queueBindings = [
      binding("queue-length", "queue.length", "checkout-cluster-01", "queue.length", { unit: "people" }),
      binding("queue-wait", "queue.wait", "checkout-cluster-01", "queue.waitSeconds", { unit: "s" }),
      binding("queue-lanes", "queue.lanes", "checkout-cluster-01", "operations.lanesOpen", { unit: "lanes" }),
    ];
    const runtime = createAgenticStoreRuntime({
      config: config(false),
      bindings: queueBindings,
    });
    runtimes.push(runtime);

    for (let second = 0; second <= 4; second += 1) {
      vi.setSystemTime(START + second * 1_000);
      runtime.ingest(batch(second + 1, [
        { tag: "queue.length", value: 11 },
        { tag: "queue.wait", value: 190 },
        { tag: "queue.lanes", value: 1 },
      ]), "PLC");
    }
    await runtime.drain();

    const pending = runtime.listDecisions()[0];
    expect(runtime.listIncidents()[0]).toMatchObject({
      kind: "QUEUE_PRESSURE",
      status: "OPEN",
    });
    expect(pending).toMatchObject({ status: "WAITING_APPROVAL" });
    expect(
      pending.alternatives
        .find((alternative) => alternative.id === pending.selectedAlternativeId)!
        .actions,
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "WAITING_APPROVAL" }),
    ]));

    for (let second = 5; second <= 9; second += 1) {
      vi.setSystemTime(START + second * 1_000);
      runtime.ingest(batch(second + 1, [
        { tag: "queue.length", value: 1 },
        { tag: "queue.wait", value: 10 },
        { tag: "queue.lanes", value: 2 },
      ]), "PLC");
    }
    await runtime.drain();

    expect(runtime.listIncidents()[0]).toMatchObject({ status: "RESOLVED" });
    const superseded = runtime.listDecisions()[0];
    expect(superseded).toMatchObject({ status: "SUPERSEDED" });
    expect(
      superseded.alternatives
        .find((alternative) => alternative.id === superseded.selectedAlternativeId)!
        .actions,
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: "CANCELLED",
        result: expect.stringContaining("recovered before approval"),
      }),
    ]));

    await expect(runtime.reviewDecision(
      superseded.id,
      { actorId: "late-operator", note: "This must not execute." },
      true,
    )).rejects.toBeInstanceOf(AgenticStoreConflictError);
  });

  it("does not clear an incident with malformed or out-of-range evidence", async () => {
    vi.useFakeTimers();
    const temperatureBinding = binding(
      "dairy-temperature",
      "dairy.temperature",
      "cooler-dairy-01",
      "thermal.airTemperatureC",
      { min: 0, max: 10, unit: "°C" },
    );
    const runtime = createAgenticStoreRuntime({
      config: config(false),
      bindings: [temperatureBinding],
    });
    runtimes.push(runtime);

    for (let second = 0; second <= 5; second += 1) {
      vi.setSystemTime(START + second * 1_000);
      runtime.ingest(batch(second + 1, [
        { tag: "dairy.temperature", value: 6 },
      ]), "PLC");
    }
    await runtime.drain();
    expect(runtime.listIncidents()[0]).toMatchObject({
      kind: "COLD_CHAIN_RISK",
      status: "OPEN",
    });

    vi.setSystemTime(START + 6_000);
    const malformed = runtime.ingest(batch(7, [
      { tag: "dairy.temperature", value: "3" },
    ]), "PLC");
    expect(malformed).toMatchObject({
      accepted: 0,
      rejected: 1,
      unknownTags: ["dairy.temperature"],
    });

    for (let second = 7; second <= 14; second += 1) {
      vi.setSystemTime(START + second * 1_000);
      runtime.ingest(batch(second + 1, [
        { tag: "dairy.temperature", value: -50 as JsonPrimitive },
      ]), "PLC");
    }
    await runtime.drain();

    expect(runtime.snapshot().properties[0]).toMatchObject({ value: -50, quality: "BAD" });
    expect(runtime.listIncidents()[0]).toMatchObject({
      kind: "COLD_CHAIN_RISK",
      status: "OPEN",
    });
    expect(
      runtime.listEvents({ types: ["incident.resolved"] }).events,
    ).toEqual([]);
  });
});
