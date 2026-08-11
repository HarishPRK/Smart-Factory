// @vitest-environment node

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { NormalizedObservation } from "../../../packages/agentic-store-contracts/src/index.js";
import { SqliteAgenticStore } from "./sqlite-store.js";

const STORE_ID = "store-persistence-test";

function observation(overrides: Partial<NormalizedObservation> = {}): NormalizedObservation {
  return {
    observationId: "observation-1",
    storeId: STORE_ID,
    sourceId: "plc:test",
    sourceSessionId: "session-1",
    sourceSequence: 1,
    bindingId: "binding-1",
    entityId: "cooler-01",
    property: "thermal.airTemperatureC",
    value: 3.4,
    unit: "°C",
    quality: "GOOD",
    sampledAt: "2026-08-10T12:00:00.000Z",
    receivedAt: "2026-08-10T12:00:00.100Z",
    ...overrides,
  };
}

describe("SqliteAgenticStore", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("persists the projected twin and history across a database reopen", () => {
    const directory = mkdtempSync(join(tmpdir(), "agentic-store-sqlite-"));
    directories.push(directory);
    const databasePath = join(directory, "store.sqlite");
    const first = new SqliteAgenticStore(databasePath);
    const event = first.appendEvent({
      id: "event-1",
      storeId: STORE_ID,
      type: "twin.patch",
      source: "PLC",
      occurredAt: "2026-08-10T12:00:00.000Z",
      recordedAt: "2026-08-10T12:00:00.100Z",
      data: { changes: [] },
    });
    expect(first.saveObservations([observation()], event.sequence)).toBe(1);
    first.close();

    const reopened = new SqliteAgenticStore(databasePath);
    expect(reopened.getSnapshot(STORE_ID)).toMatchObject({
      version: event.sequence,
      properties: [
        expect.objectContaining({
          entityId: "cooler-01",
          property: "thermal.airTemperatureC",
          value: 3.4,
          version: event.sequence,
        }),
      ],
    });
    expect(
      reopened.getPropertyHistory(
        STORE_ID,
        "cooler-01",
        "thermal.airTemperatureC",
        "2026-08-10T00:00:00.000Z",
        "2026-08-11T00:00:00.000Z",
      ).points,
    ).toEqual([
      {
        sampledAt: "2026-08-10T12:00:00.000Z",
        value: 3.4,
        quality: "GOOD",
      },
    ]);
    reopened.close();
  });

  it("makes event IDs and observation IDs idempotent", () => {
    const store = new SqliteAgenticStore(":memory:");
    const input = {
      id: "stable-event-id",
      storeId: STORE_ID,
      type: "twin.patch" as const,
      source: "PLC" as const,
      occurredAt: "2026-08-10T12:00:00.000Z",
      recordedAt: "2026-08-10T12:00:00.100Z",
      data: { changes: [] },
    };

    const first = store.appendEvent(input);
    const duplicate = store.appendEvent(input);
    expect(duplicate).toEqual(first);
    expect(store.listEvents({ storeId: STORE_ID }).events).toHaveLength(1);

    expect(store.saveObservations([observation()], first.sequence)).toBe(1);
    expect(store.saveObservations([observation()], first.sequence + 1)).toBe(0);
    expect(
      store.getPropertyHistory(
        STORE_ID,
        "cooler-01",
        "thermal.airTemperatureC",
        "2026-08-10T00:00:00.000Z",
        "2026-08-11T00:00:00.000Z",
      ).points,
    ).toHaveLength(1);
    store.close();
  });
});
