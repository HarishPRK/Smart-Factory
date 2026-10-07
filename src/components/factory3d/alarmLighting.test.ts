import { describe, expect, it } from "vitest";
import type { ManufacturingStage, StageId } from "../../types/digitalTwin";
import { STAGE_CONFIGS } from "./digitalTwinLayout";
import { summarizeTwinAlarm } from "./twinAlarmState";
import { alarmPulse, maintenanceHazardActive, maintenanceTarget } from "./alarmLighting";

function stageFixture(id: StageId): ManufacturingStage {
  const config = STAGE_CONFIGS.find((stage) => stage.id === id)!;
  return {
    id, label: config.label, description: config.description, position: [...config.position],
    sensors: config.sensorConfigs.map((sensor) => ({ ...sensor, value: sensor.nominal, status: "normal", timestamp: 1 })),
    outputDevices: [], status: "running", throughput: 0, qualityScore: 100,
    dwellTimeSec: config.dwellTimeSec, thresholdEffects: [...config.thresholdEffects],
  };
}

function setReading(stage: ManufacturingStage, id: string, value: number) {
  stage.sensors.find((sensor) => sensor.sensorId === id)!.value = value;
}

describe("Alarm light and maintenance presentation policy", () => {
  it("leaves healthy lighting off", () => {
    expect(alarmPulse("normal", 2.3, false)).toBe(0);
    expect(alarmPulse("normal", 2.3, true)).toBe(0);
  });

  it("uses bounded gentle pulses for warning and critical signals", () => {
    for (const severity of ["warning", "critical"] as const) {
      const samples = Array.from({ length: 600 }, (_, i) => alarmPulse(severity, i / 60, false));
      expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.55);
      expect(Math.max(...samples)).toBeLessThanOrEqual(1);
      expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.4);
    }
  });

  it("retains a steady visible signal with reduced motion", () => {
    for (const severity of ["warning", "critical"] as const) {
      const samples = [0, 0.1, 1.3, 10, 25].map((seconds) => alarmPulse(severity, seconds, true));
      expect(new Set(samples).size).toBe(1);
      expect(samples[0]).toBeGreaterThan(0);
      expect(samples[0]).toBeLessThanOrEqual(1);
    }
  });

  it("does not dispatch illustrated maintenance for quality-only critical readings", () => {
    const quality = stageFixture("quality");
    setReading(quality, "quality_lidar", 25);
    const alarm = summarizeTwinAlarm([quality]);
    expect(alarm.severity).toBe("critical");
    expect(maintenanceTarget(alarm)).toBeNull();
    expect(maintenanceHazardActive(alarm, [quality])).toBe(false);
  });

  it("targets the originating stop sensor ahead of faults propagated across other machines", () => {
    const intake = stageFixture("intake"), packaging = stageFixture("packaging");
    intake.status = "faulted";
    packaging.status = "faulted";
    setReading(packaging, "pkg_estop", 1);
    const alarm = summarizeTwinAlarm([intake, packaging]);
    expect(maintenanceTarget(alarm)).toBe("packaging");
  });

  it("falls back to the faulted equipment when no stop sensor is available", () => {
    const forming = stageFixture("forming");
    forming.status = "faulted";
    expect(maintenanceTarget(summarizeTwinAlarm([forming]))).toBe("forming");
  });

  it("permits exterior panel inspection for a pressure fault without treating it as a hazard", () => {
    const forming = stageFixture("forming");
    setReading(forming, "forming_pressure", 20);
    const alarm = summarizeTwinAlarm([forming]);
    expect(maintenanceTarget(alarm)).toBe("forming");
    expect(maintenanceHazardActive(alarm, [forming])).toBe(false);
  });

  it("does not turn an unrelated gas warning into a hazardous pressure-stop response", () => {
    const forming = stageFixture("forming"), curing = stageFixture("curing");
    setReading(forming, "forming_pressure", 40);
    setReading(curing, "curing_mq", 350);
    const alarm = summarizeTwinAlarm([curing, forming]);
    expect(maintenanceTarget(alarm)).toBe("forming");
    expect(maintenanceHazardActive(alarm, [curing, forming])).toBe(false);
  });

  it.each([
    ["curing", "curing_fire", 50],
    ["curing", "curing_mq", 600],
    ["packaging", "pkg_estop", 1],
  ] as const)("keeps %s %s response in assessment mode rather than a repair posture", (stageId, sensorId, value) => {
    const stage = stageFixture(stageId);
    setReading(stage, sensorId, value);
    const alarm = summarizeTwinAlarm([stage]);
    expect(alarm.lineStopped).toBe(true);
    expect(maintenanceHazardActive(alarm, [stage])).toBe(true);
  });

  it("recognizes a dedicated hardware E-stop without pretending to know its station", () => {
    const alarm = summarizeTwinAlarm([], { hardwareEmergencyActive: true });
    expect(maintenanceTarget(alarm)).toBeNull();
    expect(maintenanceHazardActive(alarm, [])).toBe(true);
  });
});
