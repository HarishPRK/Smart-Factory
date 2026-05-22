import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  useLangraphChat,
  type LangraphMessage,
} from "../hooks/useLangraphChat";

/**
 * Minimal chat drawer for the external langgraph agent.
 *
 * Self-contained: mounts a floating button (bottom-left, so it doesn't fight
 * Plant Copilot at bottom-right) plus a small drawer with the conversation.
 * No tabs, no PLC context, no streaming — submit → poll → render.
 */
const LanggraphAgentPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const chat = useLangraphChat();

  return (
    <>
      <FloatingButton open={open} onClick={() => setOpen((v) => !v)} />
      {open && <Drawer chat={chat} onClose={() => setOpen(false)} />}
    </>
  );
};

export default LanggraphAgentPanel;

/* ── Floating button ───────────────────────────────────── */

const FloatingButton: React.FC<{ open: boolean; onClick: () => void }> = ({
  open,
  onClick,
}) => (
  <button
    onClick={onClick}
    aria-label="Langgraph agent"
    style={{
      position: "fixed",
      left: "20px",
      bottom: "20px",
      zIndex: 40,
      width: "56px",
      height: "56px",
      borderRadius: "16px",
      border: "1px solid rgba(139, 92, 246, 0.45)",
      background:
        "linear-gradient(135deg, rgba(91, 33, 182, 0.88), rgba(30, 58, 138, 0.88))",
      boxShadow: open
        ? "0 0 0 3px rgba(139, 92, 246, 0.25), 0 12px 28px rgba(0,0,0,0.45)"
        : "0 10px 24px rgba(0,0,0,0.45)",
      color: "#e9d5ff",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "box-shadow 0.15s ease, transform 0.15s ease",
      transform: open ? "translateY(-2px)" : "translateY(0)",
    }}
  >
    {/* Graph-ish glyph so it reads "agent" not "chat" */}
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="6" r="2" fill="currentColor" />
      <circle cx="19" cy="6" r="2" fill="currentColor" />
      <circle cx="12" cy="14" r="2.4" fill="currentColor" />
      <circle cx="6" cy="19" r="1.8" fill="currentColor" />
      <circle cx="18" cy="19" r="1.8" fill="currentColor" />
      <path
        d="M5 6 L12 14 L19 6 M6 19 L12 14 L18 19"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  </button>
);

/* ── Drawer ────────────────────────────────────────────── */

interface DrawerProps {
  chat: ReturnType<typeof useLangraphChat>;
  onClose: () => void;
}

const Drawer: React.FC<DrawerProps> = ({ chat, onClose }) => {
  const { messages, pending, send, cancel, clear } = chat;
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages / pending updates.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // ESC closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    void send(text);
  };

  // Portal the modal to <body> so it lives above every other layer in the
  // app (dashboard panels, 3D canvas, floating buttons) without worrying
  // about local stacking contexts.
  return ReactDOM.createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(4, 6, 12, 0.72)",
        backdropFilter: "blur(4px)",
        animation: "lg-modal-fade 160ms ease-out",
      }}
    >
      <style>
        {`@keyframes lg-modal-fade {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes lg-modal-rise {
            from { opacity: 0; transform: translateY(14px) scale(0.98); }
            to   { opacity: 1; transform: translateY(0)    scale(1);    }
          }
          @keyframes lg-orb-pulse {
            0%, 100% { transform: scale(1);    opacity: 0.85; }
            50%      { transform: scale(1.08); opacity: 1;    }
          }
          @keyframes lg-orb-ring {
            0%   { transform: scale(0.6); opacity: 0.6; }
            100% { transform: scale(2.2); opacity: 0;    }
          }
          @keyframes lg-orb-spin {
            from { transform: rotate(0deg);   }
            to   { transform: rotate(360deg); }
          }
          @keyframes lg-header-trace {
            0%   { left: -25%; }
            100% { left: 125%; }
          }
          @keyframes lg-prompt-rise {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0);   }
          }
          @keyframes lg-shimmer-sweep {
            0%   { background-position: -200% 0; }
            100% { background-position:  200% 0; }
          }
          @keyframes lg-thinking-dot {
            0%, 80%, 100% { transform: translateY(0)   scale(0.8); opacity: 0.4; }
            40%           { transform: translateY(-3px) scale(1.1); opacity: 1;   }
          }
          @keyframes lg-bubble-glow {
            0%, 100% {
              box-shadow:
                0 0 0 1px rgba(167, 139, 250, 0.32),
                0 0 18px rgba(139, 92, 246, 0.18);
            }
            50% {
              box-shadow:
                0 0 0 1px rgba(167, 139, 250, 0.55),
                0 0 28px rgba(139, 92, 246, 0.42);
            }
          }
          @keyframes lg-phase-fade {
            0%   { opacity: 0; transform: translateY(4px); }
            15%  { opacity: 1; transform: translateY(0);   }
            85%  { opacity: 1; transform: translateY(0);   }
            100% { opacity: 0; transform: translateY(-4px); }
          }
          @keyframes lg-ambient-float {
            0%, 100% { transform: translate(0, 0)       scale(1);    }
            33%      { transform: translate(20px,-18px) scale(1.06); }
            66%      { transform: translate(-14px,12px) scale(0.94); }
          }
          .lg-shimmer-text {
            background: linear-gradient(
              90deg,
              #c4b5fd 0%,
              #ffffff 30%,
              #f5f3ff 50%,
              #ffffff 70%,
              #c4b5fd 100%
            );
            background-size: 200% 100%;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: lg-shimmer-sweep 2.4s linear infinite;
          }
          .lg-prompt-card:hover {
            background: rgba(139, 92, 246, 0.22) !important;
            border-color: rgba(167, 139, 250, 0.55) !important;
            transform: translateY(-2px);
            box-shadow:
              0 8px 18px rgba(0,0,0,0.35),
              0 0 0 1px rgba(167, 139, 250, 0.25),
              0 0 24px rgba(139, 92, 246, 0.18);
          }
          `}
      </style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Factory assistant"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(820px, 94vw)",
          height: "min(900px, 92vh)",
          borderRadius: "20px",
          border: "1px solid rgba(139, 92, 246, 0.32)",
          background: "rgba(10, 12, 22, 0.96)",
          boxShadow:
            "0 30px 90px rgba(0,0,0,0.7), 0 0 0 1px rgba(139, 92, 246, 0.15)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          color: "#e5e7eb",
          animation: "lg-modal-rise 200ms ease-out",
        }}
      >
        {/* Ambient backdrop orbs — visible behind every state */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-80px",
            left: "-80px",
            width: "260px",
            height: "260px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(139,92,246,0.28), transparent 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
            animation: "lg-ambient-float 14s ease-in-out infinite",
            zIndex: 0,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: "-100px",
            right: "-90px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(99,102,241,0.22), transparent 70%)",
            filter: "blur(50px)",
            pointerEvents: "none",
            animation: "lg-ambient-float 18s ease-in-out infinite reverse",
            zIndex: 0,
          }}
        />

        {/* Header */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid rgba(139, 92, 246, 0.22)",
            background:
              "linear-gradient(180deg, rgba(76, 29, 149, 0.32), rgba(30, 27, 75, 0.0))",
            zIndex: 2,
          }}
        >
          {/* Animated trace under header */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "-1px",
              height: "1px",
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "-25%",
                width: "25%",
                height: "100%",
                background:
                  "linear-gradient(90deg, transparent, rgba(196, 181, 253, 0.95), transparent)",
                animation: "lg-header-trace 3.2s linear infinite",
              }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#f5f3ff",
              }}
            >
              Factory Assistant
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "#a78bfa",
                marginTop: "2px",
              }}
            >
              Ask anything about the plant
            </div>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <IconButton
              onClick={clear}
              disabled={pending || messages.length === 0}
              title="Clear conversation"
            >
              Clear
            </IconButton>
            <IconButton onClick={onClose} title="Close">
              ✕
            </IconButton>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            position: "relative",
            zIndex: 2,
            flex: 1,
            overflowY: "auto",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            scrollBehavior: "smooth",
          }}
        >
          {messages.length === 0 ? (
            <EmptyState
              onPromptClick={(p) => {
                if (pending) return;
                void send(p);
              }}
              disabled={pending}
            />
          ) : (
            messages.map((m) => (
              <MessageBubble key={m.id} message={m} onCancel={cancel} />
            ))
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            gap: "8px",
            padding: "10px 12px 12px",
            borderTop: "1px solid rgba(139, 92, 246, 0.22)",
            background: "rgba(8, 10, 18, 0.78)",
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              pending ? "Thinking…" : "Ask me anything about the plant"
            }
            disabled={pending}
            style={{
              flex: 1,
              background: "rgba(30, 27, 75, 0.35)",
              border: "1px solid rgba(139, 92, 246, 0.25)",
              borderRadius: "10px",
              padding: "11px 14px",
              color: "#e5e7eb",
              fontSize: "15px",
              outline: "none",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor =
                "rgba(167, 139, 250, 0.6)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor =
                "rgba(139, 92, 246, 0.25)";
            }}
          />
          <button
            type="submit"
            disabled={pending || input.trim().length === 0}
            style={{
              background:
                pending || input.trim().length === 0
                  ? "rgba(91, 33, 182, 0.35)"
                  : "linear-gradient(135deg, #7c3aed, #4338ca)",
              border: "1px solid rgba(167, 139, 250, 0.45)",
              borderRadius: "10px",
              color: "#f5f3ff",
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              padding: "0 18px",
              cursor:
                pending || input.trim().length === 0 ? "default" : "pointer",
              opacity: pending || input.trim().length === 0 ? 0.6 : 1,
            }}
          >
            SEND
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
};

/* ── Sub-components ────────────────────────────────────── */

const IconButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}> = ({ onClick, disabled, title, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      background: "rgba(139, 92, 246, 0.12)",
      border: "1px solid rgba(139, 92, 246, 0.2)",
      borderRadius: "6px",
      color: "#ddd6fe",
      fontSize: "12px",
      fontWeight: 600,
      letterSpacing: "0.05em",
      padding: "5px 10px",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.4 : 1,
    }}
  >
    {children}
  </button>
);

const SAMPLE_PROMPTS = [
  "How is my overall factory performance?",
  "How many units have been produced so far?",
  "How many times has my system been in emergency state?",
  "Only the red lights are ON in both the panels array alerts. I tried pressing the green button but the plant operation did not start. What to do?",
  "Start the plant operations.",
];

interface EmptyStateProps {
  onPromptClick: (prompt: string) => void;
  disabled?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onPromptClick, disabled }) => (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "18px",
      color: "#c4b5fd",
      textAlign: "center",
      padding: "28px 20px",
    }}
  >
    {/* Glowing orb with pulse rings + slow-rotating sparkle ring */}
    <div
      style={{
        position: "relative",
        width: "84px",
        height: "84px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Expanding pulse rings */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "1px solid rgba(167, 139, 250, 0.5)",
            animation: "lg-orb-ring 2.6s ease-out infinite",
            animationDelay: `${i * 0.85}s`,
          }}
        />
      ))}
      {/* Slow-spinning sparkle ring */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-6px",
          borderRadius: "50%",
          border: "1px dashed rgba(196, 181, 253, 0.32)",
          animation: "lg-orb-spin 14s linear infinite",
        }}
      />
      {/* Core orb */}
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 28%, #ddd6fe 0%, #a78bfa 35%, #6d28d9 75%, #4c1d95 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow:
            "0 0 28px rgba(167, 139, 250, 0.7), inset 0 0 14px rgba(255,255,255,0.18)",
          animation: "lg-orb-pulse 3.2s ease-in-out infinite",
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z"
            fill="#f5f3ff"
          />
          <circle cx="19" cy="5" r="1.4" fill="#f5f3ff" opacity="0.85" />
          <circle cx="5" cy="19" r="1" fill="#f5f3ff" opacity="0.6" />
        </svg>
      </div>
    </div>

    {/* Live badge */}
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "999px",
        background:
          "linear-gradient(180deg, rgba(16,185,129,0.15), rgba(16,185,129,0.04))",
        border: "1px solid rgba(16, 185, 129, 0.35)",
        fontSize: "10.5px",
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "#6ee7b7",
        marginTop: "-4px",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "999px",
          background: "#34d399",
          boxShadow: "0 0 8px #34d399",
        }}
      />
      Plant Connected
    </div>

    <div
      style={{
        fontSize: "20px",
        fontWeight: 700,
        letterSpacing: "-0.01em",
      }}
      className="lg-shimmer-text"
    >
      Hi there — how can I help?
    </div>
    <div
      style={{
        fontSize: "14px",
        lineHeight: 1.6,
        maxWidth: "460px",
        color: "#cbd5e1",
      }}
    >
      I can answer questions about your plant's live operations, machines,
      alerts, and history. Try one of these to get started:
    </div>

    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        width: "100%",
        maxWidth: "560px",
        marginTop: "4px",
      }}
    >
      {SAMPLE_PROMPTS.map((p, i) => (
        <button
          key={p}
          type="button"
          onClick={() => onPromptClick(p)}
          disabled={disabled}
          className="lg-prompt-card"
          style={{
            fontSize: "14px",
            lineHeight: 1.5,
            color: "#ede9fe",
            background:
              "linear-gradient(180deg, rgba(139, 92, 246, 0.14), rgba(91, 33, 182, 0.06))",
            border: "1px solid rgba(139, 92, 246, 0.28)",
            borderRadius: "12px",
            padding: "12px 16px 12px 38px",
            textAlign: "left",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.55 : 1,
            transition:
              "background 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
            fontFamily: "inherit",
            position: "relative",
            overflow: "hidden",
            animation: `lg-prompt-rise 0.45s ease-out both`,
            animationDelay: `${0.06 * i + 0.05}s`,
            boxShadow:
              "0 4px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Leading sparkle bullet */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #c4b5fd 0%, #7c3aed 65%, transparent 100%)",
              boxShadow: "0 0 10px rgba(167, 139, 250, 0.6)",
            }}
          />
          <span style={{ position: "relative", zIndex: 1 }}>“{p}”</span>
        </button>
      ))}
    </div>
  </div>
);

const MessageBubble: React.FC<{
  message: LangraphMessage;
  onCancel: () => void;
}> = ({ message, onCancel }) => {
  const isUser = message.role === "user";
  const isPending = !isUser && message.status === "pending";
  const accent = bubbleAccent(message);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: isPending ? "92%" : "86%",
          width: isPending ? "92%" : undefined,
          background: isPending
            ? "linear-gradient(135deg, rgba(76,29,149,0.45), rgba(30,27,75,0.55))"
            : accent.bg,
          border: `1px solid ${accent.border}`,
          borderRadius: isUser ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
          padding: isPending ? "14px 16px" : "10px 14px",
          color: accent.text,
          fontSize: "15px",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          // Animated glow ring on the active "thinking" bubble
          animation: isPending
            ? "lg-bubble-glow 2.4s ease-in-out infinite"
            : undefined,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {renderBubbleContent(message, onCancel)}
      </div>
    </div>
  );
};

function bubbleAccent(m: LangraphMessage) {
  if (m.role === "user") {
    return {
      bg: "rgba(79, 70, 229, 0.22)",
      border: "rgba(129, 140, 248, 0.35)",
      text: "#e0e7ff",
    };
  }
  if (m.status === "error") {
    return {
      bg: "rgba(127, 29, 29, 0.35)",
      border: "rgba(248, 113, 113, 0.45)",
      text: "#fecaca",
    };
  }
  if (m.status === "canceled") {
    return {
      bg: "rgba(55, 65, 81, 0.35)",
      border: "rgba(148, 163, 184, 0.35)",
      text: "#cbd5e1",
    };
  }
  return {
    bg: "rgba(30, 27, 75, 0.55)",
    border: "rgba(139, 92, 246, 0.28)",
    text: "#ede9fe",
  };
}

function renderBubbleContent(m: LangraphMessage, onCancel: () => void) {
  if (m.role === "user") return m.content;

  if (m.status === "pending") {
    return <ThinkingContent elapsedMs={m.elapsedMs ?? 0} onCancel={onCancel} />;
  }

  if (m.status === "canceled") {
    return (
      <span style={{ fontStyle: "italic", color: "#9ca3af" }}>Canceled.</span>
    );
  }

  if (m.status === "error") {
    return (
      <div>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#fca5a5",
            marginBottom: "4px",
          }}
        >
          ERROR
        </div>
        <div>{m.error || "Unknown error"}</div>
      </div>
    );
  }

  return m.content || <span style={{ color: "#9ca3af" }}>(empty reply)</span>;
}

/* ── Thinking state ────────────────────────────────────── */

const THINKING_PHASES = [
  { label: "Routing query…", icon: "↪" },
  { label: "Fetching from Historian…", icon: "⟳" },
  { label: "Analyzing live PLC signals…", icon: "⟁" },
  { label: "Cross-checking alerts…", icon: "⚠" },
  { label: "Synthesizing answer…", icon: "✦" },
];

const ThinkingContent: React.FC<{ elapsedMs: number; onCancel: () => void }> = ({
  elapsedMs,
  onCancel,
}) => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((p) => (p + 1) % THINKING_PHASES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  const sec = (elapsedMs / 1000).toFixed(1);
  const current = THINKING_PHASES[phase];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        position: "relative",
      }}
    >
      {/* Top row: spinning core + shimmering "Thinking" label + timer + cancel */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Spinning sparkle core */}
        <div
          aria-hidden
          style={{
            position: "relative",
            width: "26px",
            height: "26px",
            flex: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "1.5px solid rgba(167,139,250,0.45)",
              borderTopColor: "rgba(244,244,255,0.95)",
              borderRightColor: "rgba(196,181,253,0.85)",
              animation: "lg-orb-spin 1.1s linear infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "5px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 30% 30%, #ddd6fe, #7c3aed 70%)",
              boxShadow: "0 0 12px rgba(167,139,250,0.7)",
              animation: "lg-orb-pulse 1.6s ease-in-out infinite",
            }}
          />
        </div>

        <div
          className="lg-shimmer-text"
          style={{
            fontSize: "15px",
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          Thinking
        </div>

        {/* Bouncing dots */}
        <div style={{ display: "flex", gap: "4px", alignItems: "flex-end" }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: "#c4b5fd",
                boxShadow: "0 0 6px rgba(167,139,250,0.7)",
                animation: `lg-thinking-dot 1.1s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </div>

        <span style={{ flex: 1 }} />

        {/* Elapsed timer */}
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#a78bfa",
            fontVariantNumeric: "tabular-nums",
            padding: "3px 8px",
            borderRadius: "999px",
            background: "rgba(139, 92, 246, 0.14)",
            border: "1px solid rgba(139, 92, 246, 0.28)",
          }}
        >
          {sec}s
        </span>

        <button
          onClick={onCancel}
          style={{
            background: "rgba(239, 68, 68, 0.10)",
            border: "1px solid rgba(248, 113, 113, 0.35)",
            color: "#fca5a5",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            padding: "3px 10px",
            borderRadius: "999px",
            transition: "background 0.15s ease, color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239, 68, 68, 0.22)";
            e.currentTarget.style.color = "#fecaca";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(239, 68, 68, 0.10)";
            e.currentTarget.style.color = "#fca5a5";
          }}
        >
          Cancel
        </button>
      </div>

      {/* Progress trace track */}
      <div
        aria-hidden
        style={{
          height: "2px",
          borderRadius: "999px",
          background: "rgba(139, 92, 246, 0.12)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "-30%",
            width: "30%",
            height: "100%",
            background:
              "linear-gradient(90deg, transparent, rgba(196,181,253,0.95), transparent)",
            animation: "lg-header-trace 1.6s linear infinite",
          }}
        />
      </div>

      {/* Cycling phase row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          minHeight: "20px",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "20px",
            height: "20px",
            borderRadius: "6px",
            background: "rgba(167, 139, 250, 0.14)",
            border: "1px solid rgba(167, 139, 250, 0.28)",
            color: "#ddd6fe",
            fontSize: "11px",
          }}
        >
          {current.icon}
        </span>
        <span
          key={phase}
          style={{
            fontSize: "13px",
            color: "#cbd5e1",
            letterSpacing: "0.01em",
            animation: "lg-phase-fade 1.8s ease both",
          }}
        >
          {current.label}
        </span>
      </div>
    </div>
  );
};
