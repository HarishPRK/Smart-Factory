import { afterEach, describe, expect, it } from "vitest";
import type { ManufacturingStage, SensorReading, StageId, ThresholdEffect } from "../../types/digitalTwin";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { usePLCStore } from "../../stores/plcStore";
import { STAGE_CONFIGS } from "./digitalTwinLayout";
import { advanceProcessClock, fillingPose, sampleProduct, stationPhase } from "./productionCycle";
import { isTwinThresholdTriggered, readTwinAlarmState, summarizeTwinAlarm } from "./twinAlarmState";

function stageFixture(id: StageId): ManufacturingStage {
  const config = STAGE_CONFIGS.find((stage) => stage.id === id)!;
  return {
    id, label: config.label, description: config.description, position: [...config.position],
    sensors: config.sensorConfigs.map((sensor) => ({ ...sensor, value: sensor.nominal, status: "normal", timestamp: 1 })),
    outputDevices: [], status: "running", throughput: 0, qualityScore: 100,
    dwellTimeSec: config.dwellTimeSec, thresholdEffects: config.thresholdEffects.map((effect) => ({ ...effect })),
  };
}
function sensorIn(stage: ManufacturingStage, id: string): SensorReading {
  return stage.sensors.find((sensor) => sensor.sensorId === id)!;
}

afterEach(() => {
  useDigitalTwinStore.setState(useDigitalTwinStore.getInitialState(), true);
  usePLCStore.setState(usePLCStore.getInitialState(), true);
});

describe("Twin threshold presentation response", () => {
  it("keeps healthy production unaltered", () => {
    const stages = STAGE_CONFIGS.map((stage) => stageFixture(stage.id));
    expect(summarizeTwinAlarm(stages)).toMatchObject({ severity: "normal", lineStopped: false, speedLimit: 1, affectedStageIds: [], reasons: [] });
  });

  it.each([
    [49.9, "critical", true, 0], [50, "critical", true, 0],
    [50.1, "warning", false, 0.8], [60, "warning", false, 0.8],
    [60.1, "normal", false, 1], [65, "normal", false, 1],
  ] as const)("responds to fire %s as %s at both monitored machines", (value, severity, lineStopped, speedLimit) => {
    const cooling = stageFixture("curing"), packaging = stageFixture("packaging");
    sensorIn(cooling, "curing_fire").value = value;
    sensorIn(packaging, "pkg_fire").value = value;
    const alarm = summarizeTwinAlarm([cooling, packaging], { isSensorLive: () => true });
    expect(alarm).toMatchObject({ severity, lineStopped, speedLimit });
    if (severity === "normal") expect(alarm.reasons).toEqual([]);
    else expect(alarm.reasons.map((reason) => reason.sensorId)).toEqual(["curing_fire", "pkg_fire"]);
  });

  it("does not alarm or stop on an idle fingerprint scanner even if its old threshold effect is present", () => {
    const intake = stageFixture("intake"), dispatch = stageFixture("dispatch");
    for (const stage of [intake, dispatch]) {
      const fingerprint = stage.sensors.find((sensor) => sensor.type === "fingerprint")!;
      fingerprint.value = 0;
      fingerprint.status = "critical";
      const obsoleteEffect: ThresholdEffect = {
        sensorId: fingerprint.sensorId, condition: "below_critical", effect: "emergency_stop", description: "Old scanner alarm",
      };
      stage.thresholdEffects.push(obsoleteEffect);
      expect(isTwinThresholdTriggered(fingerprint, obsoleteEffect)).toBe(false);
    }
    expect(summarizeTwinAlarm([intake, dispatch])).toMatchObject({ severity: "normal", lineStopped: false, speedLimit: 1, reasons: [] });
    expect(summarizeTwinAlarm([intake, dispatch], { hardwareEmergencyActive: true }).lineStopped).toBe(true);
  });

  it("halts production for a stop configured at the pressure warning boundary", () => {
    const stage = stageFixture("forming");
    sensorIn(stage, "forming_pressure").value = 50;
    expect(summarizeTwinAlarm([stage])).toMatchObject({ severity: "critical", lineStopped: true, speedLimit: 0, affectedStageIds: ["forming"] });
  });

  it("honors a live pressure emergency threshold despite the shared simulator's softer status", () => {
    const stage = stageFixture("forming");
    stage.status = "warning";
    sensorIn(stage, "forming_pressure").value = 20;
    const alarm = summarizeTwinAlarm([stage], { isSensorLive: (id) => id === "forming_pressure" });
    expect(alarm).toMatchObject({ lineStopped: true, source: "live", speedLimit: 0 });
    expect(alarm.reasons[0]).toMatchObject({ sensorId: "forming_pressure", source: "live", description: "Pressure critically low — emergency stop" });
  });

  it("uses the sensor effect rather than stopping on any critical reading", () => {
    const stage = stageFixture("quality");
    sensorIn(stage, "quality_lidar").value = 25;
    expect(summarizeTwinAlarm([stage], { isSensorLive: () => false })).toMatchObject({ severity: "critical", lineStopped: false, speedLimit: 1 });
  });

  it("does not apply modeled bottle dimensional thresholds to shared received board readings", () => {
    const intake = stageFixture("intake"), quality = stageFixture("quality"), dispatch = stageFixture("dispatch");
    sensorIn(intake, "intake_gps").value = 9.8;
    sensorIn(dispatch, "dispatch_gps").value = 9.8;
    sensorIn(intake, "intake_lidar").value = 12;
    const lidar = sensorIn(quality, "quality_lidar");
    lidar.value = 12;
    lidar.status = "critical"; // Obsolete simulator classification must not leak.
    for (const effect of quality.thresholdEffects.filter((effect) => effect.sensorId === lidar.sensorId)) {
      expect(isTwinThresholdTriggered(lidar, effect, true)).toBe(false);
    }
    expect(summarizeTwinAlarm([intake, quality, dispatch], { isSensorLive: () => true })).toMatchObject({ severity: "normal", lineStopped: false, speedLimit: 1, reasons: [] });
  });

  it("still honors physical hazards while shared uncalibrated distance remains informational", () => {
    const quality = stageFixture("quality"), curing = stageFixture("curing");
    sensorIn(quality, "quality_lidar").value = 12;
    sensorIn(curing, "curing_fire").value = 50;
    const alarm = summarizeTwinAlarm([quality, curing], { isSensorLive: () => true });
    expect(alarm).toMatchObject({ severity: "critical", lineStopped: true, speedLimit: 0 });
    expect(alarm.reasons.map((reason) => reason.sensorId)).toEqual(["curing_fire"]);
  });

  it("continues for an ordinary quality warning and slows only a configured slowdown", () => {
    const quality = stageFixture("quality");
    sensorIn(quality, "quality_lidar").value = 1.6;
    expect(summarizeTwinAlarm([quality])).toMatchObject({ severity: "warning", lineStopped: false, speedLimit: 1 });
    const forming = stageFixture("forming");
    sensorIn(forming, "forming_proximity").value = 0;
    expect(summarizeTwinAlarm([forming])).toMatchObject({ lineStopped: false, speedLimit: 0.8 });
  });

  it("stops on stage faults that do not have a mapped sensor reason", () => {
    const stage = stageFixture("packaging");
    stage.status = "faulted";
    expect(summarizeTwinAlarm([stage])).toMatchObject({ severity: "critical", lineStopped: true, source: "unknown", affectedStageIds: ["packaging"] });
  });

  it("places the actual E-stop cause ahead of propagated stage faults", () => {
    const stages = STAGE_CONFIGS.map((stage) => stageFixture(stage.id));
    stages.forEach((stage) => { stage.status = "faulted"; });
    sensorIn(stages.find((stage) => stage.id === "packaging")!, "pkg_estop").value = 1;
    const alarm = summarizeTwinAlarm(stages, { isSensorLive: () => false });
    expect(alarm.reasons[0]).toMatchObject({ stageId: "packaging", sensorId: "pkg_estop", source: "sim" });
    expect(alarm.source).toBe("sim");
  });

  it("qualifies only triggered causes as live, simulated, or mixed", () => {
    const forming = stageFixture("forming"), mixing = stageFixture("mixing");
    sensorIn(forming, "forming_pressure").value = 40;
    const options = { isSensorLive: (id: string) => id === "forming_pressure" || id === "mixing_orp" };
    expect(summarizeTwinAlarm([forming, mixing], options).source).toBe("live");
    sensorIn(mixing, "mixing_ph").value = 12;
    expect(summarizeTwinAlarm([forming, mixing], options).source).toBe("mixed");
  });

  it("rejects nonfinite readings and missing sensor references without inventing a breach", () => {
    const stage = stageFixture("forming");
    const pressure = sensorIn(stage, "forming_pressure");
    pressure.value = Number.NaN;
    pressure.status = "critical";
    stage.thresholdEffects.push({ sensorId: "missing", condition: "above_critical", effect: "stop", description: "Missing probe" });
    expect(summarizeTwinAlarm([stage])).toMatchObject({ severity: "normal", lineStopped: false });
    pressure.value = Infinity;
    expect(summarizeTwinAlarm([stage]).lineStopped).toBe(false);
  });

  it("evaluates above and below critical boundaries inclusively with the configured direction", () => {
    const sensor = sensorIn(stageFixture("forming"), "forming_pressure");
    sensor.value = 30;
    const effect = (condition: ThresholdEffect["condition"]): ThresholdEffect => ({ sensorId: sensor.sensorId, condition, effect: "stop", description: "Test" });
    expect(isTwinThresholdTriggered(sensor, effect("below_critical"))).toBe(true);
    expect(isTwinThresholdTriggered(sensor, effect("below_warning"))).toBe(false);
    expect(isTwinThresholdTriggered(sensor, effect("above_critical"))).toBe(false);
    sensor.nominal = 5; sensor.warningThreshold = 7; sensor.criticalThreshold = 9; sensor.value = 9;
    expect(isTwinThresholdTriggered(sensor, effect("above_critical"))).toBe(true);
    expect(isTwinThresholdTriggered(sensor, effect("above_warning"))).toBe(false);
    expect(isTwinThresholdTriggered(sensor, effect("below_critical"))).toBe(false);
  });

  it("distinguishes an annunciator light from a dedicated emergency input", () => {
    expect(summarizeTwinAlarm([], { hardwareAlarmActive: true })).toMatchObject({ severity: "warning", lineStopped: false, source: "live" });
    expect(summarizeTwinAlarm([], { hardwareEmergencyActive: true })).toMatchObject({ severity: "critical", lineStopped: true, source: "live" });
  });

  it("reads in-place stage mutations immediately without waiting for a UI tick", () => {
    const stage = stageFixture("forming");
    useDigitalTwinStore.setState({ stages: [stage], tick: 7 });
    expect(readTwinAlarmState().lineStopped).toBe(false);
    sensorIn(stage, "forming_pressure").value = 20;
    expect(useDigitalTwinStore.getState().tick).toBe(7);
    expect(readTwinAlarmState().lineStopped).toBe(true);
    sensorIn(stage, "forming_pressure").value = 65;
    expect(readTwinAlarmState().lineStopped).toBe(false);
  });

  it("responds to a dedicated PLC E-stop before the next simulation tick and ignores placeholders", () => {
    usePLCStore.setState({ params: [{ id: "system_emergency_stop", label: "E-stop", kind: "digital", active: true, accentHex: "#f00", status: "critical" }] });
    expect(readTwinAlarmState().lineStopped).toBe(true);
    usePLCStore.setState({ params: [{ id: "system_emergency_stop", label: "E-stop", kind: "digital", active: true, placeholder: true, accentHex: "#f00", status: "critical" }] });
    expect(readTwinAlarmState().lineStopped).toBe(false);
  });

  it("freezes bottles, filling and robot phase at the same point, then resumes after recovery", () => {
    const stage = stageFixture("forming");
    const start = 34;
    const priorProduct = sampleProduct(start), priorFilling = fillingPose(start), priorRobotPhase = stationPhase(start, "packaging");
    sensorIn(stage, "forming_pressure").value = 20;
    let time = start;
    for (let frame = 0; frame < 120; frame++) time = advanceProcessClock(time, 1 / 60, true, 1, summarizeTwinAlarm([stage]));
    expect(time).toBe(start);
    expect(sampleProduct(time)).toEqual(priorProduct);
    expect(fillingPose(time)).toEqual(priorFilling);
    expect(stationPhase(time, "packaging")).toBe(priorRobotPhase);
    sensorIn(stage, "forming_pressure").value = 65;
    time = advanceProcessClock(time, 1 / 60, true, 1, summarizeTwinAlarm([stage]));
    expect(time).toBeGreaterThan(start);
    expect(fillingPose(time).fill).toBeGreaterThan(priorFilling.fill);
  });

  it("caps configured slowdown without applying it twice or losing the operator speed", () => {
    const forming = stageFixture("forming");
    sensorIn(forming, "forming_proximity").value = 0;
    const alarm = summarizeTwinAlarm([forming]);
    const alreadySlowed = advanceProcessClock(10, 0.05, true, 1.6, alarm, 2);
    expect(alreadySlowed).toBeCloseTo(10 + 0.05 * 1.6 * 1.8);
    expect(advanceProcessClock(10, 0.05, true, 2, alarm, 2)).toBeCloseTo(alreadySlowed);
    expect(advanceProcessClock(10, 0.05, false, 2, alarm, 2)).toBe(10);
  });
});
