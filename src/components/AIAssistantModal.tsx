import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { usePLCContext } from "../context/PLCContext";

/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Types ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
type Tab = "chat" | "insights" | "analytics" | "prompts";
const AI_PROXY_URL = "/api/factory-ai/chat";

/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ PLC context builder ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
function buildPLCContext(
  params: ReturnType<typeof usePLCContext>["params"],
  outputs: ReturnType<typeof usePLCContext>["outputs"],
): string {
  const lines: string[] = [];
  for (const p of params) {
    if (p.kind === "analog")
      lines.push(
        `${p.label}: ${p.value?.toFixed(p.decimals ?? 1)} ${p.unit ?? ""} (range ${p.min}ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“${p.max}, nominal ${p.nominal}, status: ${p.status})`,
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

/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Derive insights from live PLC ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
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
          body: `Reading ${p.value?.toFixed(p.decimals ?? 1)} ${p.unit ?? ""} ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â outside safe range (${p.min}ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“${p.max}).`,
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

/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Prompt categories ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
const PROMPT_CATEGORIES = [
  {
    label: "Operations & Status",
    color: "cyan",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>`,
    prompts: [
      "How is my overall system performance?",
      "How many units have been produced so far?",
      "What is the downtime of my system?",
    ],
  },
  {
    label: "Diagnostics & Analysis",
    color: "emerald",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
    prompts: [
      "List all devices connected through modbus/rs485 with plc.",
      "Which sensors are reporting abnormal values?",
      "Analyze the power consumption, voltage and current of 1-phase motor.",
      "Analyze ph and pressure sensor data.",
    ],
  },
  {
    label: "Emergency & Predictive",
    color: "red",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>`,
    prompts: [
      "The system is in emergency state. How to restart the plant?",
      "How many times has the system entered emergency state?",
      "Predict downtime risk for the plant.",
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

/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
   MAIN MODAL
   ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */
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
            content: "Governed Bedrock AI is currently unavailable.",
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
      {/* Backdrop ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â graphite scrim, no heavy blur */}
      <div
        className="fixed inset-0 z-[9990] animate-[fadeIn_0.25s_ease]"
        style={{ background: "rgba(6, 10, 16, 0.78)" }}
        onClick={onClose}
      />

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Modal ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <div className="fixed inset-0 z-[9991] flex items-center justify-center p-5 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-[1280px] h-[88vh] max-h-[860px] rounded-[10px] overflow-hidden flex relative animate-[modalIn_0.35s_cubic-bezier(0.16,1,0.3,1)]"
          style={{
            background:
              "linear-gradient(180deg, #141b27 0%, #0f1520 100%)",
            border: "1px solid #2a3444",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.03) inset, 0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(117,176,234,0.08)",
          }}
        >
          {/* Industrial precision grid + subtle accent line */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(117,176,234,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(117,176,234,0.025) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
            {/* Hairline header accent */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #75b0ea 50%, transparent)",
                opacity: 0.5,
              }}
            />
          </div>

          {/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â LEFT SIDEBAR ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */}
          <div
            className="w-[280px] flex-shrink-0 flex flex-col relative"
            style={{
              borderRight: "1px solid #2a3444",
              background:
                "linear-gradient(180deg, rgba(20,27,39,0.6) 0%, rgba(15,21,32,0.6) 100%)",
            }}
          >
            {/* AI Brand */}
            <div className="px-6 pt-7 pb-5">
              <div className="flex items-center gap-4">
                <AIAvatar size={48} />
                <div>
                  <div className="text-[15px] font-semibold tracking-tight" style={{ color: "#e4ebf3" }}>
                    Plant Copilot
                  </div>
                  <div className="text-[9px] mt-1 flex items-center gap-1.5" style={{ color: "#8a97a8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="relative rounded-full h-1.5 w-1.5" style={{ background: "#3fa66a" }} />
                    </span>
                    Online &middot; Ops Intelligence
                  </div>
                </div>
              </div>
              <div className="mt-4 text-[10px] leading-relaxed" style={{ color: "#8a97a8" }}>
                Real-time factory intelligence powered by live PLC sensor data
                and Claude AI.
              </div>
            </div>

            {/* Divider */}
            <div className="mx-5 h-px" style={{ background: "#2a3444" }} />

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
                      stroke="rgba(155,199,242,0.05)"
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

            <div className="mx-5 h-px" style={{ background: "#2a3444" }} />

            {/* Navigation */}
            <div className="px-4 py-4 space-y-1">
              <div className="text-[9px] px-2 mb-2" style={{ color: "#5d6a7c", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
                Navigation
              </div>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-[11px] font-medium transition-all duration-150 group/t"
                  style={{
                    background: tab === t.id ? "rgba(117,176,234,0.10)" : "transparent",
                    color: tab === t.id ? "#e4ebf3" : "#8a97a8",
                    border: tab === t.id ? "1px solid rgba(117,176,234,0.45)" : "1px solid transparent",
                    borderLeft: tab === t.id ? "2px solid #75b0ea" : "2px solid transparent",
                  }}
                >
                  <span
                    className={`w-[18px] h-[18px] flex-shrink-0 ${tab === t.id ? "opacity-90" : "opacity-50 group-hover/t:opacity-80"} transition-opacity`}
                    dangerouslySetInnerHTML={{ __html: TAB_ICONS[t.id] }}
                  />
                  {t.label}
                  {t.badge && t.badge > 0 && (
                    <span
                      className="ml-auto min-w-[20px] h-[18px] rounded-sm text-[9px] font-bold flex items-center justify-center px-1.5"
                      style={{
                        background: t.id === "insights" ? "rgba(238,28,37,0.15)" : "rgba(138,151,168,0.10)",
                        border: t.id === "insights" ? "1px solid rgba(238,28,37,0.4)" : "1px solid #2a3444",
                        color: t.id === "insights" ? "#d65544" : "#8a97a8",
                      }}
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mx-5 h-px" style={{ background: "#2a3444" }} />

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

          {/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â MAIN CONTENT ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */}
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
                {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ CHAT TAB ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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

                    {/* Input ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â industrial console entry */}
                    <div
                      className="px-7 py-4 flex-shrink-0"
                      style={{ borderTop: "1px solid #2a3444" }}
                    >
                      <div
                        className="flex items-center gap-3 px-4 py-3 transition-all duration-150 focus-within:border-[#75b0ea]"
                        style={{
                          background: "#1b2330",
                          border: "1px solid #2a3444",
                          borderRadius: "6px",
                        }}
                      >
                        <input
                          ref={inputRef}
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                          placeholder="Ask anything about your factory..."
                          className="flex-1 bg-transparent text-[13px] outline-none"
                          style={{ color: "#e4ebf3" }}
                          disabled={loading}
                        />
                        <button
                          onClick={() => sendMessage()}
                          disabled={loading || !input.trim()}
                          className="w-9 h-9 flex items-center justify-center transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#75b0ea15]"
                          style={{
                            background: "#141b27",
                            border: "1px solid #75b0ea",
                            borderRadius: "4px",
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                              stroke="#75b0ea"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center justify-center gap-3 mt-2.5">
                        <span className="text-[8px] text-blue-300/12">
                          Advisory only · Minimized PLC context is sent to AWS Bedrock
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

                {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ INSIGHTS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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

                {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ ANALYTICS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
                          value: outputs.motorFanOn ? "99.2%" : "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â",
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

                {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ PROMPTS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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

              {/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â RIGHT CONTEXT PANEL ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */}
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
                Governed by AWS Bedrock &middot; Advisory only
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ AI Avatar ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â industrial instrument dial ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
const AIAvatar: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
    {/* Outer graphite ring with accent tick */}
    <div
      className="absolute inset-0 rounded-full animate-[spinSlow_12s_linear_infinite]"
      style={{ border: "1px solid #2a3444" }}
    >
      <div
        className="absolute -top-[2px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
        style={{ background: "#75b0ea" }}
      />
    </div>
    {/* Inner dial */}
    <div
      className="absolute inset-[3px] rounded-full"
      style={{ border: "1px solid #3a475c" }}
    />
    {/* Core */}
    <div
      className="absolute inset-[6px] rounded-full flex items-center justify-center animate-[corePulse_4s_ease-in-out_infinite]"
      style={{
        background: "linear-gradient(180deg, #1b2330, #141b27)",
        border: "1px solid #3a475c",
      }}
    >
      <svg
        width={size * 0.4}
        height={size * 0.4}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 2a10 10 0 100 20 10 10 0 000-20z"
          stroke="#75b0ea"
          strokeWidth="1.4"
          fill="none"
        />
        <path
          d="M8 12h8M12 8v8"
          stroke="#e4ebf3"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  </div>
);

/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Floating Button ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â AI hero pill, instantly recognizable ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
export const AIFloatingButton: React.FC<{ onClick: () => void }> = ({
  onClick,
}) => (
  <button
    onClick={onClick}
    className="fixed bottom-7 right-7 z-[9980] group/fab"
    aria-label="Open AI Assistant"
    style={{ fontFamily: "'Montserrat', system-ui, sans-serif" }}
  >
    {/* Outer pulse ring ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â signals "live" */}
    <span
      className="absolute inset-0 rounded-full animate-[fabPing_2.6s_ease-out_infinite]"
      style={{
        border: "1px solid rgba(155, 199, 242, 0.5)",
        pointerEvents: "none",
      }}
    />
    <span
      className="absolute inset-0 rounded-full animate-[fabPing_2.6s_ease-out_infinite]"
      style={{
        border: "1px solid rgba(155, 199, 242, 0.3)",
        pointerEvents: "none",
        animationDelay: "1.2s",
      }}
    />

    {/* Main pill ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â icon + label + sparkle */}
    <div
      className="relative flex items-center gap-2.5 pl-2 pr-4 h-[52px] rounded-full transition-all duration-200 group-hover/fab:scale-[1.03]"
      style={{
        background:
          "linear-gradient(135deg, #0f2a33 0%, #173e4a 45%, #0f2a33 100%)",
        border: "1px solid rgba(155, 199, 242, 0.55)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.08)," +
          "inset 0 0 0 1px rgba(117,176,234,0.15)," +
          "0 8px 24px rgba(0,0,0,0.55)," +
          "0 0 32px rgba(117,176,234,0.22)",
      }}
    >
      {/* Icon puck */}
      <span
        className="relative w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, #9bc7f2 0%, #75b0ea 55%, #1e6a7b 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.25), 0 0 14px rgba(155,199,242,0.55)",
        }}
      >
        {/* Neural / spark glyph */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="ai-spark" x1="0" y1="0" x2="24" y2="24">
              <stop stopColor="#ffffff" />
              <stop offset="1" stopColor="#e4ebf3" />
            </linearGradient>
          </defs>
          {/* 4-point sparkle (big) */}
          <path
            d="M12 2.5 L13.6 10.4 L21.5 12 L13.6 13.6 L12 21.5 L10.4 13.6 L2.5 12 L10.4 10.4 Z"
            fill="url(#ai-spark)"
          />
          {/* small sparkle */}
          <path
            d="M18.5 4.2 L19.1 6.3 L21.2 6.9 L19.1 7.5 L18.5 9.6 L17.9 7.5 L15.8 6.9 L17.9 6.3 Z"
            fill="#ffffff"
            opacity="0.85"
          />
        </svg>
        {/* Online status dot */}
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
          style={{
            background: "#3fa66a",
            borderColor: "#0f2a33",
            boxShadow: "0 0 8px rgba(63,166,106,0.9)",
          }}
        />
      </span>

      {/* Text label ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â always visible, instantly identifies the button */}
      <span className="flex flex-col items-start leading-none">
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            background: "linear-gradient(180deg, #ffffff 0%, #cfdfec 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Plant Copilot
        </span>
        <span
          className="mt-1 flex items-center gap-1"
          style={{
            fontSize: "8px",
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: "#9bc7f2",
            textTransform: "uppercase",
          }}
        >
          <span
            className="inline-block w-1 h-1 rounded-full"
            style={{ background: "#3fa66a", boxShadow: "0 0 6px #3fa66a" }}
          />
          Ops Intelligence
        </span>
      </span>
    </div>

    {/* Keyboard hint ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â appears on hover */}
    <span
      className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-sm whitespace-nowrap opacity-0 -translate-x-1 group-hover/fab:opacity-100 group-hover/fab:translate-x-0 transition-all duration-200 pointer-events-none"
      style={{
        background: "#141b27",
        border: "1px solid #2a3444",
        color: "#8a97a8",
        fontSize: "9px",
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
      }}
    >
      Open Assistant
    </span>
  </button>
);

/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Icon maps ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
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
