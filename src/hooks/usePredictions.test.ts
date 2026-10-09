import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePredictions } from "./usePredictions";
import { usePLCStore } from "../stores/plcStore";
import { usePredictionStore } from "../stores/predictionStore";
import { DEFAULT_OUTPUTS } from "../services/plcService";

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(100_000);
  usePLCStore.setState({ params: [], telemetrySource: "none", lastReceivedAt: null, receivedHistories: {}, receivedSampleTimes: {} });
  usePredictionStore.setState({ parameterPredictions: [], anomalyAlerts: [], rulEstimates: [], lastComputedAt: 0 });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const tick = () => act(() => vi.advanceTimersByTime(2000));
const samples = () => usePLCStore.setState({ telemetrySource: "plc", receivedHistories: { ph: [7, 7.1, 7.2, 7.3, 7.4] }, receivedSampleTimes: { ph: [80_000, 85_000, 90_000, 95_000, 100_000] } });

describe("predictive input provenance", () => {
  it("analyzes an available channel without waiting for voltage, then clears stale forecasts", () => {
    samples(); renderHook(() => usePredictions()); tick();
    expect(usePredictionStore.getState().parameterPredictions.map((p) => p.parameterId)).toEqual(["ph"]);
    act(() => vi.advanceTimersByTime(16_000));
    expect(usePredictionStore.getState().parameterPredictions).toEqual([]);
    expect(usePredictionStore.getState().anomalyAlerts).toEqual([]);
    expect(usePredictionStore.getState().lastComputedAt).toBe(0);
  });
  it("excludes simulated values and waits for five new receipts after an outage", () => {
    samples(); usePLCStore.setState({ telemetrySource: "simulation" }); renderHook(() => usePredictions()); tick();
    expect(usePredictionStore.getState().parameterPredictions).toEqual([]);
    usePLCStore.setState({ telemetrySource: "plc", receivedSampleTimes: { ph: [60_000, 65_000, 70_000, 95_000, 100_000] } }); tick();
    expect(usePredictionStore.getState().parameterPredictions).toEqual([]);
  });
  it("keeps per-channel timestamps aligned and does not repeat a silent channel", () => {
    const parameter = { id: "voltage", kind: "analog" as const, label: "Voltage", value: 4.31, status: "normal" as const, accentHex: "#fff", receivedAt: 100_000 };
    usePLCStore.getState().updateFromPLC([parameter], DEFAULT_OUTPUTS, { source: "plc", receivedAt: 100_000 });
    usePLCStore.getState().updateFromPLC([parameter], DEFAULT_OUTPUTS, { source: "plc", receivedAt: 101_000 });
    expect(usePLCStore.getState().receivedSampleTimes.voltage).toEqual([100_000]);
    usePLCStore.getState().updateFromPLC([{ ...parameter, receivedAt: 105_000 }], DEFAULT_OUTPUTS, { source: "plc", receivedAt: 105_000 });
    expect(usePLCStore.getState().receivedSampleTimes.voltage).toEqual([100_000, 105_000]);
    expect(usePLCStore.getState().receivedHistories.voltage).toEqual([4.31, 4.31]);
  });
});
