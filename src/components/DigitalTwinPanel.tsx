import React, { useState } from "react";
import { useDigitalTwinData } from "../hooks/useDigitalTwinData";
import { runDigitalTwinScenario, DT_SCENARIOS } from "../stores/digitalTwinSimulation";
import type { ManufacturingStage, StageId } from "../types/digitalTwin";

interface DigitalTwinPanelProps {
  open: boolean;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  running: "#10b981",
  idle: "#6b7280",
  warning: "#f59e0b",
  faulted: "#ef4444",
  blocked: "#8b5cf6",
};

/* ── Mini Gauge Arc ───────────────────────────────────── */

const MiniGauge: React.FC<{ value: number; min: number; max: number; warning: number; critical: number; label: string; unit: string; nominal: number }> = ({
  value, min, max, warning, critical, label, unit, nominal,
}) => {
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const isUpper = critical > nominal;
  const warnNorm = (warning - min) / (max - min);
  const critNorm = (critical - min) / (max - min);

  let color = "#10b981";
  if (isUpper) {
    if (value >= critical) color = "#ef4444";
    else if (value >= warning) color = "#f59e0b";
  } else {
    if (value <= critical) color = "#ef4444";
    else if (value <= warning) color = "#f59e0b";
  }

  const r = 22;
  const cx = 28;
  const cy = 28;
  const startAngle = -135;
  const endAngle = 135;
  const totalAngle = endAngle - startAngle;

  const arcPath = (startDeg: number, endDeg: number) => {
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s);
    const y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy + r * Math.sin(e);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const valueAngle = startAngle + normalized * totalAngle;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="56" height="36" viewBox="0 0 56 36">
        {/* Background arc */}
        <path d={arcPath(startAngle, endAngle)} fill="none" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
        {/* Value arc */}
        {normalized > 0.01 && (
          <path d={arcPath(startAngle, valueAngle)} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
        )}
        {/* Threshold markers */}
        {[warnNorm, critNorm].map((t, i) => {
          const angle = ((startAngle + t * totalAngle) * Math.PI) / 180;
          return (
            <circle key={i} cx={cx + (r + 2) * Math.cos(angle)} cy={cy + (r + 2) * Math.sin(angle)} r="1.5" fill={i === 0 ? "#f59e0b" : "#ef4444"} opacity={0.6} />
          );
        })}
        {/* Center value */}
        <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize="9" fontWeight="700" fontFamily="monospace">
          {value.toFixed(1)}
        </text>
        <text x={cx} y={cy + 7} textAnchor="middle" fill="#94a3b8" fontSize="6">
          {unit}
        </text>
      </svg>
      <span className="text-[8px] text-white/50 truncate max-w-[60px]">{label}</span>
    </div>
  );
};

/* ── Stage Card ───────────────────────────────────────── */

const StageCard: React.FC<{ stage: ManufacturingStage; selected: boolean; onClick: () => void }> = ({ stage, selected, onClick }) => {
  const color = statusColors[stage.status];

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[80px] ${
        selected
          ? "bg-cyan-400/10 border border-cyan-400/25 shadow-[0_0_12px_rgba(34,211,238,0.1)]"
          : "bg-white/[0.02] border border-white/[0.05] hover:border-white/10"
      }`}
    >
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
      <span className="text-[8px] text-white/70 font-semibold uppercase tracking-wider whitespace-nowrap">{stage.label}</span>
      <span className="text-[7px] text-white/40">Q: {stage.qualityScore}%</span>
    </button>
  );
};

/* ── Device Badge ─────────────────────────────────────── */

const DeviceBadge: React.FC<{ label: string; active: boolean; info?: string }> = ({ label, active, info }) => (
  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] ${
    active
      ? "bg-emerald-500/[0.06] border-emerald-500/15 text-emerald-300/90"
      : "bg-red-500/[0.06] border-red-500/15 text-red-300/70"
  }`}>
    <div className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-red-400"}`} />
    <span className="font-medium">{label}</span>
    {info && <span className="text-white/30 ml-auto">{info}</span>}
  </div>
);

/* ── Product Queue Item ───────────────────────────────── */

const ProductItem: React.FC<{ id: string; quality: number; stage: string | null; color: string }> = ({ id, quality, stage, color }) => (
  <div className="flex-shrink-0 w-[70px] px-2 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] flex flex-col items-center gap-0.5">
    <div className="w-4 h-4 rounded" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}40` }} />
    <span className="text-[7px] text-white/50 font-mono">{id.slice(-4)}</span>
    <span className="text-[8px] font-semibold" style={{ color }}>{quality}%</span>
    {stage && <span className="text-[6px] text-white/30 uppercase">{stage}</span>}
  </div>
);

/* ── Main Panel ───────────────────────────────────────── */

const DigitalTwinPanel: React.FC<DigitalTwinPanelProps> = ({ open, onClose }) => {
  const data = useDigitalTwinData();
  const [selectedStageId, setSelectedStageId] = useState<StageId | null>(null);

  if (!open) return null;

  const selectedStage = selectedStageId ? data.getStage(selectedStageId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} style={{ animation: "fadeIn 0.25s ease" }} />

      {/* Panel */}
      <div
        className="relative w-[90vw] max-w-[950px] max-h-[85vh] bg-[#0a1628]/95 backdrop-blur-2xl border border-cyan-300/12 rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
        style={{ animation: "modalIn 0.32s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {/* Animated accent sweep along the top edge */}
        <div className="absolute top-0 left-0 right-0 h-px overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" style={{ animation: "oee-bar-shimmer 3.5s ease-in-out infinite" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-300/8 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-cyan-50">Digital Twin — Manufacturing Pipeline</h2>
            <p className="text-[10px] text-sky-200/50 mt-0.5">7-stage production line with live sensor monitoring</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Stats */}
            <div className="flex items-center gap-4 text-[10px] mr-4">
              <div className="text-center">
                <div className="text-emerald-400 font-bold text-sm">{data.totalProduced}</div>
                <div className="text-white/30 uppercase tracking-wider">Produced</div>
              </div>
              <div className="text-center">
                <div className="text-red-400 font-bold text-sm">{data.totalRejected}</div>
                <div className="text-white/30 uppercase tracking-wider">Rejected</div>
              </div>
              <div className="text-center">
                <div className="text-cyan-400 font-bold text-sm">{data.throughputPerMin}/min</div>
                <div className="text-white/30 uppercase tracking-wider">Throughput</div>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#1e293b transparent" }}>

          {/* Pipeline Overview */}
          <div>
            <div className="text-[9px] text-white/40 uppercase tracking-wider mb-2 font-semibold">Pipeline Stages</div>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {data.stages.map((stage) => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  selected={selectedStageId === stage.id}
                  onClick={() => setSelectedStageId((prev) => prev === stage.id ? null : stage.id)}
                />
              ))}
            </div>
          </div>

          {/* Conveyor speed indicator */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <span className="text-[9px] text-white/40 uppercase tracking-wider font-semibold">Belt Speed</span>
            <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${data.conveyorSpeedMultiplier * 100}%`,
                  backgroundColor: data.conveyorSpeedMultiplier > 0.7 ? "#10b981" : data.conveyorSpeedMultiplier > 0.3 ? "#f59e0b" : "#ef4444",
                }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold" style={{
              color: data.conveyorSpeedMultiplier > 0.7 ? "#10b981" : data.conveyorSpeedMultiplier > 0.3 ? "#f59e0b" : "#ef4444",
            }}>
              {Math.round(data.conveyorSpeedMultiplier * 100)}%
            </span>
          </div>

          {/* Selected Stage Detail */}
          {selectedStage && (
            <div className="rounded-xl border border-cyan-300/8 bg-cyan-400/[0.02] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[12px] font-semibold text-cyan-50">{selectedStage.label}</h3>
                  <p className="text-[9px] text-white/40 mt-0.5">{selectedStage.description}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColors[selectedStage.status], boxShadow: `0 0 8px ${statusColors[selectedStage.status]}` }} />
                  <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: statusColors[selectedStage.status] }}>
                    {selectedStage.status}
                  </span>
                </div>
              </div>

              {/* Sensor gauges */}
              <div>
                <div className="text-[8px] text-white/30 uppercase tracking-wider mb-1.5 font-semibold">Sensors</div>
                <div className="flex flex-wrap gap-3">
                  {selectedStage.sensors.map((s) => (
                    <MiniGauge
                      key={s.sensorId}
                      value={s.value}
                      min={s.min}
                      max={s.max}
                      warning={s.warningThreshold}
                      critical={s.criticalThreshold}
                      nominal={s.nominal}
                      label={s.label}
                      unit={s.unit}
                    />
                  ))}
                </div>
              </div>

              {/* Output devices */}
              <div>
                <div className="text-[8px] text-white/30 uppercase tracking-wider mb-1.5 font-semibold">Output Devices</div>
                <div className="flex flex-wrap gap-2">
                  {selectedStage.outputDevices.map((d) => (
                    <DeviceBadge
                      key={d.deviceId}
                      label={d.label}
                      active={d.active}
                      info={d.rpm ? `${d.rpm} RPM` : d.powerW ? `${d.powerW}W` : undefined}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Product Queue */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-white/40 uppercase tracking-wider font-semibold">Products on Belt ({data.products.length})</span>
            </div>
            {data.products.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {data.products.slice(0, 20).map((p) => (
                  <ProductItem key={p.id} id={p.id} quality={p.qualityScore} stage={p.currentStageId} color={p.color} />
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-white/20 italic py-4 text-center">No products on belt — start simulation to see products flow</div>
            )}
          </div>

          {/* Scenarios */}
          <div>
            <div className="text-[9px] text-white/40 uppercase tracking-wider mb-2 font-semibold">Scenarios</div>
            <div className="grid grid-cols-2 gap-2">
              {DT_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => runDigitalTwinScenario(scenario.id)}
                  disabled={data.activeScenario !== null}
                  className={`px-3 py-2.5 rounded-xl border text-left transition-all duration-200 ${
                    data.activeScenario === scenario.id
                      ? "bg-white/[0.06] border-white/15"
                      : "bg-white/[0.02] border-white/[0.05] hover:border-white/10"
                  } ${data.activeScenario !== null && data.activeScenario !== scenario.id ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: scenario.color }} />
                    <span className="text-[10px] font-semibold text-white/80">{scenario.label}</span>
                    <span className="text-[8px] text-white/30 ml-auto">{scenario.duration}</span>
                  </div>
                  <p className="text-[8px] text-white/30 mt-1">{scenario.description}</p>
                  {data.activeScenario === scenario.id && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-[8px] text-cyan-400/80 font-medium">Running...</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalTwinPanel;
