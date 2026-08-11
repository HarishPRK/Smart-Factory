// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  AGENTIC_STORE_SCHEMA_VERSION,
  type IncidentRecord,
  type TwinPropertyState,
  type TwinSnapshot,
} from "../../../packages/agentic-store-contracts/src/index.js";
import { IncidentRuleEngine } from "./incident-rule-engine.js";

const STORE_ID = "store-001";
const START = Date.parse("2026-08-10T12:00:00.000Z");

function property(
  entityId: string,
  key: string,
  value: TwinPropertyState["value"],
  sampledAt = START,
): TwinPropertyState {
  return {
    entityId,
    property: key,
    value,
    quality: "GOOD",
    sampledAt: new Date(sampledAt).toISOString(),
    receivedAt: new Date(START).toISOString(),
    sourceId: "simulator:store-001",
    sourceSessionId: "session-1",
    sourceSequence: 1,
    version: 1,
  };
}

function coldChainSnapshot(temperatureC: number, sampledAt = START): TwinSnapshot {
  return {
    schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
    storeId: STORE_ID,
    version: 1,
    generatedAt: new Date(START).toISOString(),
    properties: [
      property("cooler-dairy-01", "thermal.airTemperatureC", temperatureC, sampledAt),
      property("cooler-dairy-01", "access.doorOpen", false, sampledAt),
    ],
  };
}

function plcColdChainSnapshot(
  temperatureC: number,
  sampledAt: number,
  receivedAt: number,
): TwinSnapshot {
  const snapshot = coldChainSnapshot(temperatureC, sampledAt);
  return {
    ...snapshot,
    properties: snapshot.properties.map((item) => ({
      ...item,
      sourceId: "plc:store-001",
      receivedAt: new Date(receivedAt).toISOString(),
    })),
  };
}

function simulatorAndPlcFaultSnapshot(at: number): TwinSnapshot {
  const simulatorProperties = coldChainSnapshot(6, at).properties;
  const plcProperty = (
    entityId: string,
    key: string,
    value: number,
  ): TwinPropertyState => ({
    ...property(entityId, key, value, at),
    sourceId: "plc:energy-panel",
    receivedAt: new Date(at).toISOString(),
  });
  return {
    schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
    storeId: STORE_ID,
    version: 1,
    generatedAt: new Date(at).toISOString(),
    properties: [
      ...simulatorProperties,
      plcProperty("energy-panel-01", "electrical.totalKw", 100),
      plcProperty("energy-panel-01", "electrical.baselineKw", 50),
    ],
  };
}

function incidentFromOpen(openedAt: number): IncidentRecord {
  return {
    id: "incident-cold-chain",
    storeId: STORE_ID,
    kind: "COLD_CHAIN_RISK",
    severity: "HIGH",
    entityId: "cooler-dairy-01",
    title: "Dairy cold-chain exposure",
    summary: "The dairy cooler has remained above its safe operating temperature.",
    status: "OPEN",
    openedAt: new Date(openedAt).toISOString(),
    updatedAt: new Date(openedAt).toISOString(),
    evidence: [],
    triggerSourceIds: ["simulator:store-001"],
  };
}

describe("IncidentRuleEngine hysteresis", () => {
  it("opens only after the cold-chain threshold remains breached for five seconds", () => {
    const engine = new IncidentRuleEngine();

    expect(engine.evaluate(coldChainSnapshot(6), [], START).open).toEqual([]);
    expect(engine.evaluate(coldChainSnapshot(6, START + 4_999), [], START + 4_999).open).toEqual([]);

    const result = engine.evaluate(coldChainSnapshot(6, START + 5_000), [], START + 5_000);
    expect(result.open).toEqual([
      expect.objectContaining({
        key: "COLD_CHAIN_RISK:cooler-dairy-01",
        kind: "COLD_CHAIN_RISK",
        severity: "HIGH",
        entityId: "cooler-dairy-01",
        triggerSourceIds: ["simulator:store-001"],
      }),
    ]);
    expect(result.open[0].evidence).toEqual([
      expect.objectContaining({ property: "thermal.airTemperatureC", value: 6 }),
      expect.objectContaining({ property: "access.doorOpen", value: false }),
    ]);
  });

  it("resets trigger timing when a breach clears and requires a sustained safe band to resolve", () => {
    const engine = new IncidentRuleEngine();
    engine.evaluate(coldChainSnapshot(6), [], START);
    engine.evaluate(coldChainSnapshot(4, START + 3_000), [], START + 3_000);
    expect(engine.evaluate(coldChainSnapshot(6, START + 5_000), [], START + 5_000).open).toEqual([]);
    expect(engine.evaluate(coldChainSnapshot(6, START + 9_999), [], START + 9_999).open).toEqual([]);

    const opened = engine.evaluate(coldChainSnapshot(6, START + 10_000), [], START + 10_000).open;
    expect(opened).toHaveLength(1);
    const active = incidentFromOpen(START + 10_000);

    expect(engine.evaluate(coldChainSnapshot(4.5, START + 11_000), [active], START + 11_000).resolve).toEqual([]);
    expect(engine.evaluate(coldChainSnapshot(4, START + 12_000), [active], START + 12_000).resolve).toEqual([]);
    expect(engine.evaluate(coldChainSnapshot(4, START + 17_999), [active], START + 17_999).resolve).toEqual([]);
    expect(engine.evaluate(coldChainSnapshot(4, START + 18_000), [active], START + 18_000).resolve).toEqual([active]);
  });

  it("can reset all temporal memory between simulator sessions", () => {
    const engine = new IncidentRuleEngine();
    engine.evaluate(coldChainSnapshot(6), [], START);
    engine.reset();

    expect(engine.evaluate(coldChainSnapshot(6, START + 5_000), [], START + 5_000).open).toEqual([]);
  });

  it("uses server receipt time rather than a PLC device clock for hysteresis", () => {
    const engine = new IncidentRuleEngine();

    engine.evaluate(plcColdChainSnapshot(6, START, START), [], START);
    expect(engine.evaluate(
      plcColdChainSnapshot(6, START + 5_000, START),
      [],
      START + 5_000,
    ).open).toEqual([]);
    expect(engine.evaluate(
      plcColdChainSnapshot(6, START + 5_000, START + 5_000),
      [],
      START + 5_000,
    ).open).toHaveLength(1);
  });

  it("resets only temporal rules causally owned by the reset source", () => {
    const engine = new IncidentRuleEngine();
    engine.evaluate(simulatorAndPlcFaultSnapshot(START), [], START);

    engine.resetForSource(
      simulatorAndPlcFaultSnapshot(START + 5_000),
      "simulator:store-001",
    );
    const opened = engine.evaluate(
      simulatorAndPlcFaultSnapshot(START + 10_000),
      [],
      START + 10_000,
    ).open;

    expect(opened.map((incident) => incident.kind)).toEqual(["ENERGY_ANOMALY"]);
    expect(opened[0]?.triggerSourceIds).toEqual(["plc:energy-panel"]);
  });
});
