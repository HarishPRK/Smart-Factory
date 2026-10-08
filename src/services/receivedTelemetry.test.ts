import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { usePLCStore } from "../stores/plcStore";
import { DEFAULT_OUTPUTS, parsePLCPayload, type PLCState } from "./plcService";
import { isReceivedParameter, PLC_TELEMETRY_STALE_MS, readSensorPLCChannel } from "./receivedTelemetry";
import type { PLCParameter } from "../types";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  usePLCStore.setState({ params: [], telemetrySource: "none", lastReceivedAt: null, receivedHistories: {}, historyVoltage: [], historyCurrent: [], historyPH: [], historyTemp: [] });
});
afterEach(() => vi.useRealTimers());

function ingest(state: PLCState) {
  usePLCStore.getState().updateFromPLC(state.params, state.outputs, { source: state.source ?? "none", receivedAt: state.receivedAt ?? null });
}
function channel(id: string, now = Date.now()) { return readSensorPLCChannel(id, usePLCStore.getState(), now); }

describe("received PLC channel provenance", () => {
  it("rejects generated model values and never seeds real history from them", () => {
    const params: PLCParameter[] = [{ id: "forming_pressure", label: "Pressure", kind: "analog", value: 65, status: "normal", accentHex: "#43d8f1" }];
    usePLCStore.getState().updateFromPLC(params, { ...DEFAULT_OUTPUTS }, { source: "simulation", receivedAt: Date.now() });
    expect(channel("forming_pressure")).toMatchObject({ available: false, value: null, state: "awaiting", history: [] });
    expect(usePLCStore.getState().receivedHistories).toEqual({});
    vi.advanceTimersByTime(100);
    ingest(parsePLCPayload({ boardB_esp32_pressure: 71 }));
    expect(channel("forming_pressure").history).toEqual([71]);
  });

  it("leaves placeholders and nonfinite analog values unavailable, while accepting real zero", () => {
    const invalid: PLCParameter[] = [
      { id: "forming_pressure", label: "Pressure", kind: "analog", value: 65, status: "normal", accentHex: "#43d8f1", placeholder: true },
      { id: "forming_light", label: "Light", kind: "analog", value: Number.NaN, status: "normal", accentHex: "#43d8f1" },
      { id: "curing_mq", label: "Gas", kind: "analog", value: Number.POSITIVE_INFINITY, status: "normal", accentHex: "#43d8f1" },
    ];
    usePLCStore.getState().updateFromPLC(invalid, { ...DEFAULT_OUTPUTS });
    for (const id of ["forming_pressure", "forming_light", "curing_mq"]) expect(channel(id).available).toBe(false);
    expect(usePLCStore.getState().receivedHistories).toEqual({});
    expect(invalid.every((param) => !isReceivedParameter(param))).toBe(true);
    vi.advanceTimersByTime(10);
    ingest(parsePLCPayload({ boardB_esp32_pressure: 0 }));
    expect(channel("forming_pressure")).toMatchObject({ available: true, value: 0, state: "live" });
  });

  it("keeps received values beyond the visual model range unchanged", () => {
    ingest(parsePLCPayload({ boardB_esp32_pressure: 175 }));
    expect(channel("pkg_pressure")).toMatchObject({ value: 175, sourceId: "forming_pressure", shared: true, sourceLabel: "Shared pressure input" });
    expect(channel("pkg_pressure").history).toEqual([175]);
  });

  it("does not borrow a missing stage channel from a different station", () => {
    const param: PLCParameter = { id: "forming_light", label: "Forming Light", kind: "analog", value: 950, status: "normal", accentHex: "#43d8f1" };
    usePLCStore.getState().updateFromPLC([param], { ...DEFAULT_OUTPUTS });
    expect(channel("quality_light")).toMatchObject({ available: false, value: null, history: [] });
    expect(channel("forming_light").value).toBe(950);
  });

  it("maps only actual shared photoelectric, RFID and E-stop inputs", () => {
    ingest(parsePLCPayload({ boardA_photoelectric_sensor: 0, boardA_rfid_authorized_user: 1, system_was_in_emergency_stop_state: 1 }));
    expect(channel("quality_optical")).toMatchObject({ value: 0, sourceId: "photoE", shared: true });
    expect(channel("intake_rfid")).toMatchObject({ value: 1, sourceId: "operator_rfid", shared: true });
    expect(channel("pkg_estop")).toMatchObject({ value: 1, sourceId: "system_emergency_stop", shared: true });
  });

  it("keeps RFID unknown across unrelated partial frames", () => {
    const first = parsePLCPayload({ boardA_ph_sensor: 7 });
    vi.advanceTimersByTime(100);
    const second = parsePLCPayload({ boardA_voltage_pot_1: 4.31 }, first);
    ingest(second);
    expect(second.params.find((param) => param.id === "operator_rfid")?.placeholder).toBe(true);
    expect(channel("intake_rfid").available).toBe(false);
  });

  it("shows received RFID separately from the existing operational latch", () => {
    const first = parsePLCPayload({ boardA_rfid_authorized_user: 1 });
    vi.advanceTimersByTime(100);
    const second = parsePLCPayload({ boardA_rfid_authorized_user: 0 }, first);
    ingest(second);
    expect(second.outputs.rfidAuthorized).toBe(true);
    expect(channel("intake_rfid").value).toBe(0);
  });

  it("retains last received values with a stale label and never generates timer history", () => {
    ingest(parsePLCPayload({ boardB_esp32_pressure: 71 }));
    vi.advanceTimersByTime(PLC_TELEMETRY_STALE_MS + 1);
    expect(channel("forming_pressure")).toMatchObject({ value: 71, state: "stale", history: [71] });
    expect(usePLCStore.getState().historyVoltage).toEqual([]);
  });

  it("keeps old per-channel timestamps and history across merged unrelated packets", () => {
    const raw = { boardA_voltage_pot_1: 4.31, boardA_current_pot: 4.01 };
    const first = parsePLCPayload(raw, null, { keyReceivedAt: { boardA_voltage_pot_1: 100_000, boardA_current_pot: 100_000 } });
    ingest(first);
    vi.advanceTimersByTime(PLC_TELEMETRY_STALE_MS + 1);
    const next = parsePLCPayload({ ...raw, boardA_current_pot: 4.25 }, first, { keyReceivedAt: { boardA_voltage_pot_1: 100_000, boardA_current_pot: Date.now() } });
    ingest(next);
    expect(channel("voltage")).toMatchObject({ state: "stale", value: 4.31, history: [4.31] });
    expect(channel("current")).toMatchObject({ state: "live", value: 4.25, history: [4.01, 4.25] });
  });

  it("does not call normalized auxiliary-pot input GPS distance", () => {
    ingest(parsePLCPayload({ boardA_voltage_pot_2: 2.5 }));
    const reading = channel("intake_gps");
    expect(reading).toMatchObject({ value: 50, sourceLabel: "Auxiliary input", shared: true });
    expect(reading.param).toMatchObject({ label: "Auxiliary input", unit: "", status: "normal" });
  });

  it("keeps shared distance and auxiliary inputs informational across the sensor monitor mappings", () => {
    ingest(parsePLCPayload({ boardB_esp32_distance_cm: 12, boardA_voltage_pot_2: .49 }));
    for (const id of ["quality_lidar", "intake_lidar"]) {
      expect(channel(id)).toMatchObject({ value: 12, sourceLabel: "Shared distance input", shared: true });
      expect(channel(id).param).toMatchObject({ unit: "cm", status: "normal" });
    }
    for (const id of ["intake_gps", "dispatch_gps"]) {
      expect(channel(id).value).toBeCloseTo(9.8);
      expect(channel(id).param).toMatchObject({ label: "Auxiliary input", unit: "", status: "normal" });
    }
  });

  it("does not retain obsolete generic critical classification from an upstream mapped input", () => {
    const state = parsePLCPayload({ boardB_esp32_distance_cm: 12 });
    state.params.find((param) => param.id === "quality_lidar")!.status = "critical";
    ingest(state);
    expect(channel("quality_lidar").param?.status).toBe("normal");
  });
});
