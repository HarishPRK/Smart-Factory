import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OUTPUTS, parsePLCPayload } from "../services/plcService";
import { readTwinAlarmState } from "../components/factory3d/twinAlarmState";
import { advanceProcessClock } from "../components/factory3d/productionCycle";
import { useDigitalTwinStore } from "./digitalTwinStore";
import { usePLCStore } from "./plcStore";
import { runDigitalTwinScenario, setDigitalTwinPLCFeed, startDigitalTwinSim, stopDigitalTwinSim } from "./digitalTwinSimulation";

const pressureReading = () => useDigitalTwinStore.getState().stages
  .find((stage) => stage.id === "forming")!.sensors.find((sensor) => sensor.sensorId === "forming_pressure")!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "debug").mockImplementation(() => undefined);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  setDigitalTwinPLCFeed([], DEFAULT_OUTPUTS);
  startDigitalTwinSim();
});

describe("Live fire and fingerprint presentation", () => {
  it.each([
    [50, "critical", true], [50.1, "warning", false], [60, "warning", false],
    [60.1, "normal", false], [65, "normal", false],
  ] as const)("applies fire %s as %s and keeps an idle fingerprint scanner from adding a fault", (value, severity, lineStopped) => {
    const feed = parsePLCPayload({ boardB_analog_8ch_b_fire_sensor: value, boardB_esp32_finger_match: 0 });
    setDigitalTwinPLCFeed(feed.params, { ...DEFAULT_OUTPUTS, rfidAuthorized: true }, "plc");
    vi.advanceTimersByTime(100);
    const stages = useDigitalTwinStore.getState().stages;
    for (const stage of stages) {
      for (const sensor of stage.sensors) {
        if (sensor.type === "fire") expect(sensor).toMatchObject({ value, status: severity });
        if (sensor.type === "fingerprint") expect(sensor).toMatchObject({ value: 0, status: "normal" });
      }
    }
    expect(stages.filter((stage) => stage.id === "intake" || stage.id === "dispatch").map((stage) => stage.status)).toEqual(["running", "running"]);
    const alarm = readTwinAlarmState();
    expect(alarm).toMatchObject({ severity, lineStopped });
    expect(alarm.reasons.some((reason) => reason.sensorId?.includes("fingerprint"))).toBe(false);
    const clock = advanceProcessClock(34, 0.05, true, 1, alarm);
    if (lineStopped) expect(clock).toBe(34);
    else expect(clock).toBeGreaterThan(34);
  });

  it("resumes the illustrated line as a fire reading recovers while fingerprint remains zero", () => {
    for (const [value, stopped] of [[50, true], [55, false], [65, false]] as const) {
      const feed = parsePLCPayload({ boardB_analog_8ch_b_fire_sensor: value, boardB_esp32_finger_match: 0 });
      setDigitalTwinPLCFeed(feed.params, { ...DEFAULT_OUTPUTS, rfidAuthorized: true }, "plc");
      vi.advanceTimersByTime(100);
      expect(readTwinAlarmState().lineStopped).toBe(stopped);
    }
  });

  it("preserves actual RFID gating and dedicated E-stop input with an idle scanner", () => {
    const idle = parsePLCPayload({ boardB_analog_8ch_b_fire_sensor: 65, boardB_esp32_finger_match: 0 });
    setDigitalTwinPLCFeed(idle.params, { ...DEFAULT_OUTPUTS, rfidAuthorized: false }, "plc");
    vi.advanceTimersByTime(100);
    expect(readTwinAlarmState()).toMatchObject({ severity: "normal", lineStopped: false });
    expect(useDigitalTwinStore.getState().conveyorSpeedMultiplier).toBe(0);

    const emergency = parsePLCPayload({ boardB_analog_8ch_b_fire_sensor: 65, boardB_esp32_finger_match: 0, system_was_in_emergency_stop_state: 1 });
    setDigitalTwinPLCFeed(emergency.params, { ...DEFAULT_OUTPUTS, rfidAuthorized: true }, "plc");
    vi.advanceTimersByTime(100);
    expect(readTwinAlarmState()).toMatchObject({ severity: "critical", lineStopped: true });
    expect(useDigitalTwinStore.getState().conveyorSpeedMultiplier).toBe(0);
  });
});

afterEach(() => {
  stopDigitalTwinSim();
  setDigitalTwinPLCFeed([], DEFAULT_OUTPUTS);
  useDigitalTwinStore.setState(useDigitalTwinStore.getInitialState(), true);
  usePLCStore.setState(usePLCStore.getInitialState(), true);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Offline pressure-fault maintenance demonstration", () => {
  it("holds a pressure fault long enough for the visual service response, then recovers production", () => {
    runDigitalTwinScenario("forming_pressure_fault");
    vi.advanceTimersByTime(8000);
    expect(pressureReading().value).toBeLessThan(30);
    const fault = readTwinAlarmState();
    expect(fault).toMatchObject({ lineStopped: true, severity: "critical", source: "sim" });
    expect(fault.reasons[0]).toMatchObject({ stageId: "forming", sensorId: "forming_pressure" });
    expect(advanceProcessClock(34, 0.05, true, 1, fault)).toBe(34);

    vi.advanceTimersByTime(29000);
    expect(pressureReading().value).toBeGreaterThan(50);
    expect(pressureReading().status).toBe("normal");
    expect(useDigitalTwinStore.getState().activeScenario).toBeNull();
    const recovered = readTwinAlarmState();
    expect(recovered).toMatchObject({ lineStopped: false, severity: "normal" });
    expect(advanceProcessClock(34, 0.05, true, 1, recovered)).toBeGreaterThan(34);
  });

  it("cannot override a live pressure value while the demonstration is requested", () => {
    setDigitalTwinPLCFeed([
      { id: "forming_pressure", label: "Pressure", kind: "analog", value: 72, accentHex: "#82b5f6", status: "normal" },
    ], { ...DEFAULT_OUTPUTS, rfidAuthorized: true });
    runDigitalTwinScenario("forming_pressure_fault");
    vi.advanceTimersByTime(8000);
    expect(pressureReading().value).toBe(72);
    expect(readTwinAlarmState()).toMatchObject({ lineStopped: false, severity: "normal" });
    vi.advanceTimersByTime(29000);
    expect(pressureReading().value).toBe(72);
    expect(readTwinAlarmState().lineStopped).toBe(false);
  });

  it("yields immediately if live PLC telemetry arrives during an active modeled fault", () => {
    runDigitalTwinScenario("forming_pressure_fault");
    vi.advanceTimersByTime(8000);
    expect(readTwinAlarmState().lineStopped).toBe(true);
    setDigitalTwinPLCFeed([
      { id: "forming_pressure", label: "Pressure", kind: "analog", value: 74, accentHex: "#82b5f6", status: "normal" },
    ], { ...DEFAULT_OUTPUTS, rfidAuthorized: true });
    vi.advanceTimersByTime(100);
    expect(pressureReading().value).toBe(74);
    expect(readTwinAlarmState().lineStopped).toBe(false);
  });
});
