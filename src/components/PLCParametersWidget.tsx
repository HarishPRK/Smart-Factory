import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BadgeCheck, CircuitBoard, LockKeyhole, Radio } from "lucide-react";
import type { PLCParameter } from "../types";
import { usePLCContext } from "../context/PLCContext";
import { usePLCStore } from "../stores/plcStore";
import ThreePhaseMotorWidget from "./ThreePhaseMotorWidget";
import ParameterMicroviz from "./ParameterMicroviz";
import { readSensorPLCChannel } from "../services/receivedTelemetry";

type FlashDir = "up" | "down" | null;
function useChangeFlash(value: number, range: number, threshold = 0.03): FlashDir {
  const [flash, setFlash] = useState<FlashDir>(null);
  const prevRef = useRef(value);
  useEffect(() => {
    if (!Number.isFinite(value) || !Number.isFinite(prevRef.current)) {
      prevRef.current = value;
      return;
    }
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

function ControllerMap({ connected, hasSamples, analog, digital, receivedAt }: { connected: boolean; hasSamples: boolean; analog: boolean[]; digital: boolean[]; receivedAt: number | null }) {
  return <div className="pi-controller" data-connected={connected}>
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect className="pi-controller__case" x="11" y="7" width="42" height="50" rx="5" />
      <path className="pi-controller__vent" d="M18 14h28M18 50h28M18 19v5m7-5v5m7-5v5m7-5v5m7-5v5M18 43v4m7-4v4m7-4v4m7-4v4m7-4v4" />
      <path className="pi-controller__rail" d="M3 19h8m-8 13h8m-8 13h8m42-26h8m-8 13h8m-8 13h8" />
      <text className="pi-controller__name" x="18" y="38">PLC</text>
      <circle className="pi-controller__led" cx="45" cy="34" r="2" />
    </svg>
    <div className="pi-controller__summary"><strong>{connected ? "Receiving controller inputs" : hasSamples ? "Retained PLC readings" : "Waiting for the controller"}</strong><span>{hasSamples && receivedAt !== null ? `Last frame ${new Date(receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Received values only · no model data"}</span>
      <div className="pi-controller__coverage" aria-label="Received input coverage">
        <span>Analog<span className="pi-controller__slots">{analog.map((received, index) => <i key={index} data-received={received} />)}</span></span>
        <span>Digital<span className="pi-controller__slots">{digital.map((received, index) => <i key={index} data-received={received} />)}</span></span>
      </div>
    </div>
  </div>;
}

export function AnalogCard({ param, current = true }: { param: PLCParameter; current?: boolean }) {
  const valid = hasReading(param);
  const value = valid ? param.value! : 0;
  const min = param.min ?? 0, max = param.max ?? 100;
  const range = max - min;
  const pct = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0;
  const nominal = param.nominal !== undefined && range > 0 ? Math.max(0, Math.min(1, (param.nominal - min) / range)) : null;
  const flash = useChangeFlash(valid && current ? value : Number.NaN, range);
  const formattedValue = valid ? value.toFixed(param.decimals ?? 1) : "—";
  return <div className="card-inner pi-reading" data-channel={param.id} data-state={valid ? current ? param.status : "stale" : "unavailable"} data-change={flash} data-long-value={formattedValue.length > 5}>
    <div className="pi-reading__top"><span className="pi-reading__label" title={param.label}>{LABELS[param.id] ?? param.label}</span><span className="pi-signal" aria-hidden="true"><i /></span></div>
    <div className="pi-reading__face">
      <div className="pi-reading__amount"><strong>{formattedValue}</strong><span>{param.unit}</span></div>
      <div className="pi-reading__visual"><ParameterMicroviz param={param} /><span className="pi-reading__status">{valid ? current ? STATUS[param.status] : "Last received" : "No reading"}</span></div>
    </div>
    <div className="pi-range" title={`Range ${min}–${max} ${param.unit ?? ""}${param.nominal === undefined ? "" : ` · Nominal ${param.nominal}`}`}>
      {valid && <span style={{ width: `${pct * 100}%` }} />}{nominal !== null && <i style={{ left: `${nominal * 100}%` }} />}
    </div>
    <div className="pi-reading__scale"><span>{min}</span>{param.nominal !== undefined && <span className="pi-reading__nominal">{param.nominal} nom</span>}<span>{max}</span></div>
  </div>;
}

function DigitalCard({ param, current, onToggle }: { param: PLCParameter; current: boolean; onToggle?: () => void }) {
  const available = !param.placeholder && typeof param.active === "boolean";
  const active = available && param.active;
  const Tag = onToggle ? "button" : "div";
  return <Tag className="pi-digital" data-channel={param.id} data-active={active} onClick={onToggle} {...(onToggle ? { type: "button" as const, "aria-label": `Toggle ${param.label}`, "aria-pressed": active } : {})}>
    <Radio size={15} aria-hidden="true" /><span>{LABELS[param.id] ?? param.label}</span><strong>{available && !current && <small>Last received</small>}{available ? active ? "ON" : "OFF" : <><span className="sr-only">No reading</span>—</>}</strong>{onToggle && <ArrowUpRight size={13} aria-hidden="true" />}
  </Tag>;
}
function RelayCard({ param, current }: { param: PLCParameter; current: boolean }) {
  const health = param.placeholder ? "No reading" : param.status === "critical" ? "Alarm" : param.status === "warning" ? "Warning" : param.accentHex === "#10b981" ? "Healthy" : "Idle";
  return <div className="pi-digital pi-relay" data-health={current ? health : "stale"} title={!current && !param.placeholder ? `Last received relay status: ${health}` : undefined}><CircuitBoard size={16} aria-hidden="true" /><span>{param.label}<small>8-channel relay · RS485</small></span><strong><i />{!param.placeholder && !current ? "Last received" : health}</strong></div>;
}

export default function PLCParametersWidget({ className = "" }: { className?: string }) {
  const params = usePLCStore((s) => s.params);
  const telemetrySource = usePLCStore((s) => s.telemetrySource);
  const receivedAt = usePLCStore((s) => s.lastReceivedAt);
  const receivedHistories = usePLCStore((s) => s.receivedHistories);
  const { isConnected, sendCommand } = usePLCContext(false);
  const connected = telemetrySource === "plc" && isConnected;
  const receivedParams = telemetrySource === "plc" ? params : [];
  const plc = { params, telemetrySource, lastReceivedAt: receivedAt, receivedHistories };
  const rfid = readSensorPLCChannel("operator_rfid", plc);
  const rfidAvailable = rfid.available;
  const rfidAuthorized = rfidAvailable && rfid.value === 1;
  const rfidCurrent = connected && rfid.state === "live";
  const displayParams = ORDER.flatMap((id) => { const param = receivedParams.find((p) => p.id === id); return param ? [param] : []; });
  const analog = EXPECTED_ANALOG.map((expected) => displayParams.find((p) => p.id === expected.id && p.kind === "analog") ?? expected);
  const analogCurrent = analog.map((param) => connected && readSensorPLCChannel(param.id, plc).state === "live");
  const digital = EXPECTED_DIGITAL.map((expected) => displayParams.find((p) => p.id === expected.id && p.kind === expected.kind) ?? expected);
  const digitalCurrent = digital.map((param) => connected && readSensorPLCChannel(param.id, plc).state === "live");
  const digitalSampleCount = digital.filter((param) => !param.placeholder && typeof param.active === "boolean").length;
  const sampleCount = analog.filter(hasReading).length;
  const hasSamples = sampleCount > 0 || digital.some((param) => !param.placeholder && typeof param.active === "boolean");
  return <section className={`card plc-console plc-instruments ${className}`} aria-label="PLC telemetry">
    <header className="pi-heading"><h3><CircuitBoard size={20} aria-hidden="true" />PLC telemetry</h3><span className="pi-link-state" data-connected={connected}><i />{connected ? "Connected" : hasSamples ? "Stale" : "Offline"}</span></header>
    <ControllerMap connected={connected} hasSamples={hasSamples} analog={analog.map(hasReading)} digital={digital.map((param) => !param.placeholder && typeof param.active === "boolean")} receivedAt={receivedAt} />
    <section className="pi-access" data-authorized={rfidAuthorized && rfidCurrent} data-available={rfidAvailable}>
      <div className="pi-access__identity">{rfidAuthorized ? <BadgeCheck size={18} aria-hidden="true" /> : <LockKeyhole size={18} aria-hidden="true" />}<div><h4>Operator access</h4><span>{!rfidAvailable ? "Awaiting RFID input" : !rfidCurrent ? `Last received: ${rfidAuthorized ? "authorized" : "locked"}` : rfidAuthorized ? "Badge authorized" : "Locked · Awaiting badge"}</span></div></div>
      <span className="pi-access__source">RFID</span>
    </section>
    <div className="pi-instruments-body">
      <div className="pi-section-title"><h4>Analog sensors</h4><span>{sampleCount} / {analog.length} received</span></div>
      <div className="pi-analog-grid" aria-label="Supported analog channels">{analog.map((param, index) => <AnalogCard key={param.id} param={param} current={analogCurrent[index]} />)}</div>
      <div className="pi-reading-key"><span><i />{sampleCount ? connected ? "Latest PLC readings" : "Last received PLC readings" : "No readings received"}</span><span><i />Nominal</span></div>
      <div className="pi-section-title"><h4><Radio size={14} aria-hidden="true" />Digital I/O</h4><span>{digitalSampleCount} / {digital.length} received</span></div><div className="pi-digital-list" aria-label="Supported digital channels">{digital.map((param, index) => param.kind === "relay" ? <RelayCard key={param.id} param={param} current={digitalCurrent[index]} /> : <DigitalCard key={param.id} param={param} current={digitalCurrent[index]} onToggle={digitalCurrent[index] && !param.placeholder && typeof param.active === "boolean" ? () => sendCommand(param.id, { action: "toggle" }) : undefined} />)}</div>
      <div className="pi-section-title"><h4>Power monitor</h4><span>3-phase</span></div>
      <ThreePhaseMotorWidget connected={connected} />
    </div>
    <footer className="pi-footer"><span>Modbus RTU / RS485</span><span>8-ch relay</span></footer>
  </section>;
}
