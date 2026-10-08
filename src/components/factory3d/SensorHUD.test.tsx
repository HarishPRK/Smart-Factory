import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManufacturingStage } from "../../types/digitalTwin";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { usePLCStore } from "../../stores/plcStore";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";
import { DEFAULT_OUTPUTS, parsePLCPayload, type PLCState, type RawPLCPayload } from "../../services/plcService";
import { STAGE_CONFIGS } from "./digitalTwinLayout";
import SensorHUD from "./SensorHUD";

function configuredStages(): ManufacturingStage[] {
  return STAGE_CONFIGS.map((config) => ({
    id: config.id, label: config.label, description: config.description, position: config.position,
    sensors: config.sensorConfigs.map((sensor) => ({ ...sensor, value: sensor.nominal, status: "normal", timestamp: 1 })),
    outputDevices: [], status: "running", throughput: 0, qualityScore: 100,
    dwellTimeSec: config.dwellTimeSec, thresholdEffects: config.thresholdEffects,
  }));
}

let lastPayload: PLCState | null = null;
function receive(raw: RawPLCPayload) {
  const payload = parsePLCPayload(raw, lastPayload);
  lastPayload = payload;
  usePLCStore.getState().updateFromPLC(payload.params, payload.outputs, { source: "plc", receivedAt: Date.now() });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T18:00:00Z"));
  lastPayload = null;
  useSceneSelectionStore.getState().clear();
  useDigitalTwinStore.setState({ tick: 0, stages: configuredStages(), sensorHistories: { mixing_ph: [77, 78, 79] } });
  usePLCStore.setState({ params: [], telemetrySource: "none", lastReceivedAt: null, receivedHistories: {} });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useDigitalTwinStore.setState({ tick: 0, stages: [], sensorHistories: {} });
  usePLCStore.setState({ params: [], telemetrySource: "none", lastReceivedAt: null, receivedHistories: {} });
  useSceneSelectionStore.getState().clear();
});

describe("Hardware-only sensor monitor", () => {
  it("keeps seven station groups and folds model-only channels into truthful awaiting counts", () => {
    render(<SensorHUD />);
    const readings = screen.getByRole("region", { name: "Factory sensor readings" });
    for (const name of ["Material intake", "Blow molding", "Filling", "Cooling", "Inspection", "Packaging", "Dispatch"]) {
      expect(within(readings).getByRole("heading", { name })).toBeTruthy();
    }
    expect(readings.querySelectorAll(".sensor-monitor__reading")).toHaveLength(0);
    expect(screen.getByText("34", { selector: ".sensor-monitor__channel-count" })).toBeTruthy();
    expect(screen.getByText("Waiting for PLC readings.", { exact: false })).toBeTruthy();
    expect(screen.getByText("Awaiting PLC")).toBeTruthy();
    expect(screen.queryByText("Clear")).toBeNull();
    expect(screen.queryByText("Sim")).toBeNull();
    expect(screen.queryByText("7.0")).toBeNull();
    expect(readings.querySelectorAll("svg")).toHaveLength(0);
  });

  it("displays original received PLC values and excludes twin values and blended model histories", () => {
    receive({ boardA_ph_sensor: 16.2 });
    render(<SensorHUD />);
    const ph = screen.getByRole("button", { name: /Filling pH: 16.2.*Live PLC input/ });
    expect(within(ph).getByText("16.2")).toBeTruthy();
    expect(screen.queryByText("7.0")).toBeNull();
    expect(ph.querySelector("svg")).toBeNull();
    expect(screen.queryByRole("button", { name: /Syrup Tank:/ })).toBeNull();
    expect(within(screen.getByRole("region", { name: "Factory sensor readings" })).queryByText("Sim")).toBeNull();
  });

  it("identifies shared mapped pressure inputs without counting them as separate hardware sensors", () => {
    receive({ boardB_esp32_pressure: 150 });
    render(<SensorHUD />);
    const molding = screen.getByRole("button", { name: /Blow molding Pressure: 150.0.*shared input/ });
    const packaging = screen.getByRole("button", { name: /Packaging Pressure: 150.0.*shared input/ });
    expect(within(molding).getByText("Shared PLC")).toBeTruthy();
    expect(within(packaging).getByText("Shared PLC")).toBeTruthy();
    expect(screen.getByTitle("Distinct received PLC inputs; shared inputs may appear at several machines").textContent).toBe("1 PLC inputs");
  });

  it("uses shared selection for received rows, station headings and the whole-line action", () => {
    receive({ boardB_esp32_pressure: 65 });
    render(<SensorHUD />);
    const pressure = screen.getByRole("button", { name: /Blow molding Pressure:/ });
    fireEvent.click(pressure);
    expect(useSceneSelectionStore.getState().selectedStageId).toBe("forming");
    expect(pressure.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Return to whole line from sensor monitor" }));
    expect(useSceneSelectionStore.getState().selectedStageId).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Inspect Filling from sensor monitor" }));
    expect(useSceneSelectionStore.getState().selectedStageId).toBe("mixing");
  });

  it("refreshes on real receipts and retains only the hardware trend", () => {
    receive({ boardA_ph_sensor: 7.1 });
    render(<SensorHUD />);
    act(() => {
      vi.advanceTimersByTime(1000);
      receive({ boardA_ph_sensor: 7.4 });
    });
    const ph = screen.getByRole("button", { name: /Filling pH: 7.4.*Live PLC input/ });
    const history = ph.querySelectorAll("svg path")[1].getAttribute("d")!;
    expect(history).toContain("M0.00,16.00");
    expect(history).toContain("L48.00,2.00");
    expect(history.match(/[ML]/g)).toHaveLength(2);
    expect(ph.getAttribute("data-channel")).toBe("ph");
  });

  it("shows Clear or Triggered only from the actual dedicated emergency-stop input", () => {
    receive({ boardA_ph_sensor: 7.2 });
    render(<SensorHUD />);
    expect(screen.queryByText("Clear")).toBeNull();
    act(() => receive({ system_was_in_emergency_stop_state: 0 }));
    expect(screen.getByText("Clear")).toBeTruthy();
    act(() => receive({ system_was_in_emergency_stop_state: 1 }));
    expect(screen.getByText("Triggered")).toBeTruthy();
    expect(screen.queryByText("Sim")).toBeNull();
  });

  it.each([
    [65, "normal", "Normal"],
    [60, "warning", "Warning"],
    [50, "critical", "Critical"],
  ] as const)("shows the received fire reading %s in its correct band while fingerprint zero stays idle", (value, state, label) => {
    receive({
      boardB_analog_8ch_b_fire_sensor: value,
      boardB_esp32_finger_match: 0,
      system_was_in_emergency_stop_state: 0,
    });
    render(<SensorHUD />);

    for (const station of ["Cooling", "Packaging"]) {
      const fire = screen.getByRole("button", { name: `${station} Fire: ${value} , ${label}, Live PLC input, shared input. Focus station` });
      expect(fire.getAttribute("data-state")).toBe(state);
      expect(within(fire).getByText(String(value))).toBeTruthy();
      expect(within(fire).getByText("Shared PLC")).toBeTruthy();
      if (state !== "normal") expect(within(fire).getByText(label)).toBeTruthy();
    }

    for (const station of ["Material intake", "Dispatch"]) {
      const fingerprint = screen.getByRole("button", { name: `${station} Fingerprint: 0.0 , Normal, Live PLC input, shared input. Focus station` });
      expect(fingerprint.getAttribute("data-state")).toBe("normal");
      expect(within(fingerprint).queryByText("Critical")).toBeNull();
      expect(within(fingerprint).queryByText("Warning")).toBeNull();
    }
    expect(screen.getByText("Clear")).toBeTruthy();
    expect(screen.queryByText("Triggered")).toBeNull();
  });

  it("labels retained real readings as last received after silence and no longer asserts a clear interlock", () => {
    receive({ boardA_ph_sensor: 7.2, system_was_in_emergency_stop_state: 0 });
    render(<SensorHUD />);
    act(() => {
      vi.advanceTimersByTime(16000);
      useDigitalTwinStore.setState({ tick: 1 });
    });
    const ph = screen.getByRole("button", { name: /Filling pH: 7.2.*Last received.*last received PLC input/ });
    expect(ph.getAttribute("data-state")).toBe("stale");
    expect(screen.queryByText("Clear")).toBeNull();
    expect(screen.getByTitle(/current state unknown/)).toBeTruthy();
  });

  it("shows ordinary shared distance and auxiliary values without critical or warning badges", () => {
    receive({ boardB_esp32_distance_cm: 12, boardA_voltage_pot_2: .49 });
    render(<SensorHUD />);
    for (const station of ["Material intake", "Inspection"]) {
      const reading = screen.getByRole("button", { name: `${station} LiDAR: 12.0 cm, Normal, Live PLC input, shared input. Focus station` });
      expect(reading.getAttribute("data-state")).toBe("normal");
    }
    for (const station of ["Material intake", "Dispatch"]) {
      const reading = screen.getByRole("button", { name: `${station} Auxiliary input: 9.8 , Normal, Live PLC input, shared input. Focus station` });
      expect(reading.getAttribute("data-state")).toBe("normal");
    }
    expect(screen.queryByText("Critical")).toBeNull();
    expect(screen.queryByText("Warning")).toBeNull();
  });

  it("never accepts the PLC service's mock samples as hardware telemetry", () => {
    const fake = parsePLCPayload({ boardA_ph_sensor: 8.9 });
    usePLCStore.getState().updateFromPLC(fake.params, { ...DEFAULT_OUTPUTS }, { source: "simulation", receivedAt: Date.now() });
    render(<SensorHUD />);
    expect(screen.queryByRole("button", { name: /Filling pH:/ })).toBeNull();
    expect(screen.queryByText("8.9")).toBeNull();
    expect(screen.queryByText("Clear")).toBeNull();
  });

  it("delegates closing to its host", () => {
    const close = vi.fn();
    render(<SensorHUD onClose={close} />);
    fireEvent.click(screen.getByRole("button", { name: "Close sensor monitor" }));
    expect(close).toHaveBeenCalledOnce();
  });
});
