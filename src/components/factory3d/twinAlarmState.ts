import type { ManufacturingStage, SensorReading, StageId, ThresholdEffect } from "../../types/digitalTwin";
import { isSensorLive } from "../../stores/digitalTwinSimulation";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { usePLCStore } from "../../stores/plcStore";
import { isInformationalPLCInput } from "../../services/receivedTelemetry";

export type TwinAlarmSeverity = "normal" | "warning" | "critical";
export type TwinAlarmSource = "live" | "sim" | "mixed" | "unknown";

export interface TwinAlarmReason {
  stageId?: StageId;
  sensorId?: string;
  label: string;
  description: string;
  source: Exclude<TwinAlarmSource, "mixed">;
  /** True for the originating stop condition, not another warning on that cell. */
  stopRequired?: boolean;
}

export interface TwinStageAlarm {
  severity: TwinAlarmSeverity;
  stopRequired: boolean;
  reasons: TwinAlarmReason[];
}

export interface TwinAlarmSummary {
  severity: TwinAlarmSeverity;
  lineStopped: boolean;
  /** A configured slowdown caps the existing speed; it is never applied twice. */
  speedLimit: 0 | 0.8 | 1;
  affectedStageIds: StageId[];
  stageAlarms: Partial<Record<StageId, TwinStageAlarm>>;
  /** Direct sensor causes precede propagated equipment faults. */
  reasons: TwinAlarmReason[];
  source: TwinAlarmSource;
}

export interface TwinAlarmOptions {
  isSensorLive?: (sensorId: string) => boolean;
  /** Dedicated E-stop input, rather than an annunciator lamp. */
  hardwareEmergencyActive?: boolean;
  /** An annunciator may indicate a locked gate; it does not itself halt the twin. */
  hardwareAlarmActive?: boolean;
}

const rank: Record<TwinAlarmSeverity, number> = { normal: 0, warning: 1, critical: 2 };
const stronger = (a: TwinAlarmSeverity, b: TwinAlarmSeverity): TwinAlarmSeverity => rank[a] >= rank[b] ? a : b;

/** Respect the configured direction and warning band, including inclusive boundaries. */
export function isTwinThresholdTriggered(sensor: SensorReading, effect: ThresholdEffect, livePLCInput = false): boolean {
  if (sensor.type === "fingerprint") return false;
  if (livePLCInput && isInformationalPLCInput(sensor.sensorId)) return false;
  const { value, nominal, warningThreshold: warning, criticalThreshold: critical } = sensor;
  if (![value, nominal, warning, critical].every(Number.isFinite)) return false;
  switch (effect.condition) {
    case "above_critical": return critical > nominal && value >= critical;
    case "above_warning": return warning > nominal && value >= warning && value < critical;
    case "below_critical": return critical < nominal && value <= critical;
    case "below_warning": return warning < nominal && value <= warning && value > critical;
  }
}

function readingSeverity(sensor: SensorReading): TwinAlarmSeverity {
  if (sensor.type === "fingerprint") return "normal";
  if (!Number.isFinite(sensor.value)) return "normal";
  if (sensor.criticalThreshold > sensor.nominal) {
    if (sensor.value >= sensor.criticalThreshold) return "critical";
    if (sensor.warningThreshold > sensor.nominal && sensor.value >= sensor.warningThreshold) return "warning";
  } else if (sensor.criticalThreshold < sensor.nominal) {
    if (sensor.value <= sensor.criticalThreshold) return "critical";
    if (sensor.warningThreshold < sensor.nominal && sensor.value <= sensor.warningThreshold) return "warning";
  }
  return "normal";
}

function alarmSource(reasons: readonly TwinAlarmReason[]): TwinAlarmSource {
  const known = new Set(reasons.map((reason) => reason.source).filter((source) => source !== "unknown"));
  return known.size > 1 ? "mixed" : known.has("live") ? "live" : known.has("sim") ? "sim" : "unknown";
}

/**
 * Presentation-only alarm response. Reads the supplied snapshot without mutations,
 * commands, latching, automatic sensor correction, or changes to Classic behavior.
 */
export function summarizeTwinAlarm(stages: readonly ManufacturingStage[], options: TwinAlarmOptions = {}): TwinAlarmSummary {
  const summary: TwinAlarmSummary = {
    severity: "normal", lineStopped: false, speedLimit: 1,
    affectedStageIds: [], stageAlarms: {}, reasons: [], source: "unknown",
  };
  const equipmentReasons: TwinAlarmReason[] = [];
  for (const stage of stages) {
    const alarm: TwinStageAlarm = { severity: "normal", stopRequired: stage.status === "faulted", reasons: [] };
    for (const sensor of stage.sensors) {
      if (!Number.isFinite(sensor.value)) continue;
      const livePLCInput = options.isSensorLive?.(sensor.sensorId) ?? false;
      if (livePLCInput && isInformationalPLCInput(sensor.sensorId)) continue;
      let severity = readingSeverity(sensor);
      const effects = stage.thresholdEffects.filter((effect) => effect.sensorId === sensor.sensorId && isTwinThresholdTriggered(sensor, effect, livePLCInput));
      const stop = effects.some((effect) => effect.effect === "stop" || effect.effect === "emergency_stop")
        || (sensor.type === "emergency_stop" && severity === "critical");
      if (stop) {
        alarm.stopRequired = true;
        // A stop configured at a warning boundary is a production fault.
        severity = "critical";
      }
      if (effects.some((effect) => effect.effect === "slowdown")) summary.speedLimit = 0.8;
      if (effects.length > 0) severity = stronger(severity, "warning");
      if (severity === "normal") continue;
      alarm.severity = stronger(alarm.severity, severity);
      const reason: TwinAlarmReason = {
        stageId: stage.id, sensorId: sensor.sensorId, label: sensor.label,
        description: effects.find((effect) => effect.effect === "stop" || effect.effect === "emergency_stop")?.description
          ?? effects[0]?.description ?? `${sensor.label} ${severity === "critical" ? "critical" : "warning"} threshold breached`,
        source: options.isSensorLive ? options.isSensorLive(sensor.sensorId) ? "live" : "sim" : "unknown",
        stopRequired: stop,
      };
      alarm.reasons.push(reason);
      summary.reasons.push(reason);
    }
    if (stage.status === "faulted") alarm.severity = "critical";
    else if (stage.status === "warning") alarm.severity = stronger(alarm.severity, "warning");
    if (alarm.severity === "normal") continue;
    if (alarm.reasons.length === 0 || (stage.status === "faulted" && !alarm.reasons.some((reason) => reason.stopRequired))) {
      const reason: TwinAlarmReason = {
        stageId: stage.id, label: stage.label,
        description: alarm.stopRequired ? `${stage.label} equipment fault` : `${stage.label} equipment warning`, source: "unknown", stopRequired: alarm.stopRequired,
      };
      alarm.reasons.push(reason);
      equipmentReasons.push(reason);
    }
    summary.stageAlarms[stage.id] = alarm;
    summary.affectedStageIds.push(stage.id);
    summary.severity = stronger(summary.severity, alarm.severity);
    summary.lineStopped ||= alarm.stopRequired;
  }
  if (options.hardwareEmergencyActive) {
    summary.lineStopped = true;
    summary.severity = "critical";
    summary.reasons.push({ sensorId: "system_emergency_stop", label: "E-stop", description: "PLC emergency-stop input active", source: "live", stopRequired: true });
  } else if (options.hardwareAlarmActive) {
    summary.severity = stronger(summary.severity, "warning");
    summary.reasons.push({ label: "PLC alarm indicator", description: "PLC alarm indicator active", source: "live" });
  }
  // Sensor reasons remain first so an E-stop propagated to all seven stages does
  // not falsely send maintenance to Material intake instead of the actual cause.
  summary.reasons.push(...equipmentReasons);
  if (summary.lineStopped) summary.speedLimit = 0;
  summary.source = alarmSource(summary.reasons);
  return summary;
}

/** Fresh frame-time adapter; stage arrays are mutated in place by the simulation. */
export function readTwinAlarmState(): TwinAlarmSummary {
  const plc = usePLCStore.getState();
  const emergencyInput = plc.params.find((param) => param.id === "system_emergency_stop" && !param.placeholder);
  return summarizeTwinAlarm(useDigitalTwinStore.getState().stages, {
    isSensorLive,
    hardwareEmergencyActive: emergencyInput?.active === true || (Number.isFinite(emergencyInput?.value) && (emergencyInput?.value ?? 0) >= 0.9),
    hardwareAlarmActive: plc.emergencyLightOn,
  });
}
