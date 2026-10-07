"use no memo";
import { useMemo } from "react";
import { Activity, ArrowUpRight, RotateCcw, X } from "lucide-react";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";
import { isSensorLive } from "../../stores/digitalTwinSimulation";
import { STAGE_CONFIGS } from "./digitalTwinLayout";
import { STAGE_NAMES } from "./twinPresentation";
import "./sensor-monitor.css";

const ESTOP_SENSOR_IDS = ["forming_estop", "mixing_estop", "pkg_estop"];

/** History is sourced from the twin store; no invented trend or missing-value zero. */
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
  return <svg className="sensor-monitor__trend" viewBox="0 0 48 18" aria-hidden="true"><path d={points} /></svg>;
}

/** The store mutates readings in place and publishes a throttled UI tick. */
export default function SensorHUD({ onClose }: { onClose?: () => void }) {
  const tick = useDigitalTwinStore((state) => state.tick);
  const activeStage = useSceneSelectionStore((state) => state.selectedStageId);
  const toggleStage = useSceneSelectionStore((state) => state.toggle);
  const clearStage = useSceneSelectionStore((state) => state.clear);
  const snapshot = useMemo(() => {
    // The tick is the publication boundary for the mutable sensor arrays.
    const { stages, sensorHistories } = useDigitalTwinStore.getState();
    const groups = STAGE_CONFIGS.map((config) => {
      const stage = stages.find((candidate) => candidate.id === config.id);
      const configured = config.sensorConfigs;
      const extra = stage?.sensors.filter((sensor) => !configured.some((item) => item.sensorId === sensor.sensorId)) ?? [];
      return {
        id: config.id,
        sensors: [...configured, ...extra].filter((sensor) => sensor.type !== "emergency_stop").map((definition) => {
          const reading = stage?.sensors.find((sensor) => sensor.sensorId === definition.sensorId);
          const value = reading?.value;
          const available = typeof value === "number" && Number.isFinite(value);
          return {
            ...definition,
            label: reading?.label ?? definition.label,
            value: available ? value : null,
            unit: reading?.unit ?? definition.unit,
            status: available && reading ? reading.status : "unavailable",
            history: available ? [...(sensorHistories[definition.sensorId] ?? [])] : [],
            live: available && isSensorLive(definition.sensorId),
          };
        }),
      };
    });
    const interlocks = ESTOP_SENSOR_IDS.map((id) => stages.flatMap((stage) => stage.sensors).find((sensor) => sensor.sensorId === id));
    const available = interlocks.every((sensor) => sensor && Number.isFinite(sensor.value));
    const triggered = interlocks.some((sensor) => sensor && Number.isFinite(sensor.value) && sensor.status === "critical");
    const liveCount = interlocks.filter((sensor) => sensor && Number.isFinite(sensor.value) && isSensorLive(sensor.sensorId)).length;
    const source = liveCount === interlocks.length ? "Live" : liveCount === 0 ? "Sim" : "Mixed";
    return { groups, interlockStatus: triggered ? "Triggered" : available ? "Clear" : "Unavailable", interlockSource: available || triggered ? source : null, revision: tick };
  }, [tick]);

  return <section id="factory-sensor-monitor" className="sensor-monitor" aria-label="Sensor monitor">
    <div className="sensor-monitor__header">
      <h3><Activity size={16} aria-hidden="true" />Sensor monitor</h3>
      <div className="sensor-monitor__actions">
        {activeStage && <button type="button" aria-label="Return to whole line from sensor monitor" title="Return to whole line" onClick={clearStage}><RotateCcw size={14} /></button>}
        {onClose && <button type="button" aria-label="Close sensor monitor" onClick={onClose}><X size={16} /></button>}
      </div>
    </div>
    <p className="sensor-monitor__source-key">Sim = modeled values <span>·</span> Live = PLC input</p>
    <div className="sensor-monitor__interlocks" data-state={snapshot.interlockStatus.toLowerCase()}>
      <span>Process interlocks</span><strong>{snapshot.interlockStatus}</strong>
      {snapshot.interlockSource && <span className="sensor-monitor__source" title="Source of the three process emergency-stop inputs">{snapshot.interlockSource}</span>}
    </div>
    <div className="sensor-monitor__rows" tabIndex={0} role="region" aria-label="Factory sensor readings">
      {snapshot.groups.map((group) => <section className="sensor-monitor__stage" key={group.id} aria-label={`${STAGE_NAMES[group.id]} sensors`}>
        <h4>{STAGE_NAMES[group.id]}<ArrowUpRight size={12} aria-hidden="true" /></h4>
        {group.sensors.map((sensor) => {
          const status = sensor.status === "unavailable" ? "No reading" : sensor.status.charAt(0).toUpperCase() + sensor.status.slice(1);
          const value = sensor.value === null ? "—" : sensor.value.toFixed(sensor.max <= 1 ? 0 : sensor.value >= 100 ? 0 : 1);
          return <button type="button" key={sensor.sensorId} className="sensor-monitor__reading" data-channel={sensor.type} data-state={sensor.status}
            aria-pressed={activeStage === group.id}
            aria-label={`${STAGE_NAMES[group.id]} ${sensor.label}: ${value} ${sensor.unit}, ${status}, ${sensor.value === null ? "unavailable" : sensor.live ? "Live PLC input" : "Simulated value"}. Focus station`}
            onClick={() => toggleStage(group.id)}>
            <span className="sensor-monitor__identity"><span className="sensor-monitor__name">{sensor.label}</span><span className="sensor-monitor__meta">
              {sensor.value !== null && <span className="sensor-monitor__source" data-live={sensor.live}>{sensor.live ? "Live" : "Sim"}</span>}
              {sensor.status !== "normal" && <span className="sensor-monitor__status">{status}</span>}
            </span></span>
            <span className="sensor-monitor__value">{value}<small>{sensor.unit}</small></span>
            <MiniSparkline data={sensor.history} />
          </button>;
        })}
      </section>)}
    </div>
    <p className="sensor-monitor__hint">Select a reading to inspect its machine.</p>
  </section>;
}
