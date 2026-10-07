import type { TwinAlarmSeverity, TwinAlarmSummary } from "./twinAlarmState";
import type { ManufacturingStage, StageId } from "../../types/digitalTwin";

export const ALARM_LIGHT_COLORS = { warning: "#ffb94f", critical: "#ff5149" } as const;

/** Gentle, bounded annunciator pulses; reduced motion retains a steady signal. */
export function alarmPulse(severity: TwinAlarmSeverity, seconds: number, reducedMotion: boolean) {
  if (severity === "normal") return 0;
  if (reducedMotion) return 0.85;
  const frequency = severity === "critical" ? 1.1 : 0.65;
  return 0.55 + (Math.sin(seconds * Math.PI * 2 * frequency) * 0.5 + 0.5) * 0.45;
}

/** Prefer the originating stop sensor over equipment faults propagated by E-stop. */
export function maintenanceTarget(alarm: TwinAlarmSummary): StageId | null {
  if (!alarm.lineStopped) return null;
  return alarm.reasons.find((reason) => reason.stageId && reason.stopRequired)?.stageId
    ?? alarm.affectedStageIds.find((id) => alarm.stageAlarms[id]?.stopRequired)
    ?? null;
}

/** Hazard response remains an exterior assessment rather than a repair animation. */
export function maintenanceHazardActive(alarm: TwinAlarmSummary, stages: readonly ManufacturingStage[]) {
  return alarm.lineStopped && alarm.reasons.some((reason) => {
    if (!reason.stopRequired) return false;
    if (reason.sensorId === "system_emergency_stop") return true;
    const sensor = stages.find((stage) => stage.id === reason.stageId)?.sensors.find((reading) => reading.sensorId === reason.sensorId);
    return sensor && ["emergency_stop", "fire", "mq_gas"].includes(sensor.type);
  });
}
