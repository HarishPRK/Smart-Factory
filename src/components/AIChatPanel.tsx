import React, { useState, useRef, useEffect } from "react";
import { usePLCContext } from "../context/PLCContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AI_PROXY_URL = "http://localhost:9002/chat";

function buildPLCContext(params: ReturnType<typeof usePLCContext>["params"], outputs: ReturnType<typeof usePLCContext>["outputs"]): string {
  const lines: string[] = [];

  for (const p of params) {
    if (p.kind === "analog") {
      lines.push(`${p.label}: ${p.value?.toFixed(p.decimals ?? 1)} ${p.unit ?? ""} (range ${p.min}–${p.max}, nominal ${p.nominal}, status: ${p.status})`);
    } else if (p.kind === "digital") {
      lines.push(`${p.label}: ${p.active ? "ACTIVE" : "INACTIVE"}`);
    } else if (p.kind === "relay") {
      const color = p.accentHex === "#ef4444" ? "RED (sensor triggered)" : "#10b981" ? "GREEN (healthy)" : "UNKNOWN";
      lines.push(`Relay: ${color}`);
    }
  }

  lines.push(`Motor Fan: ${outputs.motorFanOn ? "RUNNING" : "OFF"}`);
  lines.push(`Alerts: ${outputs.alerts.some(Boolean) ? "ACTIVE" : "NONE"}`);
  lines.push(`Push Button: ${outputs.pushButton ? "PRESSED" : "RELEASED"}`);

  return lines.join("\n");
}

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ open, onClose }) => {
  const { params, outputs } = usePLCContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const plcContext = buildPLCContext(params, outputs);
      const res = await fetch(AI_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          plcContext,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that request." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection to AI proxy failed. Make sure `npm run ai-proxy` is running." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9990] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-[9991] w-[420px] max-w-[90vw] flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex-1 flex flex-col bg-[#070e1b]/95 backdrop-blur-xl border-l border-cyan-500/10 shadow-[-8px_0_30px_rgba(0,0,0,0.5)]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-500/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-400/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
                  <path d="M8 12h8M12 8v8" stroke="#67e8f9" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-cyan-50 tracking-wide">Factory AI Assistant</div>
                <div className="text-[10px] text-cyan-300/50">Powered by Claude · Live PLC Context</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-400/10 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="none" stroke="#a78bfa" strokeWidth="1.2" />
                    <path d="M8 12h8M12 8v8" stroke="#67e8f9" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-[13px] text-blue-200/60 font-medium">Ask me about the factory</div>
                  <div className="text-[11px] text-blue-300/30 mt-1.5 leading-relaxed max-w-[260px]">
                    I can see live PLC data. Try asking about sensor values, machine status, or anomalies.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {[
                    "What's the factory status?",
                    "Is voltage normal?",
                    "Any anomalies?",
                    "Explain the relay state",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="text-[10px] px-3 py-1.5 rounded-lg bg-cyan-500/[0.06] border border-cyan-400/10 text-cyan-300/60 hover:bg-cyan-500/[0.12] hover:text-cyan-200/80 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-cyan-500/[0.12] border border-cyan-400/15 text-cyan-100"
                      : "bg-white/[0.04] border border-white/[0.06] text-blue-100/80"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="text-[9px] text-violet-400/60 font-semibold uppercase tracking-wider mb-1.5">Claude</div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-[10px] text-blue-300/40">Analyzing factory data...</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-cyan-500/10">
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 focus-within:border-cyan-400/20 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask about factory status..."
                className="flex-1 bg-transparent text-[12px] text-cyan-50 placeholder:text-blue-300/25 outline-none"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-lg bg-cyan-500/[0.12] border border-cyan-400/15 flex items-center justify-center hover:bg-cyan-500/[0.2] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="text-[9px] text-blue-300/20 text-center mt-2">
              AI reads live PLC data with each message
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AIChatPanel;
