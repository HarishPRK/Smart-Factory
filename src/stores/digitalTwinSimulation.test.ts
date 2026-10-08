import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePLCPayload } from "../services/plcService";
import { readTwinAlarmState } from "../components/factory3d/twinAlarmState";
import { useDigitalTwinStore } from "./digitalTwinStore";
import { usePLCStore } from "./plcStore";
import { setDigitalTwinPLCFeed, startDigitalTwinSim, stopDigitalTwinSim } from "./digitalTwinSimulation";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  vi.spyOn(Math, "random").mockReturnValue(.5);
});

afterEach(() => {
  stopDigitalTwinSim();
  const blank = parsePLCPayload({});
  setDigitalTwinPLCFeed([], blank.outputs, "none");
  useDigitalTwinStore.setState(useDigitalTwinStore.getInitialState(), true);
  usePLCStore.setState(usePLCStore.getInitialState(), true);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function receiveBoard(fire = 65) {
  const plc = parsePLCPayload({
    boardA_voltage_pot_1: 4.31, boardA_current_pot: 4.01,
    boardA_voltage_pot_2: .49, boardB_esp32_distance_cm: 12,
    boardB_esp32_finger_match: 0, boardA_rfid_authorized_user: 1,
    boardB_analog_8ch_b_fire_sensor: fire,
  });
  usePLCStore.getState().updateFromPLC(plc.params, plc.outputs, { source: "plc", receivedAt: Date.now() });
  setDigitalTwinPLCFeed(plc.params, plc.outputs, "plc");
}

describe("Shared board readings driving the factory twin", () => {
  it("keeps ordinary received distance and auxiliary input out of defect effects, lighting and production stops", () => {
    receiveBoard();
    startDigitalTwinSim();
    vi.advanceTimersByTime(100);
    const twin = useDigitalTwinStore.getState();
    const inspection = twin.stages.find((stage) => stage.id === "quality")!;
    expect(inspection.status).toBe("running");
    expect(inspection.qualityScore).toBe(100);
    expect(inspection.sensors.find((sensor) => sensor.sensorId === "quality_lidar")).toMatchObject({ value: 12, status: "normal" });
    for (const stage of twin.stages) {
      for (const sensor of stage.sensors.filter((sensor) => sensor.type === "gps")) {
        expect(sensor.value).toBeCloseTo(9.8);
        expect(sensor.status).toBe("normal");
      }
    }
    expect(twin.conveyorSpeedMultiplier).toBe(1);
    expect(readTwinAlarmState()).toMatchObject({ severity: "normal", lineStopped: false, speedLimit: 1, reasons: [] });
  });

  it("preserves a real low-fire-input safety stop with those same shared board readings", () => {
    receiveBoard(50);
    startDigitalTwinSim();
    vi.advanceTimersByTime(100);
    const alarm = readTwinAlarmState();
    expect(alarm).toMatchObject({ severity: "critical", lineStopped: true, speedLimit: 0 });
    expect(alarm.reasons.some((reason) => reason.sensorId === "curing_fire" && reason.stopRequired)).toBe(true);
    expect(alarm.reasons.some((reason) => reason.sensorId === "quality_lidar")).toBe(false);
  });
});
