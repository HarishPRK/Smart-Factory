import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { usePLCContext } from "../context/PLCContext";

/* ── Types ── */
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
type Tab = "chat" | "insights" | "analytics" | "prompts";
const AI_PROXY_URL = "http://localhost:9002/chat";

/* ── PLC context builder ── */
function buildPLCContext(
  params: ReturnType<typeof usePLCContext>["params"],
  outputs: ReturnType<typeof usePLCContext>["outputs"],
): string {
  const lines: string[] = [];
  for (const p of params) {
    if (p.kind === "analog")
      lines.push(
        `${p.label}: ${p.value?.toFixed(p.decimals ?? 1)} ${p.unit ?? ""} (range ${p.min}–${p.max}, nominal ${p.nominal}, status: ${p.status})`,
      );
    else if (p.kind === "digital")
      lines.push(`${p.label}: ${p.active ? "ACTIVE" : "INACTIVE"}`);
    else if (p.kind === "relay")
      lines.push(
        `Relay: ${p.accentHex === "#ef4444" ? "RED (triggered)" : "GREEN (healthy)"}`,
      );
  }
  lines.push(`Motor Fan: ${outputs.motorFanOn ? "RUNNING" : "OFF"}`);
  lines.push(`Alerts: ${outputs.alerts.some(Boolean) ? "ACTIVE" : "NONE"}`);
  lines.push(`Push Button: ${outputs.pushButton ? "PRESSED" : "RELEASED"}`);
  return lines.join("\n");
}

/* ── Derive insights from live PLC ── */
function deriveInsights(
  params: ReturnType<typeof usePLCContext>["params"],
  outputs: ReturnType<typeof usePLCContext>["outputs"],
) {
  const insights: {
    title: string;
    body: string;
    tone: "good" | "warn" | "critical";
    metric?: string;
  }[] = [];
  for (const p of params) {
    if (p.kind === "analog") {
      const pct =
        p.value != null && p.max != null && p.min != null
          ? Math.round(((p.value - p.min) / (p.max - p.min)) * 100)
          : null;
      if (p.status === "critical")
        insights.push({
          title: `${p.label} Critical`,
          body: `Reading ${p.value?.toFixed(p.decimals ?? 1)} ${p.unit ?? ""} — outside safe range (${p.min}–${p.max}).`,
          tone: "critical",
          metric: pct != null ? `${pct}%` : undefined,
        });
      else if (p.status === "warning")
        insights.push({
          title: `${p.label} Warning`,
          body: `At ${p.value?.toFixed(p.decimals ?? 1)} ${p.unit ?? ""}, approaching limits.`,
          tone: "warn",
          metric: pct != null ? `${pct}%` : undefined,
        });
      else
        insights.push({
          title: `${p.label} Normal`,
          body: `${p.value?.toFixed(p.decimals ?? 1)} ${p.unit ?? ""} within safe range.`,
          tone: "good",
          metric: pct != null ? `${pct}%` : undefined,
        });
    }
  }
  if (outputs.motorFanOn)
    insights.push({
      title: "Motor Fan Active",
      body: "Cooling system running.",
      tone: "good",
    });
  if (outputs.alerts.some(Boolean))
    insights.push({
      title: "Active Alerts",
      body: "Alert channels triggered.",
      tone: "critical",
    });
  return insights;
}

/* ── Prompt categories ── */
const PROMPT_CATEGORIES = [
  {
    label: "Diagnostics",
    color: "cyan",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>`,
    prompts: [
      "Run a full health check on all PLC parameters",
      "Compare current readings against last shift baseline",
      "Identify parameters drifting toward warning thresholds",
      "List sensors that triggered alerts recently",
      "Check for intermittent signal noise across all channels",
      "Validate sensor calibration based on nominal values",
    ],
  },
  {
    label: "Optimization",
    color: "emerald",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    prompts: [
      "Suggest energy-saving adjustments based on current load",
      "What's the optimal motor fan duty cycle right now?",
      "Recommend pH correction steps for current readings",
      "Analyze voltage stability and suggest improvements",
      "Calculate optimal operating ranges for current conditions",
      "Identify power factor improvement opportunities",
    ],
  },
  {
    label: "Predictive",
    color: "violet",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
    prompts: [
      "Predict which sensor is most likely to alert next",
      "Estimate time before current reaches upper threshold",
      "Forecast maintenance needs based on trend analysis",
      "What patterns do you see in today's anomaly data?",
      "Calculate remaining useful life for each monitored component",
      "Detect early signs of sensor degradation",
    ],
  },
  {
    label: "Safety & Compliance",
    color: "red",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    prompts: [
      "Perform a safety assessment of all parameters",
      "Check compliance with operational thresholds",
      "Identify potential cascade failure scenarios",
      "Assess risk of equipment damage at current readings",
      "Verify emergency shutdown readiness",
      "Rate current conditions for operator safety",
    ],
  },
  {
    label: "Reports & Export",
    color: "blue",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>`,
    prompts: [
      "Generate a comprehensive shift summary",
      "Create an anomaly report for the past 4 hours",
      "Summarize factory KPIs in natural language",
      "Draft an incident report for the latest alert",
      "Produce an executive briefing of factory status",
      "Build a maintenance recommendation document",
    ],
  },
  {
    label: "Correlation & Trends",
    color: "pink",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    prompts: [
      "Find correlations between voltage and current trends",
      "How does pH level correlate with other sensor readings?",
      "Detect cyclic patterns in today's sensor data",
      "Compare this shift's performance vs historical average",
      "Identify leading indicators for equipment failure",
      "Analyze sensor response time and latency patterns",
    ],
  },
];

const TONE = {
  good: {
    bg: "from-emerald-500/12 to-emerald-800/6",
    border: "border-emerald-400/15",
    text: "text-emerald-300",
    glow: "bg-emerald-500/10",
    dot: "bg-emerald-400",
    shadow: "shadow-[0_0_8px_rgba(52,211,153,0.6)]",
  },
  warn: {
    bg: "from-amber-500/12 to-amber-800/6",
    border: "border-amber-400/15",
    text: "text-amber-300",
    glow: "bg-amber-500/10",
    dot: "bg-amber-400",
    shadow: "shadow-[0_0_8px_rgba(245,158,11,0.6)]",
  },
  critical: {
    bg: "from-red-500/12 to-red-800/6",
    border: "border-red-400/15",
    text: "text-red-300",
    glow: "bg-red-500/10",
    dot: "bg-red-400",
    shadow: "shadow-[0_0_8px_rgba(239,68,68,0.6)]",
  },
};

/* ══════════════════════════════════════════
   MAIN MODAL
   ══════════════════════════════════════════ */
interface AIAssistantModalProps {
  open: boolean;
  onClose: () => void;
}

const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  open,
  onClose,
}) => {
  const { params, outputs } = usePLCContext(open);
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showContext, setShowContext] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const insights = useMemo(
    () => deriveInsights(params, outputs),
    [params, outputs],
  );
  const criticalCount = insights.filter((i) => i.tone === "critical").length;
  const warnCount = insights.filter((i) => i.tone === "warn").length;
  const goodCount = insights.filter((i) => i.tone === "good").length;
  const healthScore = Math.max(0, 100 - criticalCount * 25 - warnCount * 10);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    if (open && tab === "chat")
      setTimeout(() => inputRef.current?.focus(), 400);
  }, [open, tab]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || loading) return;
      const userMsg: Message = {
        role: "user",
        content: msg,
        timestamp: new Date(),
      };
      const next = [...messages, userMsg];
      setMessages(next);
      setInput("");
      setLoading(true);
      setTab("chat");
      try {
        const res = await fetch(AI_PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.map((m) => ({ role: m.role, content: m.content })),
            plcContext: buildPLCContext(params, outputs),
          }),
        });
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply ?? "Sorry, I couldn't process that.",
            timestamp: new Date(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Connection failed. Ensure `npm run ai-proxy` is running.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, params, outputs],
  );

  if (!open) return null;

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "chat", label: "Chat", badge: messages.length || undefined },
    { id: "insights", label: "Insights", badge: criticalCount || undefined },
    { id: "analytics", label: "Analytics" },
    { id: "prompts", label: "Prompts" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9990] bg-black/70 backdrop-blur-xl animate-[fadeIn_0.3s_ease]"
        onClick={onClose}
      />

      {/* ── Modal ── */}
      <div className="fixed inset-0 z-[9991] flex items-center justify-center p-5 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-[1280px] h-[88vh] max-h-[860px] rounded-[28px] overflow-hidden flex relative animate-[modalIn_0.45s_cubic-bezier(0.16,1,0.3,1)]"
          style={{
            background:
              "linear-gradient(165deg, rgba(6,14,36,0.98), rgba(3,8,22,0.99))",
            border: "1px solid rgba(0,200,255,0.08)",
            boxShadow:
              "0 0 120px rgba(0,200,255,0.06), 0 0 300px rgba(120,60,255,0.04), 0 60px 120px rgba(0,0,0,0.8)",
          }}
        >
          {/* BG effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-60 -right-60 w-[600px] h-[600px] rounded-full bg-cyan-500/[0.025] blur-[150px] animate-[orbFloat_14s_ease-in-out_infinite]" />
            <div className="absolute -bottom-60 -left-60 w-[550px] h-[550px] rounded-full bg-violet-500/[0.025] blur-[150px] animate-[orbFloat_18s_ease-in-out_infinite_reverse]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-blue-500/[0.015] blur-[120px] animate-[orbPulse_10s_ease-in-out_infinite]" />
            {/* Grid overlay */}
            <div
              className="absolute inset-0 opacity-[0.015]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(0,220,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,220,255,1) 1px, transparent 1px)",
                backgroundSize: "80px 80px",
              }}
            />
          </div>

          {/* ════════ LEFT SIDEBAR ════════ */}
          <div className="w-[280px] flex-shrink-0 border-r border-white/[0.04] flex flex-col relative">
            {/* Sidebar gradient accent */}
            <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-cyan-400/10 via-transparent to-violet-400/10 pointer-events-none" />

            {/* AI Brand */}
            <div className="px-6 pt-7 pb-5">
              <div className="flex items-center gap-4">
                <AIAvatar size={48} />
                <div>
                  <div className="text-[15px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-blue-100 to-violet-300">
                    Factory AI
                  </div>
                  <div className="text-[9px] text-cyan-300/30 mt-1 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400/40" />
                      <span className="relative rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                    </span>
                    Online &middot; Claude AI
                  </div>
                </div>
              </div>
              <div className="mt-4 text-[9px] text-blue-300/20 leading-relaxed">
                Real-time factory intelligence powered by live PLC sensor data
                and Claude AI.
              </div>
            </div>

            {/* Divider */}
            <div className="mx-5 h-px bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent" />

            {/* Health Score */}
            <div className="px-6 py-5">
              <div className="text-[8px] text-blue-300/25 uppercase tracking-[0.18em] font-bold mb-3">
                System Health
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="rgba(0,200,255,0.05)"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke={
                        healthScore >= 80
                          ? "#34d399"
                          : healthScore >= 50
                            ? "#f59e0b"
                            : "#ef4444"
                      }
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={`${healthScore * 0.942} 94.2`}
                      className="transition-all duration-1000 ease-out"
                      style={{
                        filter: `drop-shadow(0 0 6px ${healthScore >= 80 ? "rgba(52,211,153,0.5)" : healthScore >= 50 ? "rgba(245,158,11,0.5)" : "rgba(239,68,68,0.5)"})`,
                      }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className={`text-[17px] font-extrabold ${healthScore >= 80 ? "text-emerald-300" : healthScore >= 50 ? "text-amber-300" : "text-red-300"}`}
                    >
                      {healthScore}
                    </span>
                  </div>
                </div>
                <div>
                  <div
                    className={`text-[12px] font-bold ${healthScore >= 80 ? "text-emerald-300/80" : healthScore >= 50 ? "text-amber-300/80" : "text-red-300/80"}`}
                  >
                    {healthScore >= 80
                      ? "Excellent"
                      : healthScore >= 50
                        ? "Attention"
                        : "Critical"}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-[8px] text-emerald-400/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                      {goodCount}
                    </span>
                    <span className="flex items-center gap-1 text-[8px] text-amber-400/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                      {warnCount}
                    </span>
                    <span className="flex items-center gap-1 text-[8px] text-red-400/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400/60" />
                      {criticalCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-5 h-px bg-gradient-to-r from-transparent via-cyan-400/8 to-transparent" />

            {/* Navigation */}
            <div className="px-4 py-4 space-y-1">
              <div className="text-[8px] text-blue-300/20 uppercase tracking-[0.18em] font-bold px-2 mb-2">
                Navigation
              </div>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-medium transition-all duration-300 group/t ${
                    tab === t.id
                      ? "bg-gradient-to-r from-cyan-500/12 to-violet-500/6 text-cyan-50 border border-cyan-400/10"
                      : "text-blue-300/30 hover:text-blue-200/50 hover:bg-white/[0.015] border border-transparent"
                  }`}
                >
                  <span
                    className={`w-[18px] h-[18px] flex-shrink-0 ${tab === t.id ? "opacity-80" : "opacity-30 group-hover/t:opacity-50"} transition-opacity`}
                    dangerouslySetInnerHTML={{ __html: TAB_ICONS[t.id] }}
                  />
                  {t.label}
                  {t.badge && t.badge > 0 && (
                    <span
                      className={`ml-auto min-w-[20px] h-[18px] rounded-full text-[8px] font-bold flex items-center justify-center px-1.5 ${
                        t.id === "insights"
                          ? "bg-red-500/15 border border-red-400/15 text-red-300/70"
                          : "bg-white/[0.04] border border-white/[0.06] text-blue-300/30"
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mx-5 h-px bg-gradient-to-r from-transparent via-cyan-400/8 to-transparent" />

            {/* Quick Actions */}
            <div className="px-4 py-4 flex-1 overflow-y-auto space-y-0.5">
              <div className="text-[8px] text-blue-300/20 uppercase tracking-[0.18em] font-bold px-2 mb-2">
                Quick Actions
              </div>
              {[
                {
                  icon: CHIP_ICONS.heart,
                  label: "System Health Check",
                  q: "Run a full system health check on all sensors and parameters",
                },
                {
                  icon: CHIP_ICONS.file,
                  label: "Generate Shift Report",
                  q: "Generate a comprehensive shift summary report",
                },
                {
                  icon: CHIP_ICONS.alert,
                  label: "Anomaly Detection",
                  q: "Scan for anomalies and unusual patterns in sensor data",
                },
                {
                  icon: CHIP_ICONS.shield,
                  label: "Safety Assessment",
                  q: "Perform a complete safety assessment of factory conditions",
                },
                {
                  icon: CHIP_ICONS.zap,
                  label: "Energy Analysis",
                  q: "Analyze current energy consumption and efficiency",
                },
                {
                  icon: CHIP_ICONS.clock,
                  label: "Maintenance Forecast",
                  q: "Forecast upcoming maintenance needs based on sensor trends",
                },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={() => sendMessage(a.q)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[10px] text-blue-300/30 hover:text-cyan-200/65 hover:bg-cyan-500/[0.04] transition-all duration-200 group/qa"
                >
                  <span
                    className="w-3.5 h-3.5 opacity-25 group-hover/qa:opacity-50 transition-opacity flex-shrink-0"
                    dangerouslySetInnerHTML={{ __html: a.icon }}
                  />
                  {a.label}
                </button>
              ))}
            </div>

            {/* Live Sensor Feed */}
            <div className="px-5 py-4 border-t border-white/[0.03]">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[8px] text-blue-300/20 uppercase tracking-[0.18em] font-bold">
                  Live Feed
                </span>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inset-0 rounded-full bg-cyan-400/30" />
                  <span className="relative rounded-full h-1.5 w-1.5 bg-cyan-400/60" />
                </span>
              </div>
              {params.map(
                (p, i) =>
                  p.kind === "analog" && (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-[9px] text-blue-300/30 truncate">
                        {p.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1 h-1 rounded-full ${p.status === "critical" ? "bg-red-400 animate-pulse" : p.status === "warning" ? "bg-amber-400" : "bg-emerald-400/50"}`}
                        />
                        <span
                          className={`text-[9px] font-mono font-bold ${p.status === "critical" ? "text-red-400" : p.status === "warning" ? "text-amber-400" : "text-cyan-300/50"}`}
                        >
                          {p.value?.toFixed(p.decimals ?? 1)}
                          <span className="text-blue-300/20 ml-0.5 font-normal">
                            {p.unit}
                          </span>
                        </span>
                      </div>
                    </div>
                  ),
              )}
            </div>
          </div>

          {/* ════════ MAIN CONTENT ════════ */}
          <div className="flex-1 flex flex-col min-w-0 relative">
            {/* Top Bar */}
            <div className="relative flex items-center justify-between px-7 py-4 border-b border-white/[0.04] flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/10 to-violet-500/8 border border-cyan-400/8 flex items-center justify-center">
                  <span
                    className="w-4 h-4"
                    dangerouslySetInnerHTML={{ __html: TAB_ICONS[tab] }}
                    style={{ color: "rgba(103,232,249,0.6)" }}
                  />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-cyan-50/90">
                    {tab === "chat"
                      ? "AI Chat"
                      : tab === "insights"
                        ? "Real-Time Insights"
                        : tab === "analytics"
                          ? "Factory Analytics"
                          : "Advanced Prompts"}
                  </div>
                  <div className="text-[10px] text-blue-300/25 mt-0.5">
                    {tab === "chat"
                      ? "Conversational AI with live PLC context"
                      : tab === "insights"
                        ? "Auto-generated from live sensor feed"
                        : tab === "analytics"
                          ? "Live metrics, gauges, and performance data"
                          : "Context-aware AI prompt library"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[9px] text-blue-300/25">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    {messages.length}
                  </div>
                )}
                {messages.length > 0 && tab === "chat" && (
                  <button
                    onClick={() => setMessages([])}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[9px] text-blue-300/25 hover:text-red-300/50 hover:border-red-400/10 transition-all"
                  >
                    Clear
                  </button>
                )}
                {/* Toggle context panel */}
                <button
                  onClick={() => setShowContext((v) => !v)}
                  className={`px-3 py-1.5 rounded-lg border text-[9px] transition-all ${showContext ? "bg-cyan-500/[0.06] border-cyan-400/10 text-cyan-300/50" : "bg-white/[0.02] border-white/[0.04] text-blue-300/25"}`}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="inline mr-1"
                  >
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  Context
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center hover:bg-red-500/10 hover:border-red-400/12 transition-all group/x"
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 3l8 8M11 3l-8 8"
                      stroke="#475569"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      className="group-hover/x:stroke-red-400 transition-colors"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 flex">
              {/* Main Panel */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* ─── CHAT TAB ─── */}
                {tab === "chat" && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
                      {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-7 animate-[fadeSlideIn_0.5s_ease]">
                          {/* Large orbiting animation */}
                          <div className="relative w-36 h-36">
                            {[
                              {
                                inset: 0,
                                dur: 14,
                                color: "cyan",
                                size: 3,
                                dotPos: "top",
                              },
                              {
                                inset: 8,
                                dur: 10,
                                color: "violet",
                                size: 2.5,
                                dotPos: "bottom",
                                rev: true,
                              },
                              {
                                inset: 16,
                                dur: 7,
                                color: "blue",
                                size: 2,
                                dotPos: "right",
                              },
                              {
                                inset: 24,
                                dur: 5,
                                color: "emerald",
                                size: 1.5,
                                dotPos: "top",
                                rev: true,
                              },
                              {
                                inset: 32,
                                dur: 4,
                                color: "pink",
                                size: 1.5,
                                dotPos: "left",
                              },
                            ].map((r, i) => (
                              <div
                                key={i}
                                className={`absolute rounded-full border border-${r.color}-400/[0.07] ${r.rev ? "animate-[spinSlow_" + r.dur + "s_linear_infinite_reverse]" : "animate-[spinSlow_" + r.dur + "s_linear_infinite]"}`}
                                style={{
                                  inset: r.inset,
                                  animationDuration: `${r.dur}s`,
                                  animationDirection: r.rev
                                    ? "reverse"
                                    : "normal",
                                }}
                              >
                                <div
                                  className={`absolute w-[${r.size * 4}px] h-[${r.size * 4}px] rounded-full bg-${r.color}-400/50 shadow-[0_0_${r.size * 5}px_rgba(${r.color === "cyan" ? "34,211,238" : r.color === "violet" ? "167,139,250" : r.color === "blue" ? "96,165,250" : r.color === "emerald" ? "52,211,153" : "244,114,182"},0.5)]`}
                                  style={{
                                    width: r.size * 4,
                                    height: r.size * 4,
                                    ...(r.dotPos === "top"
                                      ? {
                                          top: -(r.size * 2),
                                          left: "50%",
                                          transform: "translateX(-50%)",
                                        }
                                      : r.dotPos === "bottom"
                                        ? {
                                            bottom: -(r.size * 2),
                                            left: "50%",
                                            transform: "translateX(-50%)",
                                          }
                                        : r.dotPos === "right"
                                          ? {
                                              right: -(r.size * 2),
                                              top: "50%",
                                              transform: "translateY(-50%)",
                                            }
                                          : {
                                              left: -(r.size * 2),
                                              top: "50%",
                                              transform: "translateY(-50%)",
                                            }),
                                    backgroundColor:
                                      r.color === "cyan"
                                        ? "rgba(34,211,238,0.5)"
                                        : r.color === "violet"
                                          ? "rgba(167,139,250,0.5)"
                                          : r.color === "blue"
                                            ? "rgba(96,165,250,0.5)"
                                            : r.color === "emerald"
                                              ? "rgba(52,211,153,0.5)"
                                              : "rgba(244,114,182,0.5)",
                                    boxShadow: `0 0 ${r.size * 6}px ${r.color === "cyan" ? "rgba(34,211,238,0.4)" : r.color === "violet" ? "rgba(167,139,250,0.4)" : r.color === "blue" ? "rgba(96,165,250,0.4)" : r.color === "emerald" ? "rgba(52,211,153,0.4)" : "rgba(244,114,182,0.4)"}`,
                                  }}
                                />
                              </div>
                            ))}
                            {/* Core */}
                            <div className="absolute inset-[44px] rounded-full bg-gradient-to-br from-cyan-500/15 to-violet-500/15 border border-cyan-300/8 flex items-center justify-center animate-[corePulse_3s_ease-in-out_infinite]">
                              <svg
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <path
                                  d="M12 2a10 10 0 100 20 10 10 0 000-20z"
                                  stroke="url(#cg)"
                                  strokeWidth="1"
                                  fill="none"
                                />
                                <path
                                  d="M8 12h8M12 8v8"
                                  stroke="#67e8f9"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                />
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="2"
                                  fill="none"
                                  stroke="#a78bfa"
                                  strokeWidth="0.6"
                                  className="animate-[corePulse_2s_ease-in-out_infinite]"
                                />
                                <defs>
                                  <linearGradient
                                    id="cg"
                                    x1="2"
                                    y1="2"
                                    x2="22"
                                    y2="22"
                                  >
                                    <stop
                                      stopColor="#67e8f9"
                                      stopOpacity="0.5"
                                    />
                                    <stop
                                      offset="1"
                                      stopColor="#a78bfa"
                                      stopOpacity="0.5"
                                    />
                                  </linearGradient>
                                </defs>
                              </svg>
                            </div>
                            <div className="absolute -inset-4 rounded-full bg-cyan-400/[0.015] animate-[orbPulse_6s_ease-in-out_infinite]" />
                          </div>

                          <div className="text-center">
                            <div className="text-[18px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-blue-100 to-violet-300">
                              How can I help you today?
                            </div>
                            <div className="text-[11px] text-blue-300/25 mt-2.5 max-w-[440px] leading-relaxed">
                              I have real-time access to all PLC sensor data,
                              machine states, and alert history. Ask about
                              health, anomalies, trends, or get predictive
                              maintenance insights.
                            </div>
                          </div>

                          {/* Starter grid */}
                          <div className="grid grid-cols-3 gap-2.5 max-w-[600px] w-full">
                            {[
                              {
                                icon: "heart",
                                text: "What's the overall factory health?",
                              },
                              { icon: "alert", text: "Show me anomalies" },
                              {
                                icon: "zap",
                                text: "Is voltage in safe range?",
                              },
                              {
                                icon: "clock",
                                text: "Predict next maintenance",
                              },
                              { icon: "settings", text: "Explain relay state" },
                              { icon: "file", text: "Generate shift report" },
                            ].map((q) => (
                              <button
                                key={q.text}
                                onClick={() => sendMessage(q.text)}
                                className="flex items-center gap-2.5 text-left text-[10.5px] px-4 py-3.5 rounded-xl bg-white/[0.015] border border-white/[0.04] text-blue-200/35 hover:bg-gradient-to-r hover:from-cyan-500/[0.06] hover:to-violet-500/[0.03] hover:border-cyan-400/12 hover:text-cyan-100 transition-all duration-300 group/c"
                              >
                                <span
                                  className="w-4 h-4 flex-shrink-0 opacity-25 group-hover/c:opacity-55 transition-opacity"
                                  dangerouslySetInnerHTML={{
                                    __html: CHIP_ICONS[q.icon],
                                  }}
                                />
                                {q.text}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Messages */}
                      {messages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex gap-3.5 ${msg.role === "user" ? "flex-row-reverse" : ""} animate-[msgIn_0.3s_ease]`}
                        >
                          {msg.role === "assistant" ? (
                            <AIAvatar size={34} />
                          ) : (
                            <div className="w-[34px] h-[34px] rounded-xl bg-gradient-to-br from-cyan-500/12 to-blue-500/12 border border-cyan-400/8 flex items-center justify-center flex-shrink-0">
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 20 20"
                                fill="none"
                              >
                                <circle
                                  cx="10"
                                  cy="7"
                                  r="3"
                                  stroke="#67e8f9"
                                  strokeWidth="1.2"
                                />
                                <path
                                  d="M4 17c0-2.5 2.5-4.5 6-4.5s6 2 6 4.5"
                                  stroke="#67e8f9"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </div>
                          )}
                          <div
                            className={`max-w-[65%] rounded-2xl px-4.5 py-3.5 text-[12px] leading-[1.75] ${msg.role === "user" ? "bg-gradient-to-br from-cyan-500/10 to-blue-500/6 border border-cyan-400/10 text-cyan-50" : "bg-white/[0.025] border border-white/[0.05] text-blue-100/70"}`}
                          >
                            {msg.role === "assistant" && (
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[8px] text-violet-400/45 font-bold uppercase tracking-widest">
                                  Claude AI
                                </span>
                                <span className="h-px flex-1 bg-gradient-to-r from-violet-400/8 to-transparent" />
                              </div>
                            )}
                            <div className="whitespace-pre-wrap">
                              {msg.content}
                            </div>
                            <div
                              className={`text-[8px] mt-2 ${msg.role === "user" ? "text-cyan-300/15 text-right" : "text-blue-300/12"}`}
                            >
                              {msg.timestamp.toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        </div>
                      ))}

                      {loading && (
                        <div className="flex gap-3.5 animate-[msgIn_0.3s_ease]">
                          <AIAvatar size={34} />
                          <div className="bg-white/[0.025] border border-white/[0.05] rounded-2xl px-5 py-4 flex items-center gap-4">
                            <div className="flex gap-1.5">
                              {[0, 1, 2].map((d) => (
                                <span
                                  key={d}
                                  className="w-2 h-2 rounded-full bg-gradient-to-br from-cyan-400/50 to-violet-400/50 animate-bounce"
                                  style={{ animationDelay: `${d * 150}ms` }}
                                />
                              ))}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] text-blue-300/30">
                                Analyzing factory data...
                              </span>
                              <span className="text-[8px] text-blue-300/15">
                                Reading {params.length} sensors
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div className="px-7 py-4 border-t border-white/[0.04] flex-shrink-0">
                      <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-2xl px-5 py-3.5 focus-within:border-cyan-400/15 focus-within:shadow-[0_0_30px_rgba(34,211,238,0.04)] transition-all duration-300">
                        <input
                          ref={inputRef}
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                          placeholder="Ask anything about your factory..."
                          className="flex-1 bg-transparent text-[13px] text-cyan-50 placeholder:text-blue-300/18 outline-none"
                          disabled={loading}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => sendMessage()}
                            disabled={loading || !input.trim()}
                            className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/15 to-violet-500/10 border border-cyan-400/12 flex items-center justify-center hover:from-cyan-500/25 hover:to-violet-500/20 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)] transition-all duration-300 disabled:opacity-15 disabled:cursor-not-allowed group/s"
                          >
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <path
                                d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                                stroke="#67e8f9"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="group-hover/s:stroke-cyan-300 transition-colors"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-3 mt-2.5">
                        <span className="text-[8px] text-blue-300/12">
                          AI reads live PLC data with each message
                        </span>
                        <span className="text-[8px] text-blue-300/8">
                          &middot;
                        </span>
                        <span className="text-[8px] text-blue-300/12">
                          Press Enter to send
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── INSIGHTS ─── */}
                {tab === "insights" && (
                  <div className="flex-1 overflow-y-auto px-7 py-6 space-y-3">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-3 mb-5 animate-[fadeSlideIn_0.3s_ease]">
                      {(
                        [
                          ["Healthy", goodCount, "emerald"],
                          ["Warning", warnCount, "amber"],
                          ["Critical", criticalCount, "red"],
                        ] as const
                      ).map(([l, c, clr]) => (
                        <div
                          key={l}
                          className={`rounded-2xl bg-gradient-to-br from-${clr}-500/8 to-${clr}-800/4 border border-${clr}-400/8 px-5 py-4 relative overflow-hidden`}
                        >
                          <div
                            className={`text-[24px] font-extrabold text-${clr}-300/75 leading-none`}
                          >
                            {c}
                          </div>
                          <div className="text-[9px] text-blue-300/25 uppercase tracking-wider mt-1.5 font-semibold">
                            {l}
                          </div>
                          <div
                            className={`absolute -bottom-4 -right-4 w-16 h-16 rounded-full blur-[20px] bg-${clr}-500/[0.06] pointer-events-none`}
                          />
                        </div>
                      ))}
                    </div>

                    {insights.map((ins, i) => {
                      const t = TONE[ins.tone];
                      return (
                        <div
                          key={i}
                          className={`relative rounded-2xl bg-gradient-to-br ${t.bg} border ${t.border} p-4 overflow-hidden animate-[fadeSlideIn_0.3s_ease_both] group/i hover:scale-[1.005] transition-transform`}
                          style={{ animationDelay: `${i * 50}ms` }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl ${t.glow} border ${t.border} flex items-center justify-center flex-shrink-0`}
                            >
                              <div
                                className={`w-2.5 h-2.5 rounded-full ${t.dot} ${t.shadow} animate-pulse-glow`}
                                style={{
                                  color:
                                    ins.tone === "good"
                                      ? "#34d399"
                                      : ins.tone === "warn"
                                        ? "#f59e0b"
                                        : "#ef4444",
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div
                                  className={`text-[12px] font-bold ${t.text}`}
                                >
                                  {ins.title}
                                </div>
                                {ins.metric && (
                                  <span
                                    className={`text-[11px] font-mono font-bold ${t.text} opacity-60`}
                                  >
                                    {ins.metric}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10.5px] text-blue-200/40 mt-1 leading-relaxed">
                                {ins.body}
                              </div>
                            </div>
                          </div>
                          <div
                            className={`absolute -bottom-6 -right-6 w-20 h-20 rounded-full blur-[20px] ${t.glow} opacity-40 group-hover/i:opacity-80 transition-opacity pointer-events-none`}
                          />
                        </div>
                      );
                    })}

                    <div className="pt-4 mt-2 border-t border-white/[0.03]">
                      <div className="text-[9px] text-blue-300/20 uppercase tracking-[0.15em] font-bold mb-2.5">
                        Ask AI about these
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "Explain the most critical reading",
                          "What actions should I take?",
                          "Are values trending worse?",
                          "Generate safety report",
                        ].map((q) => (
                          <button
                            key={q}
                            onClick={() => sendMessage(q)}
                            className="text-[10px] px-3.5 py-2 rounded-xl bg-cyan-500/[0.04] border border-cyan-400/6 text-cyan-300/35 hover:bg-cyan-500/[0.1] hover:text-cyan-200 hover:border-cyan-400/12 transition-all"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── ANALYTICS ─── */}
                {tab === "analytics" && (
                  <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
                    {/* KPI Summary Row */}
                    <div className="grid grid-cols-4 gap-3 animate-[fadeSlideIn_0.3s_ease]">
                      {[
                        {
                          label: "Health Score",
                          value: `${healthScore}%`,
                          sub:
                            healthScore >= 80
                              ? "Excellent"
                              : healthScore >= 50
                                ? "Fair"
                                : "Poor",
                          clr:
                            healthScore >= 80
                              ? "emerald"
                              : healthScore >= 50
                                ? "amber"
                                : "red",
                        },
                        {
                          label: "Active Sensors",
                          value: `${params.filter((p) => p.kind === "analog").length}`,
                          sub: "Real-time",
                          clr: "cyan",
                        },
                        {
                          label: "Uptime",
                          value: outputs.motorFanOn ? "99.2%" : "—",
                          sub: "This shift",
                          clr: "violet",
                        },
                        {
                          label: "Efficiency",
                          value: `${Math.max(0, 100 - criticalCount * 15 - warnCount * 5)}%`,
                          sub: "Calculated",
                          clr: "blue",
                        },
                      ].map((kpi, i) => (
                        <div
                          key={i}
                          className={`rounded-2xl bg-white/[0.015] border border-${kpi.clr}-400/8 px-4 py-3.5 relative overflow-hidden animate-[fadeSlideIn_0.3s_ease_both]`}
                          style={{ animationDelay: `${i * 60}ms` }}
                        >
                          <div className="text-[8px] text-blue-300/25 uppercase tracking-wider font-bold">
                            {kpi.label}
                          </div>
                          <div
                            className={`text-[22px] font-extrabold font-mono leading-none mt-1.5 text-${kpi.clr}-300/75`}
                          >
                            {kpi.value}
                          </div>
                          <div className="text-[8px] text-blue-300/18 mt-1">
                            {kpi.sub}
                          </div>
                          <div
                            className={`absolute -bottom-4 -right-4 w-14 h-14 rounded-full blur-[18px] bg-${kpi.clr}-500/[0.05] pointer-events-none`}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Sensor Gauge Cards */}
                    <div>
                      <div className="text-[9px] text-blue-300/20 uppercase tracking-[0.15em] font-bold mb-3">
                        Sensor Performance
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {params
                          .filter((p) => p.kind === "analog")
                          .map((p, i) => {
                            const pct =
                              p.value != null && p.max != null && p.min != null
                                ? Math.round(
                                    ((p.value - p.min) / (p.max - p.min)) * 100,
                                  )
                                : 0;
                            const clr =
                              p.status === "critical"
                                ? "red"
                                : p.status === "warning"
                                  ? "amber"
                                  : "cyan";
                            const deviation =
                              p.value != null && p.nominal != null
                                ? Math.abs(p.value - p.nominal)
                                : 0;
                            const devPct =
                              p.nominal != null &&
                              p.max != null &&
                              p.min != null
                                ? Math.round(
                                    (deviation / (p.max - p.min)) * 100,
                                  )
                                : 0;
                            return (
                              <div
                                key={i}
                                className={`rounded-2xl bg-white/[0.015] border border-${clr}-400/8 p-4 relative overflow-hidden animate-[fadeSlideIn_0.35s_ease_both] group/g`}
                                style={{ animationDelay: `${i * 70}ms` }}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] text-blue-200/40 font-medium">
                                    {p.label}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {/* Trend arrow */}
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 10 10"
                                      fill="none"
                                      className={
                                        devPct < 10
                                          ? "text-emerald-400/50"
                                          : devPct < 25
                                            ? "text-amber-400/50"
                                            : "text-red-400/50"
                                      }
                                    >
                                      <path
                                        d={
                                          devPct < 10
                                            ? "M2 5h6M5 3l2 2-2 2"
                                            : pct > 60
                                              ? "M2 7l3-4 3 4"
                                              : "M2 3l3 4 3-4"
                                        }
                                        stroke="currentColor"
                                        strokeWidth="1.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                    <span
                                      className={`w-2 h-2 rounded-full bg-${clr}-400 animate-pulse-glow`}
                                      style={{
                                        color:
                                          clr === "red"
                                            ? "#ef4444"
                                            : clr === "amber"
                                              ? "#f59e0b"
                                              : "#22d3ee",
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-end gap-2">
                                  <div
                                    className={`text-[24px] font-extrabold font-mono leading-none ${clr === "red" ? "text-red-300/80" : clr === "amber" ? "text-amber-300/80" : "text-cyan-300/75"}`}
                                  >
                                    {p.value?.toFixed(p.decimals ?? 1)}
                                  </div>
                                  <div className="text-[10px] text-blue-300/25 mb-0.5">
                                    {p.unit}
                                  </div>
                                </div>
                                {/* Nominal vs actual */}
                                <div className="flex items-center gap-2 mt-2 text-[8px] text-blue-300/20">
                                  <span>
                                    Nominal: {p.nominal} {p.unit}
                                  </span>
                                  <span
                                    className={`font-semibold ${devPct < 10 ? "text-emerald-400/50" : devPct < 25 ? "text-amber-400/50" : "text-red-400/50"}`}
                                  >
                                    {devPct < 10
                                      ? "Stable"
                                      : devPct < 25
                                        ? `${devPct}% drift`
                                        : `${devPct}% deviated`}
                                  </span>
                                </div>
                                {/* Bar */}
                                <div className="mt-3 h-1.5 rounded-full bg-white/[0.03] overflow-hidden relative">
                                  {/* Nominal marker */}
                                  {p.nominal != null &&
                                    p.max != null &&
                                    p.min != null && (
                                      <div
                                        className="absolute top-0 h-full w-px bg-white/10"
                                        style={{
                                          left: `${((p.nominal - p.min) / (p.max - p.min)) * 100}%`,
                                        }}
                                      />
                                    )}
                                  <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${clr === "red" ? "bg-gradient-to-r from-red-600 to-red-400" : clr === "amber" ? "bg-gradient-to-r from-amber-600 to-amber-400" : "bg-gradient-to-r from-cyan-600 to-cyan-400"}`}
                                    style={{
                                      width: `${Math.min(100, Math.max(2, pct))}%`,
                                      boxShadow: `0 0 8px ${clr === "red" ? "rgba(239,68,68,0.3)" : clr === "amber" ? "rgba(245,158,11,0.3)" : "rgba(34,211,238,0.3)"}`,
                                    }}
                                  />
                                </div>
                                <div className="flex justify-between mt-1">
                                  <span className="text-[7px] text-blue-300/15">
                                    {p.min}
                                  </span>
                                  <span
                                    className={`text-[8px] font-bold ${clr === "red" ? "text-red-300/40" : clr === "amber" ? "text-amber-300/40" : "text-cyan-300/30"}`}
                                  >
                                    {pct}%
                                  </span>
                                  <span className="text-[7px] text-blue-300/15">
                                    {p.max}
                                  </span>
                                </div>
                                <div
                                  className={`absolute -bottom-6 -right-6 w-20 h-20 rounded-full blur-[20px] bg-${clr}-500/[0.04] group-hover/g:bg-${clr}-500/[0.08] transition-all pointer-events-none`}
                                />
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* System Status + Digital States */}
                    <div>
                      <div className="text-[9px] text-blue-300/20 uppercase tracking-[0.15em] font-bold mb-3">
                        System States
                      </div>
                      <div className="grid grid-cols-3 gap-3 animate-[fadeSlideIn_0.4s_ease]">
                        {(
                          [
                            {
                              label: "Motor Fan",
                              active: outputs.motorFanOn,
                              clr: "emerald",
                              activeLabel: "Running",
                              inactiveLabel: "Offline",
                              icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
                            },
                            {
                              label: "Alerts",
                              active: outputs.alerts.some(Boolean),
                              clr: "red",
                              activeLabel: "Active",
                              inactiveLabel: "Clear",
                              icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>`,
                            },
                            {
                              label: "Push Button",
                              active: outputs.pushButton,
                              clr: "amber",
                              activeLabel: "Pressed",
                              inactiveLabel: "Released",
                              icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>`,
                            },
                          ] as const
                        ).map((s) => (
                          <div
                            key={s.label}
                            className={`rounded-2xl bg-white/[0.015] border ${s.active ? `border-${s.clr}-400/10` : "border-white/[0.04]"} p-4`}
                          >
                            <div className="flex items-center gap-2.5 mb-2">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.active ? `bg-${s.clr}-500/10 border border-${s.clr}-400/12` : "bg-white/[0.03] border border-white/[0.05]"}`}
                              >
                                <span
                                  className="w-3.5 h-3.5"
                                  style={{
                                    color: s.active
                                      ? s.clr === "emerald"
                                        ? "#34d399"
                                        : s.clr === "red"
                                          ? "#f87171"
                                          : "#fbbf24"
                                      : "#475569",
                                  }}
                                  dangerouslySetInnerHTML={{ __html: s.icon }}
                                />
                              </div>
                              <span className="text-[10px] text-blue-200/40 font-medium">
                                {s.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div
                                className={`text-[15px] font-bold ${s.active ? `text-${s.clr}-300/75` : "text-blue-300/25"}`}
                              >
                                {s.active ? s.activeLabel : s.inactiveLabel}
                              </div>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider ${s.active ? `bg-${s.clr}-500/10 text-${s.clr}-300/60 border border-${s.clr}-400/10` : "bg-white/[0.02] text-blue-300/15 border border-white/[0.04]"}`}
                              >
                                {s.active ? "ON" : "OFF"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Advanced Analysis Suggestions */}
                    <div className="pt-3 border-t border-white/[0.03]">
                      <div className="text-[9px] text-blue-300/20 uppercase tracking-[0.15em] font-bold mb-3">
                        AI-Powered Analysis
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          {
                            icon: CHIP_ICONS.zap,
                            label: "Efficiency Report",
                            q: "Analyze overall factory efficiency. Compare current energy consumption vs output, identify waste, and suggest optimization strategies.",
                            accent: "cyan",
                          },
                          {
                            icon: CHIP_ICONS.clock,
                            label: "Predictive Maintenance",
                            q: "Based on current sensor trends and deviation patterns, predict which components need maintenance and estimate remaining useful life.",
                            accent: "violet",
                          },
                          {
                            icon: CHIP_ICONS.alert,
                            label: "Root Cause Analysis",
                            q: "Analyze all current warnings and anomalies. Identify potential root causes and correlations between sensor readings.",
                            accent: "amber",
                          },
                          {
                            icon: CHIP_ICONS.heart,
                            label: "Baseline Comparison",
                            q: "Compare current sensor readings against nominal values. Calculate standard deviation, drift rates, and flag statistically significant changes.",
                            accent: "emerald",
                          },
                          {
                            icon: CHIP_ICONS.file,
                            label: "Compliance Report",
                            q: "Generate a compliance report checking all parameters against their safe operating ranges and regulatory thresholds.",
                            accent: "blue",
                          },
                          {
                            icon: CHIP_ICONS.shield,
                            label: "Risk Assessment",
                            q: "Perform a risk assessment of current factory conditions. Rank potential failure modes by probability and impact severity.",
                            accent: "red",
                          },
                        ].map((a) => (
                          <button
                            key={a.label}
                            onClick={() => sendMessage(a.q)}
                            className={`flex items-start gap-3 text-left px-4 py-3 rounded-xl bg-white/[0.015] border border-white/[0.04] hover:bg-gradient-to-r hover:from-${a.accent}-500/[0.05] hover:to-transparent hover:border-${a.accent}-400/10 transition-all duration-300 group/aa`}
                          >
                            <span
                              className={`w-4 h-4 mt-0.5 opacity-25 group-hover/aa:opacity-55 flex-shrink-0 transition-opacity text-${a.accent}-400`}
                              dangerouslySetInnerHTML={{ __html: a.icon }}
                            />
                            <div>
                              <div className="text-[10.5px] font-semibold text-blue-200/40 group-hover/aa:text-cyan-100 transition-colors">
                                {a.label}
                              </div>
                              <div className="text-[9px] text-blue-300/18 mt-0.5 leading-relaxed line-clamp-2">
                                {a.q.slice(0, 80)}...
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── PROMPTS ─── */}
                {tab === "prompts" && (
                  <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
                    {PROMPT_CATEGORIES.map((cat, ci) => (
                      <div
                        key={cat.label}
                        className="animate-[fadeSlideIn_0.35s_ease_both]"
                        style={{ animationDelay: `${ci * 70}ms` }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className={`w-8 h-8 rounded-lg bg-${cat.color}-500/10 border border-${cat.color}-400/12 flex items-center justify-center`}
                          >
                            <span
                              className={`w-4 h-4 text-${cat.color}-400`}
                              dangerouslySetInnerHTML={{ __html: cat.icon }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-blue-200/50 uppercase tracking-[0.1em]">
                            {cat.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {cat.prompts.map((p) => (
                            <button
                              key={p}
                              onClick={() => sendMessage(p)}
                              className="text-left text-[10.5px] px-4 py-3.5 rounded-xl bg-white/[0.015] border border-white/[0.04] text-blue-200/35 hover:bg-gradient-to-r hover:from-cyan-500/[0.05] hover:to-violet-500/[0.02] hover:border-cyan-400/10 hover:text-cyan-100 transition-all duration-300 leading-relaxed group/p"
                            >
                              <span className="text-cyan-400/0 group-hover/p:text-cyan-400/40 transition-colors mr-1">
                                &rarr;
                              </span>
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ════════ RIGHT CONTEXT PANEL ════════ */}
              {showContext && (
                <div className="w-[240px] flex-shrink-0 border-l border-white/[0.03] flex flex-col bg-white/[0.005] animate-[fadeSlideIn_0.3s_ease]">
                  <div className="px-5 py-4 border-b border-white/[0.03]">
                    <div className="text-[9px] text-blue-300/20 uppercase tracking-[0.18em] font-bold">
                      Context Panel
                    </div>
                  </div>

                  {/* Live Metrics */}
                  <div className="px-5 py-4 border-b border-white/[0.03] space-y-3">
                    <div className="text-[8px] text-blue-300/18 uppercase tracking-[0.15em] font-bold">
                      Live Metrics
                    </div>
                    {params.map(
                      (p, i) =>
                        p.kind === "analog" && (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-blue-300/30">
                                {p.label}
                              </span>
                              <span
                                className={`text-[10px] font-mono font-bold ${p.status === "critical" ? "text-red-400" : p.status === "warning" ? "text-amber-400" : "text-cyan-300/50"}`}
                              >
                                {p.value?.toFixed(p.decimals ?? 1)}
                              </span>
                            </div>
                            <div className="h-1 rounded-full bg-white/[0.03] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${p.status === "critical" ? "bg-red-500" : p.status === "warning" ? "bg-amber-500" : "bg-cyan-500/60"}`}
                                style={{
                                  width: `${p.value != null && p.max != null && p.min != null ? Math.min(100, Math.max(2, ((p.value - p.min) / (p.max - p.min)) * 100)) : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        ),
                    )}
                  </div>

                  {/* System States */}
                  <div className="px-5 py-4 border-b border-white/[0.03] space-y-2.5">
                    <div className="text-[8px] text-blue-300/18 uppercase tracking-[0.15em] font-bold">
                      System State
                    </div>
                    {[
                      { label: "Motor Fan", active: outputs.motorFanOn },
                      { label: "Alerts", active: outputs.alerts.some(Boolean) },
                      { label: "Push Button", active: outputs.pushButton },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="flex items-center justify-between"
                      >
                        <span className="text-[9px] text-blue-300/25">
                          {s.label}
                        </span>
                        <span
                          className={`text-[9px] font-semibold px-2 py-0.5 rounded-md ${s.active ? "bg-emerald-500/10 text-emerald-400/70 border border-emerald-400/10" : "bg-white/[0.02] text-blue-300/20 border border-white/[0.04]"}`}
                        >
                          {s.active ? "ON" : "OFF"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* AI Capabilities */}
                  <div className="px-5 py-4 flex-1 overflow-y-auto">
                    <div className="text-[8px] text-blue-300/18 uppercase tracking-[0.15em] font-bold mb-2.5">
                      AI Capabilities
                    </div>
                    {[
                      "Real-time sensor analysis",
                      "Anomaly detection",
                      "Predictive maintenance",
                      "Natural language reports",
                      "Safety assessments",
                      "Energy optimization",
                      "Trend analysis",
                      "Incident reporting",
                    ].map((c) => (
                      <div key={c} className="flex items-center gap-2 py-1">
                        <span className="w-1 h-1 rounded-full bg-violet-400/30 flex-shrink-0" />
                        <span className="text-[9px] text-blue-300/25">{c}</span>
                      </div>
                    ))}
                  </div>

                  {/* Model info */}
                  <div className="px-5 py-3 border-t border-white/[0.03]">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-violet-500/10 border border-violet-400/10 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400/60" />
                      </div>
                      <div>
                        <div className="text-[8px] text-violet-300/40 font-bold">
                          Claude Haiku
                        </div>
                        <div className="text-[7px] text-blue-300/15">
                          Anthropic AI
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-7 py-2.5 border-t border-white/[0.03] flex-shrink-0">
              <div className="flex items-center gap-5 text-[8px] text-blue-300/18">
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400/30" />
                    <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400/60" />
                  </span>
                  AI Online
                </span>
                <span>{params.length} sensors monitored</span>
                <span>
                  {criticalCount} critical &middot; {warnCount} warnings
                </span>
              </div>
              <div className="text-[8px] text-blue-300/12">
                Powered by Claude &middot; Real-time factory intelligence
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/* ── AI Avatar ── */
const AIAvatar: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
    <div className="absolute inset-0 rounded-full border border-cyan-400/12 animate-[spinSlow_8s_linear_infinite]">
      <div className="absolute -top-[2px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]" />
    </div>
    <div className="absolute inset-[3px] rounded-full border border-violet-400/8 animate-[spinSlow_5s_linear_infinite_reverse]">
      <div className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-400 shadow-[0_0_4px_rgba(167,139,250,0.7)]" />
    </div>
    <div className="absolute inset-[6px] rounded-full bg-gradient-to-br from-cyan-500/12 to-violet-500/12 border border-cyan-300/8 flex items-center justify-center animate-[corePulse_4s_ease-in-out_infinite]">
      <svg
        width={size * 0.35}
        height={size * 0.35}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 2a10 10 0 100 20 10 10 0 000-20z"
          stroke="url(#av)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M8 12h8M12 8v8"
          stroke="#67e8f9"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="av" x1="2" y1="2" x2="22" y2="22">
            <stop stopColor="#67e8f9" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  </div>
);

/* ── Floating Button ── */
export const AIFloatingButton: React.FC<{ onClick: () => void }> = ({
  onClick,
}) => (
  <button
    onClick={onClick}
    className="fixed bottom-7 right-7 z-[9980] group/fab"
    aria-label="Open AI Assistant"
  >
    <div className="absolute inset-0 rounded-full bg-cyan-400/10 animate-[fabPing_3s_ease-out_infinite]" />
    <div
      className="absolute inset-0 rounded-full bg-violet-400/8 animate-[fabPing_3s_ease-out_infinite]"
      style={{ animationDelay: "1s" }}
    />
    <div
      className="relative w-[58px] h-[58px] rounded-full flex items-center justify-center transition-all duration-500 group-hover/fab:scale-110"
      style={{
        background:
          "linear-gradient(135deg, rgba(8,18,45,0.96), rgba(15,25,60,0.96))",
        border: "1px solid rgba(0,200,255,0.18)",
        boxShadow:
          "0 0 28px rgba(34,211,238,0.12), 0 0 60px rgba(167,139,250,0.06), 0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      <div
        className="absolute inset-[-2px] rounded-full animate-[spinSlow_5s_linear_infinite]"
        style={{
          background:
            "conic-gradient(from 0deg, transparent, rgba(34,211,238,0.35), transparent, rgba(167,139,250,0.25), transparent)",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))",
          WebkitMask:
            "radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))",
        }}
      />
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className="relative z-10"
      >
        <path
          d="M12 2a10 10 0 100 20 10 10 0 000-20z"
          stroke="url(#fg)"
          strokeWidth="1.3"
          fill="none"
        />
        <path
          d="M8.5 12h7M12 8.5v7"
          stroke="#67e8f9"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle
          cx="12"
          cy="12"
          r="2.5"
          stroke="#a78bfa"
          strokeWidth="0.8"
          fill="none"
          className="animate-[corePulse_2.5s_ease-in-out_infinite]"
        />
        <defs>
          <linearGradient id="fg" x1="2" y1="2" x2="22" y2="22">
            <stop stopColor="#67e8f9" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
    </div>
    <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-[#0a1d38]/95 border border-cyan-400/12 text-[10.5px] text-cyan-200/70 font-medium whitespace-nowrap opacity-0 -translate-x-2 group-hover/fab:opacity-100 group-hover/fab:translate-x-0 transition-all duration-300 pointer-events-none shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      AI Assistant
      <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-2 rotate-45 bg-[#0a1d38]/95 border-r border-t border-cyan-400/12" />
    </div>
  </button>
);

/* ── Icon maps ── */
const TAB_ICONS: Record<string, string> = {
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.956L3 21l1.5-4.5C3.56 15.07 3 13.59 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>`,
  insights: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  analytics: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
  prompts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
};

const CHIP_ICONS: Record<string, string> = {
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>`,
  zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
  file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
};

export default AIAssistantModal;
