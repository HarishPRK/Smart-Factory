// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import {
  AGENTIC_STORE_SCHEMA_VERSION,
  type ObservationBatch,
  type SensorBinding,
  type StoreEventEnvelope,
} from "../../../packages/agentic-store-contracts/src/index.js";
import { SqliteAgenticStore } from "../infrastructure/sqlite-store.js";
import { StoreEventBus } from "../infrastructure/store-event-bus.js";
import { ObservationService } from "./observation-service.js";

const STORE_ID = "store-test";
const SOURCE_ID = "plc:line-01";
const SAMPLED_AT = "2026-08-10T12:00:00.000Z";
const RECEIVED_AT = "2026-08-10T12:00:00.100Z";

const bindings: SensorBinding[] = [
  {
    id: "temperature-binding",
    storeId: STORE_ID,
    sourceId: SOURCE_ID,
    tag: "temperature.raw",
    entityId: "cooler-01",
    property: "thermal.airTemperatureC",
    valueType: "number",
    unit: "°C",
    scale: 0.1,
    offset: -5,
    min: -10,
    max: 10,
  },
  {
    id: "door-binding",
    storeId: STORE_ID,
    sourceId: SOURCE_ID,
    tag: "door.open",
    entityId: "cooler-01",
    property: "access.doorOpen",
    valueType: "boolean",
  },
];

function batch(
  sequence: number,
  readings: ObservationBatch["readings"],
  sampledAt = SAMPLED_AT,
): ObservationBatch {
  return {
    schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
    storeId: STORE_ID,
    sourceId: SOURCE_ID,
    sourceSessionId: "plc-session-a",
    sequence,
    sampledAt,
    readings,
  };
}

describe("ObservationService", () => {
  let store: SqliteAgenticStore | undefined;

  afterEach(() => {
    store?.close();
    store = undefined;
  });

  it("normalizes configured values, marks out-of-range data bad, and reports rejected tags", () => {
    store = new SqliteAgenticStore(":memory:");
    const bus = new StoreEventBus();
    const events: StoreEventEnvelope<unknown>[] = [];
    bus.subscribe(STORE_ID, (event) => events.push(event));
    const service = new ObservationService(store, bus, bindings, () => new Date(RECEIVED_AT));

    const result = service.ingest(
      batch(1, [
        { tag: "temperature.raw", value: 80 },
        { tag: "door.open", value: "yes" },
        { tag: "unknown.tag", value: 1 },
      ]),
      "PLC",
    );

    expect(result).toMatchObject({
      accepted: 1,
      rejected: 2,
      unknownTags: ["unknown.tag", "door.open"],
      staleTags: [],
      snapshotVersion: 1,
    });
    expect(store.getSnapshot(STORE_ID).properties).toEqual([
      expect.objectContaining({
        entityId: "cooler-01",
        property: "thermal.airTemperatureC",
        value: 3,
        unit: "°C",
        quality: "GOOD",
        receivedAt: RECEIVED_AT,
      }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "twin.patch", source: "PLC", sequence: 1 });

    const highResult = service.ingest(
      batch(2, [{ tag: "temperature.raw", value: 200 }], "2026-08-10T12:00:01.000Z"),
      "PLC",
    );
    expect(highResult.accepted).toBe(1);
    expect(store.getSnapshot(STORE_ID).properties[0]).toMatchObject({
      value: 15,
      quality: "BAD",
      sourceSequence: 2,
    });
  });

  it("deduplicates retries and rejects lower source sequences without publishing patches", () => {
    store = new SqliteAgenticStore(":memory:");
    const bus = new StoreEventBus();
    const events: StoreEventEnvelope<unknown>[] = [];
    bus.subscribe(STORE_ID, (event) => events.push(event));
    const service = new ObservationService(store, bus, bindings, () => new Date(RECEIVED_AT));
    const newest = batch(10, [{ tag: "temperature.raw", value: 75 }]);

    expect(service.ingest(newest, "PLC").accepted).toBe(1);

    const retry = service.ingest(newest, "PLC");
    expect(retry).toMatchObject({
      accepted: 0,
      rejected: 1,
      staleTags: ["temperature.raw"],
      snapshotVersion: 1,
    });

    const older = service.ingest(
      batch(9, [{ tag: "temperature.raw", value: 10 }], "2026-08-10T12:00:05.000Z"),
      "PLC",
    );
    expect(older).toMatchObject({
      accepted: 0,
      rejected: 1,
      staleTags: ["temperature.raw"],
      snapshotVersion: 1,
    });
    expect(events).toHaveLength(1);
    expect(store.getSnapshot(STORE_ID).properties[0]).toMatchObject({
      value: 2.5,
      sourceSequence: 10,
    });
  });

  it("rejects delayed PLC samples outside the binding's live-data window", () => {
    store = new SqliteAgenticStore(":memory:");
    const delayedBinding: SensorBinding = {
      ...bindings[0],
      maxSampleAgeMs: 1_000,
    };
    const service = new ObservationService(
      store,
      new StoreEventBus(),
      [delayedBinding],
      () => new Date("2026-08-10T12:00:02.000Z"),
    );

    expect(service.ingest(
      batch(1, [{ tag: "temperature.raw", value: 80 }]),
      "PLC",
    )).toMatchObject({
      accepted: 0,
      rejected: 1,
      unknownTags: ["temperature.raw"],
      snapshotVersion: 0,
    });
  });
});
