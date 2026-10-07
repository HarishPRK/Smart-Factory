"use no memo";
import { useMemo } from "react";
import { Activity, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { usePLCStore } from "../../stores/plcStore";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";
import { readSensorPLCChannel } from "../../services/receivedTelemetry";
import { STAGE_CONFIGS } from "./digitalTwinLayout";
import { STAGE_NAMES } from "./twinPresentation";

/** Samples are recorded at hardware receipt, never from the twin's model clock. */
function MiniSparkline({ data }: { data: number[] }) {
  const samples = data.slice(-24);
  const valid = samples.filter(Number.isFinite);
  if (valid.length < 2) return <span className="sensor-monitor__no-trend" aria-hidden="true" />;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const points = samples.map((value, index) => {
    if (!Number.isFinite(value)) return "";
    const x = (index / Math.max(1, samples.length - 1)) * 48;
    const y = max === min ? 9 : 16 - ((value - min) / (max - min)) * 14;
    const command = index === 0 || !Number.isFinite(samples[index - 1]) ? "M" : "L";
    return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  let lastIndex = samples.length - 1;
  while (!Number.isFinite(samples[lastIndex])) lastIndex -= 1;
  const lastY = max === min ? 9 : 16 - ((samples[lastIndex] - min) / (max - min)) * 14;
  return <svg className="sensor-monitor__trend" viewBox="0 0 48 18" aria-hidden="true">
    <path className="sensor-monitor__trend-reference" d="M0 17H48" />
    <path d={points} />
    <circle cx={(lastIndex / Math.max(1, samples.length - 1)) * 48} cy={lastY} r={1.6} />
  </svg>;
}

/** PLC values are independent from the illustrative machine simulation. */
export default function SensorHUD({ onClose }: { onClose?: () => void }) {
  // The UI clock also rechecks freshness if a hardware source falls silent.
  const tick = useDigitalTwinStore((state) => state.tick);
  const params = usePLCStore((state) => state.params);
  const telemetrySource = usePLCStore((state) => state.telemetrySource);
  const lastReceivedAt = usePLCStore((state) => state.lastReceivedAt);
  const receivedHistories = usePLCStore((state) => state.receivedHistories);
  const activeStage = useSceneSelectionStore((state) => state.selectedStageId);
  const toggleStage = useSceneSelectionStore((state) => state.toggle);
  const clearStage = useSceneSelectionStore((state) => state.clear);
  const snapshot = useMemo(() => {
    const plc = { params, telemetrySource, lastReceivedAt, receivedHistories };
    const groups = STAGE_CONFIGS.map((config) => {
      const channels = config.sensorConfigs.filter((sensor) => sensor.type !== "emergency_stop").map((definition) => {
        const channel = readSensorPLCChannel(definition.sensorId, plc);
        return {
          ...definition,
          ...channel,
          // The board's auxiliary pot is not a GPS receiver. Keep the actual
          // received source identity rather than inventing a factory sensor.
          label: definition.type === "gps" && channel.param ? channel.sourceLabel : definition.label,
          unit: channel.param?.unit ?? definition.unit,
          decimals: channel.param?.decimals ?? (definition.max <= 1 ? 0 : 1),
          status: channel.available ? channel.state === "stale" ? "stale" : channel.param?.status ?? "normal" : "unavailable",
        };
      });
      return {
        id: config.id,
        channelCount: channels.length,
        waitingCount: channels.filter((channel) => !channel.available).length,
        sensors: channels.filter((channel) => channel.available),
      };
    });
    const interlock = readSensorPLCChannel("system_emergency_stop", plc);
    const readings = groups.flatMap((group) => group.sensors);
    const uniqueSources = new Set(readings.map((sensor) => sensor.sourceId).filter(Boolean));
    const waitingCount = groups.reduce((total, group) => total + group.waitingCount, 0);
    return {
      groups, channelCount: readings.length + waitingCount, mappedCount: readings.length,
      inputCount: uniqueSources.size, waitingCount,
      stale: readings.some((sensor) => sensor.state === "stale"),
      interlockStatus: !interlock.available ? "Awaiting PLC" : interlock.state === "stale" ? "Last received" : interlock.value! >= 0.5 ? "Triggered" : "Clear",
      interlockDetail: interlock.available ? `System emergency-stop input ${interlock.value! >= 0.5 ? "active" : "clear"}${interlock.state === "stale" ? " at last receipt; current state unknown" : ""}` : "No system emergency-stop input received from PLC",
      interlockState: !interlock.available ? "unavailable" : interlock.state === "stale" ? "stale" : interlock.value! >= 0.5 ? "triggered" : "clear",
      revision: tick,
    };
  }, [tick, params, telemetrySource, lastReceivedAt, receivedHistories]);

  return <section id="factory-sensor-monitor" className="sensor-monitor" aria-label="Sensor monitor">
    <div className="sensor-monitor__header">
      <h3><Activity size={16} aria-hidden="true" />Sensor monitor<span className="sensor-monitor__channel-count" title="Configured mapped channels">{snapshot.channelCount}</span></h3>
      <div className="sensor-monitor__actions">
        {activeStage && <button type="button" aria-label="Return to whole line from sensor monitor" title="Return to whole line" onClick={clearStage}><RotateCcw size={14} /></button>}
        {onClose && <button type="button" aria-label="Close sensor monitor" onClick={onClose}><X size={16} /></button>}
      </div>
    </div>
    <div className="sensor-monitor__source-key" aria-label="Reading sources">
      <span data-live={snapshot.inputCount > 0 && !snapshot.stale} title="Distinct received PLC inputs; shared inputs may appear at several machines"><i aria-hidden="true" /><strong>{snapshot.inputCount}</strong> PLC inputs</span>
      <span className="sensor-monitor__source-legend">{snapshot.stale ? "Last received" : "Hardware only"}</span>
    </div>
    <div className="sensor-monitor__interlocks" data-state={snapshot.interlockState} title={snapshot.interlockDetail}>
      <ShieldCheck size={13} aria-hidden="true" /><span>Process interlock</span><strong>{snapshot.interlockStatus}</strong>
    </div>
    {snapshot.mappedCount === 0 && <p className="sensor-monitor__empty">Waiting for PLC readings.<br />Values appear when hardware reports them.</p>}
    <div className="sensor-monitor__rows" tabIndex={0} role="region" aria-label="Factory sensor readings">
      {snapshot.groups.map((group) => <section className="sensor-monitor__stage" key={group.id} data-selected={activeStage === group.id} aria-label={`${STAGE_NAMES[group.id]} sensors`}>
        <div className="sensor-monitor__stage-heading"><h4 aria-label={STAGE_NAMES[group.id]}><button type="button" onClick={() => toggleStage(group.id)} aria-pressed={activeStage === group.id} aria-label={`Inspect ${STAGE_NAMES[group.id]} from sensor monitor`}>{STAGE_NAMES[group.id]}</button></h4><span title="Received mapped channels / configured channels">{group.sensors.length} / {group.channelCount}</span></div>
        {group.sensors.map((sensor) => {
          const status = sensor.status === "stale" ? "Last received" : sensor.status.charAt(0).toUpperCase() + sensor.status.slice(1);
          const value = sensor.value === null ? "—" : sensor.value.toFixed(sensor.decimals);
          return <button type="button" key={sensor.sensorId} className="sensor-monitor__reading" data-channel={sensor.type} data-state={sensor.status}
            aria-pressed={activeStage === group.id}
            aria-label={`${STAGE_NAMES[group.id]} ${sensor.label}: ${value} ${sensor.unit}, ${status}, ${sensor.state === "stale" ? "last received PLC input" : "Live PLC input"}${sensor.shared ? ", shared input" : ""}. Focus station`}
            title={sensor.sourceLabel}
            onClick={() => toggleStage(group.id)}>
            <span className="sensor-monitor__identity"><span className="sensor-monitor__name">{sensor.label}</span><span className="sensor-monitor__meta">
              <span className="sensor-monitor__source" data-live={sensor.state === "live"}>{sensor.shared ? "Shared PLC" : "PLC"}</span>
              {sensor.status !== "normal" && <span className="sensor-monitor__status">{status}</span>}
            </span></span>
            <span className="sensor-monitor__value">{value}<small>{sensor.unit}</small></span>
            <MiniSparkline data={sensor.history} />
          </button>;
        })}
        {group.waitingCount > 0 && <p className="sensor-monitor__waiting"><span aria-hidden="true">—</span>{group.waitingCount} awaiting PLC</p>}
      </section>)}
    </div>
    <p className="sensor-monitor__hint">Select a reading to inspect its machine.</p>
  </section>;
}
