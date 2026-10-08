import { describe, expect, it } from "vitest";
import type { LorawanDevice, LorawanReading } from "../../hooks/useLorawanSensors";
import { receivedMetric, receivedSeries, receivedSummary, relativePacketAge } from "./lorawanModel";

const reading = (values: Partial<LorawanReading> = {}): LorawanReading => ({ receivedAt: 1000, devEui: "device-1", deviceName: "Soil probe", ...values });
const device = (history: LorawanReading[]): LorawanDevice => ({ devEui: "device-1", deviceName: "Soil probe", latest: history.at(-1)!, history });

describe("LoRaWAN received measurement model", () => {
  it("keeps received zero and negative temperatures, excluding missing, nonfinite and generated values", () => {
    expect(receivedMetric(reading({ soilMoisturePct: 0 }), "soilMoisturePct")).toBe(0);
    expect(receivedMetric(reading({ soilTempC: -4.5 }), "soilTempC")).toBe(-4.5);
    expect(receivedMetric(reading({ soilMoisturePct: 32, simulated: { soilMoisturePct: true } }), "soilMoisturePct")).toBeNull();
    expect(receivedMetric(reading({ batteryV: Infinity }), "batteryV")).toBeNull();
    expect(receivedMetric(reading(), "conductivityUsCm")).toBeNull();
  });
  it("builds an ordered chart from only received sample timestamps", () => {
    const history = [reading({ receivedAt: 3000, soilMoisturePct: 7 }), reading({ receivedAt: 2000, soilMoisturePct: 44, simulated: { soilMoisturePct: true } }), reading({ receivedAt: 1000, soilMoisturePct: 0 })];
    expect(receivedSeries(device(history), "soilMoisturePct")).toEqual([{ timestamp: 1000, value: 0 }, { timestamp: 3000, value: 7 }]);
  });
  it("computes summaries from measured fields without diluting them with backfill", () => {
    const devices = [device([reading({ soilMoisturePct: 0, batteryV: 3.5 })]), device([reading({ soilMoisturePct: 40, batteryV: 3.2, simulated: { soilMoisturePct: true, batteryV: true } })]), device([reading({ soilMoisturePct: 10, batteryV: 3.6 })])];
    expect(receivedSummary(devices)).toEqual({ moisture: 5, battery: 3.5 });
    expect(receivedSummary([])).toEqual({ moisture: null, battery: null });
  });
  it("formats freshness and never produces negative packet age", () => {
    expect(relativePacketAge(1000, 0)).toBe("Just received");
    expect(relativePacketAge(1000, 46_000)).toBe("45s ago");
    expect(relativePacketAge(1000, 181_000)).toBe("3m ago");
    expect(relativePacketAge(1000, 7_201_000)).toBe("2h ago");
  });
});
