// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import type {
  ActionIntent,
  ObservationBatch,
} from "../../../packages/agentic-store-contracts/src/index.js";
import {
  STORE_SCENARIO_IDS,
  StoreSimulator,
  type StoreScenarioId,
} from "./store-simulator.js";

const START_TIME = "2026-08-10T12:00:00.000Z";

function readingMap(batch: ObservationBatch): Map<string, ObservationBatch["readings"][number]["value"]> {
  return new Map(batch.readings.map((reading) => [reading.tag, reading.value]));
}

describe("StoreSimulator", () => {
  const simulators: StoreSimulator[] = [];

  afterEach(() => {
    for (const simulator of simulators.splice(0)) simulator.dispose();
  });

  function create(seed: string): StoreSimulator {
    const simulator = new StoreSimulator({
      storeId: "store-001",
      seed,
      startTime: START_TIME,
      tickIntervalMs: 5_000,
    });
    simulators.push(simulator);
    return simulator;
  }

  it("emits byte-for-byte equivalent telemetry and shopper motion for the same seed", () => {
    const leftBatches: ObservationBatch[] = [];
    const rightBatches: ObservationBatch[] = [];
    const left = create("audience-demo");
    const right = create("audience-demo");
    left.onObservationBatch((batch) => leftBatches.push(batch));
    right.onObservationBatch((batch) => rightBatches.push(batch));

    left.advanceBy(12_000);
    right.advanceBy(12_000);

    expect(leftBatches).toEqual(rightBatches);
    expect(leftBatches).toHaveLength(12);
    expect(left.getPresenceFrame()).toEqual(right.getPresenceFrame());
    expect(left.getState()).toEqual(right.getState());
  });

  it.each([
    ["normal-rush", "store.mode", "RUSH"],
    ["cold-chain", "dairy.mode", "DEGRADED"],
    ["shelf-gap", "produce.unitsOnShelf", 7],
    ["queue-surge", "checkout.lanesOpen", 1],
    ["accessibility-blocked", "aisle03.routeAvailable", false],
    ["energy-anomaly", "store.mode", "INCIDENT"],
  ] satisfies Array<[StoreScenarioId, string, string | number | boolean]>) (
    "makes the %s scenario visible through normalized sensor tags",
    (scenario, tag, expected) => {
      const batches: ObservationBatch[] = [];
      const simulator = create(`scenario:${scenario}`);
      simulator.onObservationBatch((batch) => batches.push(batch));

      simulator.startScenario(scenario, 5);
      simulator.advanceBy(1_000);

      expect(simulator.getState().activeScenario).toBe(scenario);
      expect(readingMap(batches.at(-1)!).get(tag)).toBe(expected);
    },
  );

  it("supports start, pause, reset, speed changes, and bounded scenario expiry", () => {
    const simulator = create("controls");
    expect(simulator.getState()).toMatchObject({ running: false, speed: 1, tick: 0 });

    expect(simulator.control({ action: "START", speed: 3 })).toMatchObject({
      running: true,
      speed: 3,
    });
    expect(simulator.control({ action: "PAUSE" }).running).toBe(false);

    const sessionBeforeReset = simulator.getState().sourceSessionId;
    expect(simulator.control({ action: "RESET", speed: 2 })).toMatchObject({
      running: false,
      speed: 2,
      tick: 0,
    });
    expect(simulator.getState().sourceSessionId).not.toBe(sessionBeforeReset);

    simulator.startScenario("accessibility-blocked", 5);
    simulator.advanceBy(5_000);
    expect(simulator.getState().activeScenario).toBeUndefined();
    expect(STORE_SCENARIO_IDS).toContain("accessibility-blocked");
  });

  it("applies an orchestrated action to scenario state and exposes the recovery in telemetry", () => {
    const batches: ObservationBatch[] = [];
    const simulator = create("action-recovery");
    simulator.onObservationBatch((batch) => batches.push(batch));
    simulator.startScenario("accessibility-blocked", 30);
    simulator.advanceBy(1_000);
    expect(readingMap(batches.at(-1)!).get("aisle03.routeAvailable")).toBe(false);

    const action: ActionIntent = {
      id: "clear-aisle-action",
      kind: "CLEAR_AISLE",
      targetEntityId: "aisle-03",
      summary: "Restore the accessible route",
      parameters: { clearanceM: 1.6 },
      risk: "LOW",
      requiresApproval: false,
      status: "EXECUTING",
    };
    expect(simulator.applyAction(action)).toMatchObject({
      actionId: action.id,
      accepted: true,
    });

    simulator.advanceBy(1_000);
    const recovered = readingMap(batches.at(-1)!);
    expect(recovered.get("aisle03.clearanceM")).toBe(1.6);
    expect(recovered.get("aisle03.routeAvailable")).toBe(true);
  });

  it("emits recovered telemetry when a scenario stops or the simulator resets", () => {
    const batches: ObservationBatch[] = [];
    const simulator = create("stop-and-reset");
    simulator.onObservationBatch((batch) => batches.push(batch));

    simulator.startScenario("accessibility-blocked", 30);
    simulator.advanceBy(1_000);
    expect(readingMap(batches.at(-1)!).get("aisle03.routeAvailable")).toBe(false);

    simulator.stopScenario();
    expect(simulator.getState().activeScenario).toBeUndefined();
    expect(readingMap(batches.at(-1)!).get("aisle03.routeAvailable")).toBe(true);

    simulator.startScenario("cold-chain", 30);
    simulator.advanceBy(1_000);
    expect(readingMap(batches.at(-1)!).get("dairy.mode")).toBe("DEGRADED");

    simulator.reset();
    expect(simulator.getState()).toMatchObject({ running: false, tick: 0 });
    expect(readingMap(batches.at(-1)!).get("dairy.mode")).toBe("NORMAL");
  });
});
