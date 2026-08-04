import React, { useState, useCallback } from "react";
import { usePredictionStore } from "../stores/predictionStore";
import CountUp from "./CountUp";
import { requestAIAnalysis } from "../services/aiPredictionService";
import type { ParameterPrediction, RULEstimate, AnomalyAlert } from "../types/predictions";

interface PredictivePanelProps {
  open: boolean;
  onClose: () => void;
}

type TabId = "anomaly" | "maintenance" | "production" | "ai";

const TABS: { id: TabId; label: string }[] = [
  { id: "anomaly", label: "Anomaly Forecast" },
  { id: "maintenance", label: "Maintenance" },
  { id: "production", label: "Production" },
  { id: "ai", label: "AI Analysis" },
];

/* ── Trend Arrow ──────────────────────────────────────── */

const TrendArrow: React.FC<{ direction: "rising" | "falling" | "stable"; rate: number; unit: string }> = ({ direction, rate, unit }) => {
  const color = direction === "rising" ? "text-red-400" : direction === "falling" ? "text-blue-400" : "text-gray-400";
  const arrow = direction === "rising" ? "↑" : direction === "falling" ? "↓" : "→";
  return (
    <span className={`text-[11px] font-mono font-bold ${color}`}>
      {arrow} {Math.abs(rate).toFixed(2)} {unit}
    </span>
  );
};

/* ── Confidence Badge ─────────────────────────────────── */

const ConfidenceBadge: React.FC<{ value: number }> = ({ value }) => {
  const color = value > 0.8 ? "text-green-400 bg-green-500/10 border-green-500/20" : value > 0.5 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-red-400 bg-red-500/10 border-red-500/20";
  return <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${color}`}>{(value * 100).toFixed(0)}%</span>;
};

/* ── Forecast Pill ────────────────────────────────────── */

const ForecastPill: React.FC<{ horizon: string; value: number; unit: string; low: number; high: number }> = ({ horizon, value, unit, low, high }) => (
  <div className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center border border-cyan-300/[0.06]">
    <div className="text-[8px] text-sky-200/40 uppercase tracking-wider">{horizon}</div>
    <div className="text-[14px] font-mono font-bold text-cyan-50 mt-0.5">{value.toFixed(1)}<span className="text-[9px] text-sky-200/40 ml-0.5">{unit}</span></div>
    <div className="text-[7px] text-sky-200/30 mt-0.5">{low.toFixed(1)} – {high.toFixed(1)}</div>
  </div>
);

/* ── Parameter Card ───────────────────────────────────── */

const ParameterCard: React.FC<{ pred: ParameterPrediction }> = ({ pred }) => (
  <div className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-4">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-cyan-50">{pred.label}</span>
        <ConfidenceBadge value={pred.confidence} />
      </div>
      <TrendArrow direction={pred.trendDirection} rate={pred.rateOfChange} unit={pred.rateOfChangeUnit} />
    </div>

    <div className="text-[24px] font-mono font-bold text-cyan-50 mb-2">
      {pred.currentValue.toFixed(1)}<span className="text-[12px] text-sky-200/50 ml-1">{pred.unit}</span>
    </div>

    {pred.thresholdCrossing?.willCross && (
      <div className="mb-3 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
        <span className="text-[10px]">⚠</span>
        <span className="text-[10px] text-red-300 font-medium">
          {pred.thresholdCrossing.direction === "above" ? "Exceeds" : "Drops below"} {pred.thresholdCrossing.threshold}{pred.unit} in ~{Math.round(pred.thresholdCrossing.minutesUntil ?? 0)} min
        </span>
      </div>
    )}

    <div className="grid grid-cols-3 gap-1.5">
      {(["5min", "15min", "30min"] as const).map((h) => (
        <ForecastPill key={h} horizon={h} value={pred.predictions[h].value} unit={pred.unit} low={pred.predictions[h].confidenceLow} high={pred.predictions[h].confidenceHigh} />
      ))}
    </div>
  </div>
);

/* ── Health Gauge (simple bar) ────────────────────────── */

const HealthGauge: React.FC<{ score: number }> = ({ score }) => {
  const color = score > 80 ? "#22c55e" : score > 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="text-center">
      <div className="text-[48px] font-bold font-mono leading-none" style={{ color }}>{score}</div>
      <div className="text-[10px] text-sky-200/50 uppercase tracking-wider mt-1">Health Score</div>
      <div className="mt-3 h-2 bg-white/[0.05] rounded-full overflow-hidden w-full max-w-[200px] mx-auto">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

/* ── RUL Card ─────────────────────────────────────────── */

const RULCard: React.FC<{ rul: RULEstimate }> = ({ rul }) => {
  const timeStr = rul.estimatedMinutesRemaining !== null
    ? rul.estimatedMinutesRemaining > 60
      ? `${Math.floor(rul.estimatedMinutesRemaining / 60)}h ${Math.round(rul.estimatedMinutesRemaining % 60)}m`
      : `${Math.round(rul.estimatedMinutesRemaining)}m`
    : "N/A";
  const color = rul.trend === "degrading" ? "#ef4444" : rul.trend === "improving" ? "#22c55e" : "#f59e0b";

  return (
    <div className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-cyan-50">{rul.label}</span>
        <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
          {rul.trend}
        </span>
      </div>
      <div className="text-[18px] font-mono font-bold text-cyan-50">{timeStr}</div>
      <div className="text-[8px] text-sky-200/40 mt-0.5">Remaining useful life</div>
      <div className="mt-2 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${(1 - rul.currentDegradation) * 100}%`, backgroundColor: color }} />
      </div>
      <div className="flex justify-between mt-1 text-[7px] text-sky-200/30">
        <span>Failure</span>
        <span>{(rul.currentDegradation * 100).toFixed(0)}% degraded</span>
        <span>Nominal</span>
      </div>
    </div>
  );
};

/* ── Alert Row ────────────────────────────────────────── */

const AlertRow: React.FC<{ alert: AnomalyAlert }> = ({ alert }) => {
  const severityStyle = alert.severity === "critical" ? "border-red-500/20 bg-red-500/5 text-red-300" : alert.severity === "warning" ? "border-amber-500/20 bg-amber-500/5 text-amber-300" : "border-cyan-500/10 bg-cyan-500/5 text-cyan-300";
  return (
    <div className={`px-3 py-2 rounded-lg border ${severityStyle} flex items-center gap-2`}>
      <span className="text-[10px]">{alert.severity === "critical" ? "🔴" : alert.severity === "warning" ? "🟡" : "🔵"}</span>
      <span className="text-[10px] font-medium flex-1">{alert.message}</span>
      <ConfidenceBadge value={alert.confidence} />
    </div>
  );
};

/* ── Tab Content ──────────────────────────────────────── */

const AnomalyTab: React.FC = () => {
  const predictions = usePredictionStore((s) => s.parameterPredictions);
  const alerts = usePredictionStore((s) => s.anomalyAlerts);

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-sky-200/50 uppercase tracking-wider font-semibold">Active Alerts</div>
          {alerts.map((a) => <AlertRow key={a.id} alert={a} />)}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {predictions.map((p) => <ParameterCard key={p.parameterId} pred={p} />)}
      </div>
    </div>
  );
};

const MaintenanceTab: React.FC = () => {
  const healthScore = usePredictionStore((s) => s.healthScore);
  const rulEstimates = usePredictionStore((s) => s.rulEstimates);

  const nextFailure = rulEstimates
    .filter((r) => r.estimatedMinutesRemaining !== null && r.trend === "degrading")
    .sort((a, b) => (a.estimatedMinutesRemaining ?? Infinity) - (b.estimatedMinutesRemaining ?? Infinity))[0];

  return (
    <div className="space-y-4">
      <HealthGauge score={healthScore.overall} />

      {nextFailure && (
        <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4 text-center">
          <div className="text-[9px] text-red-300/70 uppercase tracking-wider font-semibold">Next Predicted Failure</div>
          <div className="text-[20px] font-bold text-red-300 mt-1">{nextFailure.label}</div>
          <div className="text-[12px] text-red-200/60 mt-0.5">
            ~{Math.round(nextFailure.estimatedMinutesRemaining ?? 0)} min remaining ({(nextFailure.confidence * 100).toFixed(0)}% confidence)
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {rulEstimates.map((r) => <RULCard key={r.parameterId} rul={r} />)}
      </div>

      <div className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-4">
        <div className="text-[10px] text-sky-200/50 uppercase tracking-wider font-semibold mb-2">Recommendations</div>
        <ul className="space-y-1.5">
          {rulEstimates.filter((r) => r.trend === "degrading").map((r) => (
            <li key={r.parameterId} className="text-[11px] text-sky-200/70 flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              Monitor {r.label} — trending toward failure threshold ({r.failureThreshold})
            </li>
          ))}
          {rulEstimates.every((r) => r.trend !== "degrading") && (
            <li className="text-[11px] text-green-300/70 flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              All parameters within normal operating range
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

const ProductionTab: React.FC = () => {
  const healthScore = usePredictionStore((s) => s.healthScore);
  const predictions = usePredictionStore((s) => s.parameterPredictions);

  // Simple production forecast based on health
  const predictedOEE = Math.max(0, Math.min(100, healthScore.overall * 0.85 + 10));
  const currentPerformance = healthScore.overall > 70 ? "Good" : healthScore.overall > 40 ? "Degraded" : "Poor";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-4 text-center animate-fade-in transition-all duration-300 hover:-translate-y-0.5" style={{ animationDelay: "60ms" }}>
          <div className="text-[9px] text-sky-200/40 uppercase tracking-wider">Predicted OEE</div>
          <div className="text-[28px] font-bold text-cyan-50 mt-1 tabular-nums"><CountUp value={predictedOEE} decimals={1} suffix="%" /></div>
        </div>
        <div className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-4 text-center animate-fade-in transition-all duration-300 hover:-translate-y-0.5" style={{ animationDelay: "120ms" }}>
          <div className="text-[9px] text-sky-200/40 uppercase tracking-wider">Performance</div>
          <div className={`text-[18px] font-bold mt-1 ${healthScore.overall > 70 ? "text-green-400" : healthScore.overall > 40 ? "text-amber-400" : "text-red-400"}`}>
            {currentPerformance}
          </div>
        </div>
        <div className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-4 text-center animate-fade-in transition-all duration-300 hover:-translate-y-0.5" style={{ animationDelay: "180ms" }}>
          <div className="text-[9px] text-sky-200/40 uppercase tracking-wider">Health</div>
          <div className="text-[28px] font-bold text-cyan-50 mt-1 tabular-nums"><CountUp value={healthScore.overall} /></div>
        </div>
      </div>

      <div className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-4">
        <div className="text-[10px] text-sky-200/50 uppercase tracking-wider font-semibold mb-3">Parameter Stability (30 min forecast)</div>
        {predictions.map((p) => {
          const pred30 = p.predictions["30min"];
          const change = pred30.value - p.currentValue;
          const changeColor = Math.abs(change) < 0.5 ? "text-green-400" : Math.abs(change) < 2 ? "text-amber-400" : "text-red-400";
          return (
            <div key={p.parameterId} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
              <span className="text-[11px] text-sky-200/70">{p.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-cyan-50 font-mono">{p.currentValue.toFixed(1)} → {pred30.value.toFixed(1)} {p.unit}</span>
                <span className={`text-[10px] font-mono font-bold ${changeColor}`}>
                  {change > 0 ? "+" : ""}{change.toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AIAnalysisTab: React.FC = () => {
  const aiAnalysis = usePredictionStore((s) => s.aiAnalysis);
  const loading = usePredictionStore((s) => s.aiAnalysisLoading);
  const predictions = usePredictionStore((s) => s.parameterPredictions);
  const rulEstimates = usePredictionStore((s) => s.rulEstimates);
  const healthScore = usePredictionStore((s) => s.healthScore);

  const handleRequest = useCallback(async () => {
    usePredictionStore.setState({ aiAnalysisLoading: true });
    const result = await requestAIAnalysis(predictions, rulEstimates, healthScore);
    usePredictionStore.setState({ aiAnalysis: result, aiAnalysisLoading: false });
  }, [predictions, rulEstimates, healthScore]);

  const riskColors = { low: "text-green-400 bg-green-500/10 border-green-500/20", medium: "text-amber-400 bg-amber-500/10 border-amber-500/20", high: "text-orange-400 bg-orange-500/10 border-orange-500/20", critical: "text-red-400 bg-red-500/10 border-red-500/20" };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <button
          onClick={handleRequest}
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/25 text-[12px] font-bold text-blue-300 uppercase tracking-wider hover:from-blue-600/30 hover:to-purple-600/30 transition-all disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Request AI Analysis"}
        </button>
        <div className="text-[8px] text-sky-200/30 mt-1">AWS Bedrock · Advisory only · Derived prediction summary</div>
      </div>

      {aiAnalysis && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className={`px-3 py-1.5 rounded-lg border font-bold text-[11px] uppercase tracking-wider ${riskColors[aiAnalysis.riskLevel]}`}>
              Risk: {aiAnalysis.riskLevel}
            </div>
            <div className="text-[22px] font-mono font-bold text-cyan-50">{aiAnalysis.healthScore}<span className="text-[11px] text-sky-200/40">/100</span></div>
          </div>

          <div className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-4">
            <div className="text-[10px] text-sky-200/50 uppercase tracking-wider font-semibold mb-2">Assessment</div>
            <p className="text-[12px] text-sky-200/80 leading-relaxed">{aiAnalysis.summary}</p>
          </div>

          {aiAnalysis.recommendations.length > 0 && (
            <div className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-4">
              <div className="text-[10px] text-sky-200/50 uppercase tracking-wider font-semibold mb-2">Recommendations</div>
              <ul className="space-y-1.5">
                {aiAnalysis.recommendations.map((r, i) => (
                  <li key={i} className="text-[11px] text-sky-200/70 flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">→</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {aiAnalysis.patterns.length > 0 && (
            <div className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-4">
              <div className="text-[10px] text-sky-200/50 uppercase tracking-wider font-semibold mb-2">Detected Patterns</div>
              <ul className="space-y-1.5">
                {aiAnalysis.patterns.map((p, i) => (
                  <li key={i} className="text-[11px] text-sky-200/70 flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">◆</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[8px] text-sky-200/20 text-center">
            Analysis from {new Date(aiAnalysis.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Main Panel ───────────────────────────────────────── */

const PredictivePanel: React.FC<PredictivePanelProps> = ({ open, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>("anomaly");
  const alertCount = usePredictionStore((s) => s.anomalyAlerts.length);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} style={{ animation: "fadeIn 0.25s ease" }} />

      <div
        className="relative w-[90vw] max-w-[1000px] max-h-[85vh] bg-[#0a1628]/95 backdrop-blur-2xl border border-cyan-300/12 rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
        style={{ animation: "modalIn 0.32s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {/* Animated accent sweep along the top edge */}
        <div className="absolute top-0 left-0 right-0 h-px overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" style={{ animation: "oee-bar-shimmer 3.5s ease-in-out infinite" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-300/[0.08]">
          <div>
            <h2 className="text-[16px] font-semibold text-cyan-50 tracking-tight">Predictive Analytics</h2>
            <p className="text-[11px] text-sky-200/60 font-medium mt-0.5">
              Forecasting, anomaly detection & maintenance predictions
            </p>
          </div>
          <div className="flex items-center gap-3">
            {alertCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-[10px] font-bold text-red-300">
                {alertCount} alert{alertCount > 1 ? "s" : ""}
              </span>
            )}
            <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-cyan-300/[0.08]">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-cyan-400/15 text-cyan-200 border border-cyan-400/20"
                      : "text-sky-200/50 hover:text-sky-200/80 border border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/[0.04] border border-cyan-300/[0.08] flex items-center justify-center text-sky-200/60 hover:text-white hover:bg-white/[0.08] transition-all">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "anomaly" && <AnomalyTab />}
          {activeTab === "maintenance" && <MaintenanceTab />}
          {activeTab === "production" && <ProductionTab />}
          {activeTab === "ai" && <AIAnalysisTab />}
        </div>
      </div>
    </div>
  );
};

export default PredictivePanel;
