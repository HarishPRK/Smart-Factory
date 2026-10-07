import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BadgeCheck, CircuitBoard, LockKeyhole, Radio } from "lucide-react";
import type { PLCParameter } from "../types";
import { usePLCContext } from "../context/PLCContext";
import { usePLCStore } from "../stores/plcStore";
import ThreePhaseMotorWidget from "./ThreePhaseMotorWidget";
import ParameterMicroviz from "./ParameterMicroviz";
import "../plc-instruments.css";

type FlashDir = "up" | "down" | null;
function useChangeFlash(value: number, range: number, threshold = 0.03): FlashDir {
  const [flash, setFlash] = useState<FlashDir>(null);
  const prevRef = useRef(value);
  useEffect(() => {
    const delta = value - prevRef.current;
    const significant = range > 0 ? Math.abs(delta) / range > threshold : Math.abs(delta) > 0.5;
    if (significant) {
      const dir: FlashDir = delta > 0 ? "up" : "down";
      prevRef.current = value;
      let applyRaf: number | null = null;
      const resetRaf = requestAnimationFrame(() => {
        setFlash(null);
        applyRaf = requestAnimationFrame(() => setFlash(dir));
      });
      const t = setTimeout(() => setFlash(null), 850);
      return () => {
        cancelAnimationFrame(resetRaf);
        if (applyRaf !== null) cancelAnimationFrame(applyRaf);
        clearTimeout(t);
      };
    }
    prevRef.current = value;
  }, [value, range, threshold]);
  return flash;
}
const STATUS = { normal: "Normal", warning: "Warning", critical: "Critical" };
const LABELS: Record<string, string> = { forming_pressure: "Pressure", forming_light: "Light", mixing_turbidity: "Turbidity", mixing_orp: "ORP", curing_mq: "MQ gas", photoE: "Photoelectric", metal: "Metal detection" };
const ORDER = ["voltage", "current", "relay", "ph", "forming_pressure", "curing_mq", "mixing_turbidity", "forming_light", "mixing_orp", "photoE", "metal"];

// Supported channels and engineering ranges mirror the parser in plcService.
// These are empty instrument faces, never mock samples or connection claims.
const EXPECTED_ANALOG: PLCParameter[] = [
  { id: "voltage", label: "Voltage", unit: "V", min: 0, max: 12, nominal: 5 },
  { id: "current", label: "Current", unit: "A", min: 0, max: 10, nominal: 6 },
  { id: "ph", label: "pH", unit: "", min: 0, max: 14, nominal: 7 },
  { id: "forming_pressure", label: "Forming pressure", unit: "bar", min: 0, max: 200, nominal: 65 },
  { id: "curing_mq", label: "Curing MQ gas", unit: "ppm", min: 0, max: 1000, nominal: 30 },
  { id: "mixing_turbidity", label: "Mixing turbidity", unit: "NTU", min: 0, max: 100, nominal: 15 },
  { id: "forming_light", label: "Forming light", unit: "lux", min: 0, max: 1000, nominal: 500 },
  { id: "mixing_orp", label: "Mixing ORP", unit: "mV", min: -500, max: 500, nominal: 200 },
].map((channel) => ({ ...channel, kind: "analog", status: "normal", accentHex: "#43d8f1", placeholder: true }));

const EXPECTED_DIGITAL: PLCParameter[] = [
  { id: "relay", label: "Relay", kind: "relay", status: "normal", accentHex: "#43d8f1", placeholder: true },
  { id: "photoE", label: "Photo-E", kind: "digital", status: "normal", accentHex: "#56cbbb", placeholder: true },
  { id: "metal", label: "Metal Det.", kind: "digital", status: "normal", accentHex: "#efb278", placeholder: true },
];

function hasReading(param: PLCParameter) {
  return !param.placeholder && typeof param.value === "number" && Number.isFinite(param.value);
}

function ControllerMap({ connected, hasSamples }: { connected: boolean; hasSamples: boolean }) {
  return <div className="pi-controller" data-connected={connected}>
    <svg viewBox="0 0 260 80" role="img" aria-label="Controller telemetry map: analog sensors, digital I/O and three-phase power">
      <path className="pi-controller__rail" d="M10 23h32m-32 34h32M104 39h37m0-24v49m0-49h27m-27 24h27m-27 25h27" />
      <path className="pi-controller__link" d="M10 39h32" />
      <circle className="pi-controller__terminal" cx="10" cy="39" r="3" />
      <rect className="pi-controller__case" x="42" y="9" width="62" height="62" rx="5" />
      <path className="pi-controller__vent" d="M51 15h44M51 65h44M52 21v7m7-7v7m7-7v7m7-7v7m7-7v7m7-7v7m7-7v7" />
      <text className="pi-controller__name" x="55" y="48">PLC</text>
      <circle className="pi-controller__led" cx="91" cy="43" r="2.5" />
      <path className="pi-controller__vent" d="M52 55v5m7-5v5m7-5v5m7-5v5m7-5v5m7-5v5m7-5v5" />
      {[15, 39, 64].map((y) => <circle key={y} className="pi-controller__terminal" cx="168" cy={y} r="3" />)}
      <text x="180" y="18">Analog inputs</text><text x="180" y="42">Digital I/O</text><text x="180" y="67">3-phase power</text>
    </svg>
    <div className="pi-controller__caption"><span>{connected ? "Controller connected" : "Hardware link unavailable"}</span><span>{hasSamples ? connected ? "Latest values" : "Last received" : "Awaiting payload"}</span></div>
  </div>;
}

export function AnalogCard({ param }: { param: PLCParameter }) {
  const valid = hasReading(param);
  const value = valid ? param.value! : 0;
  const min = param.min ?? 0, max = param.max ?? 100;
  const range = max - min;
  const pct = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0;
  const nominal = param.nominal !== undefined && range > 0 ? Math.max(0, Math.min(1, (param.nominal - min) / range)) : null;
  const flash = useChangeFlash(value, range);
  const formattedValue = valid ? value.toFixed(param.decimals ?? 1) : "—";
  return <div className="card-inner pi-reading" data-channel={param.id} data-state={valid ? param.status : "unavailable"} data-change={flash} data-long-value={formattedValue.length > 5}>
    <div className="pi-reading__top"><span className="pi-reading__label" title={param.label}>{LABELS[param.id] ?? param.label}</span><span className="pi-signal" aria-hidden="true"><i /></span></div>
    <div className="pi-reading__face">
      <div className="pi-reading__amount"><strong>{formattedValue}</strong><span>{param.unit}</span></div>
      <div className="pi-reading__visual"><ParameterMicroviz param={param} /><span className="pi-reading__status">{valid ? STATUS[param.status] : "No reading"}</span></div>
    </div>
    <div className="pi-range" title={`Range ${min}–${max} ${param.unit ?? ""}${param.nominal === undefined ? "" : ` · Nominal ${param.nominal}`}`}>
      {valid && <span style={{ width: `${pct * 100}%` }} />}{nominal !== null && <i style={{ left: `${nominal * 100}%` }} />}
    </div>
    <div className="pi-reading__scale"><span>{min}</span>{param.nominal !== undefined && <span className="pi-reading__nominal">{param.nominal} nom</span>}<span>{max}</span></div>
  </div>;
}

function DigitalCard({ param, onToggle }: { param: PLCParameter; onToggle?: () => void }) {
  const available = !param.placeholder && typeof param.active === "boolean";
  const active = available && param.active;
  const Tag = onToggle ? "button" : "div";
  return <Tag className="pi-digital" data-channel={param.id} data-active={active} onClick={onToggle} {...(onToggle ? { type: "button" as const, "aria-label": `Toggle ${param.label}`, "aria-pressed": active } : {})}>
    <Radio size={15} aria-hidden="true" /><span>{LABELS[param.id] ?? param.label}</span><strong>{available ? active ? "ON" : "OFF" : <><span className="sr-only">No reading</span>—</>}</strong>{onToggle && <ArrowUpRight size={13} aria-hidden="true" />}
  </Tag>;
}
function RelayCard({ param }: { param: PLCParameter }) {
  const health = param.placeholder ? "No reading" : param.status === "critical" ? "Alarm" : param.status === "warning" ? "Warning" : param.accentHex === "#10b981" ? "Healthy" : "Idle";
  return <div className="pi-digital pi-relay" data-health={health}><CircuitBoard size={16} aria-hidden="true" /><span>{param.label}<small>8-channel relay · RS485</small></span><strong><i />{health}</strong></div>;
}

export default function PLCParametersWidget({ className = "" }: { className?: string }) {
  const params = usePLCStore((s) => s.params);
  const liveRfid = usePLCStore((s) => s.rfidAuthorized);
  const rfidOverride = usePLCStore((s) => s.rfidOverride);
  const setRfidOverride = usePLCStore((s) => s.setRfidOverride);
  const rfidAuthorized = rfidOverride === null ? liveRfid : rfidOverride;
  const isOverridden = rfidOverride !== null;
  const { isConnected, sendCommand } = usePLCContext(false);
  const displayParams = ORDER.flatMap((id) => { const param = params.find((p) => p.id === id); return param ? [param] : []; });
  const analog = EXPECTED_ANALOG.map((expected) => displayParams.find((p) => p.id === expected.id && p.kind === "analog") ?? expected);
  const digital = EXPECTED_DIGITAL.map((expected) => displayParams.find((p) => p.id === expected.id && p.kind === expected.kind) ?? expected);
  const digitalSampleCount = digital.filter((param) => !param.placeholder && typeof param.active === "boolean").length;
  const sampleCount = analog.filter(hasReading).length;
  const hasSamples = sampleCount > 0 || digital.some((param) => !param.placeholder && typeof param.active === "boolean");
  return <section className={`card plc-console plc-instruments ${className}`} aria-label="PLC telemetry">
    <header className="pi-heading"><h3>PLC telemetry</h3><span className="pi-link-state" data-connected={isConnected}><i />{isConnected ? "Connected" : "Offline"}</span></header>
    <ControllerMap connected={isConnected} hasSamples={hasSamples} />
    <section className="pi-access" data-authorized={rfidAuthorized}>
      <div className="pi-access__identity">{rfidAuthorized ? <BadgeCheck size={18} aria-hidden="true" /> : <LockKeyhole size={18} aria-hidden="true" />}<div><h4>Operator access</h4><span>{rfidAuthorized ? "Authorized · Intake unlocked" : "Locked · Awaiting badge"}</span></div></div>
      <button type="button" className="pi-test-control" onClick={() => { if (rfidOverride === null) setRfidOverride(true); else if (rfidOverride === true) setRfidOverride(false); else setRfidOverride(null); }} title={isOverridden ? "Click to cycle test state (next: OFF or LIVE)" : "Override the RFID state for testing"}>{isOverridden ? `Test: ${rfidOverride ? "On" : "Off"}` : "Test gate"}</button>
      <p>{isOverridden ? "Test override active · Simulation gate" : "RFID badge authorization"}</p>
    </section>
    <div className="pi-instruments-body">
      <div className="pi-section-title"><h4>Analog sensors</h4><span>{sampleCount} / {analog.length} received</span></div>
      <div className="pi-analog-grid" aria-label="Supported analog channels">{analog.map((param) => <AnalogCard key={param.id} param={param} />)}</div>
      <div className="pi-reading-key"><span><i />{sampleCount ? isConnected ? "Latest PLC readings" : "Last received PLC readings" : "No readings received"}</span><span><i />Nominal</span></div>
      <div className="pi-section-title"><h4><Radio size={14} aria-hidden="true" />Digital I/O</h4><span>{digitalSampleCount} / {digital.length} received</span></div><div className="pi-digital-list" aria-label="Supported digital channels">{digital.map((param) => param.kind === "relay" ? <RelayCard key={param.id} param={param} /> : <DigitalCard key={param.id} param={param} onToggle={!param.placeholder && typeof param.active === "boolean" ? () => sendCommand(param.id, { action: "toggle" }) : undefined} />)}</div>
      <div className="pi-section-title"><h4>Power monitor</h4><span>3-phase</span></div>
      <ThreePhaseMotorWidget connected={isConnected} />
    </div>
    <footer className="pi-footer"><span>Modbus RTU / RS485</span><span>8-ch relay</span></footer>
  </section>;
}
