import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, Box, Scan, RotateCcw, Maximize2, Minimize2, Layers3, SlidersHorizontal, X, Eye, Crosshair, Pause, Play } from "lucide-react";
import { useDigitalTwinData } from "../../hooks/useDigitalTwinData";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";
import { useSceneSettingsStore, type QualityTier } from "../../stores/sceneSettingsStore";
import { resetCameraView, setCameraTarget } from "./CameraController";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { DT_SCENARIOS, runDigitalTwinScenario } from "../../stores/digitalTwinSimulation";
import SensorHUD from "./SensorHUD";
import "./sensor-monitor-host.css";

import { STAGE_NAMES, TWIN_STATUS_COLORS } from "./twinPresentation";

interface Props {
  inspectorHost?: HTMLElement | null;
  isFullscreen: boolean;
  onFullscreen: () => void;
}

/** Presentation controls only. Nothing in this workbench sends a PLC command. */
export default function TwinWorkbench({ isFullscreen, onFullscreen, inspectorHost = null }: Props) {
  const data = useDigitalTwinData();
  const selected = useSceneSelectionStore((s) => s.selectedStageId);
  const clear = useSceneSelectionStore((s) => s.clear);
  const labels = useSceneSettingsStore((s) => s.labelsVisible);
  const setLabels = useSceneSettingsStore((s) => s.setLabels);
  const sensorMonitorOpen = useSceneSettingsStore((s) => s.sensorMonitorVisible);
  const setSensorMonitor = useSceneSettingsStore((s) => s.setSensorMonitor);
  const sensorMonitorTrigger = useRef<HTMLButtonElement>(null);
  const inspectorHeading = useRef<HTMLHeadingElement>(null);
  const previousSelection = useRef(selected);
  const quality = useSceneSettingsStore((s) => s.quality);
  const setQuality = useSceneSettingsStore((s) => s.setQuality);
  const extras = useSceneSettingsStore((s) => s.extrasEnabled);
  const setExtras = useSceneSettingsStore((s) => s.setExtras);
  const cctv = useSceneSettingsStore((s) => s.cctvEnabled);
  const setCCTV = useSceneSettingsStore((s) => s.setCCTV);
  const active = useDigitalTwinStore((s) => s.simulationActive);
  const speed = useDigitalTwinStore((s) => s.userSpeedMultiplier);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState("perspective");
  const showMonitor = sensorMonitorOpen && !settingsOpen && !selected;
  const stage = selected ? data.getStage(selected) : null;
  const running = data.stages.filter((s) => s.status === "running").length;
  const attention = data.stages.filter((s) => s.status === "faulted" || s.status === "warning" || s.status === "blocked").length;

  useEffect(() => {
    if (selected) inspectorHeading.current?.focus();
    else if (previousSelection.current) sensorMonitorTrigger.current?.focus();
    previousSelection.current = selected;
  }, [selected]);

  useEffect(() => {
    // Replacing a taller inspector must not leave the monitor's heading above the viewport.
    if (showMonitor) inspectorHost?.parentElement?.scrollTo({ top: 0, behavior: "instant" });
  }, [showMonitor, inspectorHost]);

  const cameraView = (next: string) => {
    // Clearing selection resets the scene camera; let its effect
    // finish before applying a requested projection on the following frame.
    clear();
    setView(next);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (next === "top") setCameraTarget([0, 49, 0.01], [0, 0, 0]);
      else if (next === "front") setCameraTarget([0, 13, 43], [0, 0, 0]);
      else resetCameraView();
    }));
  };

  const closeMonitor = () => {
    setSensorMonitor(false);
    sensorMonitorTrigger.current?.focus();
  };
  const monitor = showMonitor ? <SensorHUD onClose={closeMonitor} /> : null;

  const inspector = stage && !settingsOpen && !showMonitor ? (<section className="twin-inspector" data-status={stage.status} aria-label={`${stage.label} inspector`}>
      <div className="twin-panel-title"><h3 ref={inspectorHeading} tabIndex={-1}>{STAGE_NAMES[stage.id]}</h3><button aria-label="Close stage inspector" onClick={clear}><X size={16} /></button></div>
      <div className="twin-inspector__source"><strong>Modeled process</strong><span>Available PLC inputs replace simulated sensor values.</span></div>
      <div className="twin-inspector__status"><span style={{ color: TWIN_STATUS_COLORS[stage.status] }}><i style={{ background: TWIN_STATUS_COLORS[stage.status] }} />{stage.status}</span><span>{stage.qualityScore.toFixed(0)}% estimated quality</span></div>
      <p>{stage.description}</p>
      <div className="twin-inspector__sensors">{stage.sensors.map((sensor) => <div key={sensor.sensorId}>
        <span>{sensor.label}</span><strong>{sensor.value.toFixed(sensor.max <= 1 ? 0 : 1)} <small>{sensor.unit}</small></strong>
      </div>)}</div>
      <div className="twin-inspector__devices">{stage.outputDevices.map((device) => <span key={device.deviceId}><i className={device.active ? "is-active" : ""} />{device.label}</span>)}</div>
      <button className="twin-return" onClick={() => cameraView("perspective")}><RotateCcw size={13} />Return to whole line</button>
    </section>) : null;

  return <>
    <div className="twin-heading">
      <div className="twin-heading__identity"><Box size={19} /><h2>Factory digital twin</h2></div>
      <div className="twin-heading__meta"><span className="twin-source"><span />{active ? "Process simulation" : "Simulation paused"}</span><button ref={sensorMonitorTrigger} type="button" className="twin-monitor-toggle" aria-label="Sensor monitor" aria-expanded={showMonitor} aria-controls="factory-sensor-monitor" onClick={() => { if (!showMonitor) clear(); setSensorMonitor(!showMonitor); setSettingsOpen(false); }}><Activity size={14} /><span>Sensor monitor</span></button></div>
    </div>

    <div className="twin-toolbar">
      <div className="twin-view-switch" role="group" aria-label="Camera view">
        <button aria-pressed={view === "perspective" && !selected} onClick={() => cameraView("perspective")}><Box size={14} />Perspective</button>
        <button aria-pressed={view === "top" && !selected} onClick={() => cameraView("top")}><Scan size={14} />Plan</button>
        <button aria-pressed={view === "front" && !selected} onClick={() => cameraView("front")}><Layers3 size={14} />Elevation</button>
      </div>
      <div className="twin-tool-group">
        <button title={active ? "Pause simulation" : "Resume simulation"} aria-label={active ? "Pause simulation" : "Resume simulation"} onClick={() => useDigitalTwinStore.setState({ simulationActive: !active })}>{active ? <Pause size={16} /> : <Play size={16} />}</button>
        <button title="Show stage labels" aria-label="Show stage labels" aria-pressed={labels} onClick={() => setLabels(!labels)}><Eye size={16} /></button>
        <button title="Display settings" aria-label="Display settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}><SlidersHorizontal size={16} /></button>
        <button title="Reset camera" aria-label="Reset camera" onClick={() => cameraView("perspective")}><RotateCcw size={16} /></button>
        <button title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={onFullscreen}>{isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
      </div>
    </div>

    {settingsOpen && <section className="twin-settings" aria-label="Display settings panel">
      <div className="twin-panel-title"><h3>Display settings</h3><button aria-label="Close display settings" onClick={() => setSettingsOpen(false)}><X size={16} /></button></div>
      <label htmlFor="twin-quality">Render quality</label>
      <select id="twin-quality" value={quality} onChange={(e) => setQuality(e.target.value as QualityTier)}>
        <option value="low">Efficient</option><option value="medium">Balanced</option><option value="high">High detail</option><option value="ultra">Ultra detail</option>
      </select>
      <p>Display settings affect the visualization only.</p>
      <div className="twin-settings__toggles">
        <label><input type="checkbox" checked={extras} onChange={(e) => setExtras(e.target.checked)} />Surrounding equipment</label>
        <label><input type="checkbox" checked={cctv} onChange={(e) => setCCTV(e.target.checked)} />CCTV & site details</label>
      </div>
      <details className="twin-simulation-settings"><summary>Simulation tools</summary>
        <label htmlFor="twin-speed">Conveyor speed <strong>{speed.toFixed(1)}×</strong></label>
        <input id="twin-speed" type="range" min="0.1" max="3" step="0.1" value={speed} onChange={(e) => useDigitalTwinStore.setState({ userSpeedMultiplier: Number(e.target.value) })} />
        <label htmlFor="twin-scenario">Test a scenario</label>
        <select id="twin-scenario" value={data.activeScenario ?? ""} onChange={(e) => { if (e.target.value) runDigitalTwinScenario(e.target.value); }}>
          <option value="">Choose scenario…</option>{DT_SCENARIOS.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.label}</option>)}
        </select>
        <p>Simulated process changes. No equipment commands are sent.</p>
      </details>
    </section>}

    {inspector && (inspectorHost ? createPortal(inspector, inspectorHost) : inspector)}
    {monitor && (inspectorHost ? createPortal(monitor, inspectorHost) : <div className="twin-monitor-overlay">{monitor}</div>)}

    <div className="twin-scene-footer">
      <div className="twin-legend"><span><i className="is-running" />{running} running</span><span><i className="is-attention" />{attention} need attention</span></div>
      <span className="twin-navigation-hint">Drag to orbit <b>·</b> Scroll to zoom</span>
      <button className="twin-fit" aria-label="Fit entire production line" onClick={() => cameraView("perspective")}><Crosshair size={15} />Fit line</button>
    </div>

  </>;
}
