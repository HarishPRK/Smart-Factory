import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { ArrowUp, Bot, Network, ShieldAlert, X, Zap } from "lucide-react";
import {
  useLangraphChat,
  type LangraphMessage,
} from "../hooks/useLangraphChat";

/**
 * Chat for the external LangGraph agent. Dashboard owns the named launchers;
 * this component remains mounted so closing the dialog keeps the conversation.
 * Prompts are sent only on submission or an explicit suggested-prompt click.
 */
const LanggraphAgentPanel: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const chat = useLangraphChat();

  return open ? <Drawer chat={chat} onClose={onClose} /> : null;
};

export default LanggraphAgentPanel;

/* -- Drawer ---------------------------------------------- */

interface DrawerProps {
  chat: ReturnType<typeof useLangraphChat>;
  onClose: () => void;
}

const Drawer: React.FC<DrawerProps> = ({ chat, onClose }) => {
  const { messages, pending, send, cancel, clear } = chat;
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Auto-scroll to bottom on new messages / pending updates.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Keep keyboard navigation in the dialog and restore the launcher's focus.
  useEffect(() => {
    const launcher = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []);
    (dialogRef.current?.querySelector<HTMLInputElement>("input") ?? dialogRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
      if (e.key === "Tab") {
        const controls = focusable();
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (e.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (launcher?.isConnected) launcher.focus();
    };
  }, []);

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
        ref={dialogRef}
        id="langgraph-agent-dialog"
        className="langgraph-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="LangGraph AI factory assistant"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(1080px, 96vw)",
          height: "min(900px, 92vh)",
          borderRadius: "22px",
          border: "1px solid rgba(139, 92, 246, 0.32)",
          background: "rgba(10, 12, 22, 0.96)",
          boxShadow:
            "0 30px 90px rgba(0,0,0,0.7), 0 0 0 1px rgba(139, 92, 246, 0.15)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'Montserrat', 'Segoe UI', system-ui, sans-serif",
          color: "#e5e7eb",
          animation: "lg-modal-rise 200ms ease-out",
        }}
      >
        {/* Ambient backdrop orbs - visible behind every state */}
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
          className="langgraph-dialog__header"
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <Bot size={26} color="#43d8f1" aria-hidden />
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 650,
                  color: "#eef5f7",
                  marginBottom: "2px",
                }}
              >
                LangGraph AI
              </h2>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 450,
                  color: "#a7bbc6",
                }}
              >
                External factory agent · advisory
              </div>
            </div>
          </div>
          <div
            className="langgraph-dialog__actions"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginLeft: "auto",
            }}
          >
            <div style={{ display: "flex", gap: "6px" }}>
              <IconButton
                onClick={clear}
                disabled={pending || messages.length === 0}
                title="Clear conversation"
              >
                Clear
              </IconButton>
              <IconButton onClick={onClose} title="Close LangGraph AI">
                <X size={14} aria-hidden />
              </IconButton>
            </div>
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
            padding: "18px clamp(16px, 7vw, 132px)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            scrollBehavior: "smooth",
          }}
        >
          {messages.length === 0 ? (
            <EmptyState
              input={input}
              pending={pending}
              onChange={setInput}
              onSubmit={handleSubmit}
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

        {messages.length > 0 && (
          <AssistantComposer
            compact
            input={input}
            pending={pending}
            onChange={setInput}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>,
    document.body,
  );
};

/* -- Sub-components -------------------------------------- */

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
    aria-label={title}
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

const AssistantComposer: React.FC<{
  input: string;
  pending: boolean;
  compact?: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}> = ({ input, pending, compact = false, onChange, onSubmit }) => {
  const ready = !pending && input.trim().length > 0;

  return (
    <form
      onSubmit={onSubmit}
      style={{
        position: "relative",
        zIndex: 2,
        width: compact ? "100%" : "min(760px, 100%)",
        margin: compact ? 0 : "6px auto 2px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: compact ? "10px 14px" : "11px 12px 11px 16px",
        border: "1px solid rgba(139, 92, 246, 0.42)",
        borderRadius: compact ? 0 : "16px",
        background: compact ? "rgba(8, 10, 18, 0.9)" : "rgba(20, 12, 43, 0.66)",
        boxShadow: compact ? undefined : "0 18px 42px rgba(0, 0, 0, 0.28)",
      }}
    >
      <div
        className="langgraph-composer__source"
        aria-hidden
        style={{
          display: compact ? "none" : "inline-flex",
          alignItems: "center",
          gap: "6px",
          color: "#a7f3d0",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "#34d399",
            boxShadow: "0 0 9px rgba(52, 211, 153, 0.85)",
          }}
        />
        Agent
      </div>
      <input
        type="text"
        aria-label="Message LangGraph AI"
        value={input}
        onChange={(event) => onChange(event.target.value)}
        placeholder={pending ? "Agent is processing your request…" : "Ask anything about the plant…"}
        disabled={pending}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          color: "#f5f3ff",
          fontFamily: "inherit",
          fontSize: compact ? "14px" : "15px",
          lineHeight: 1.45,
          padding: compact ? "2px 0" : "5px 0",
        }}
      />
      <button
        type="submit"
        aria-label="Send message"
        disabled={!ready}
        style={{
          width: compact ? "44px" : "38px",
          height: compact ? "36px" : "38px",
          border: "1px solid rgba(196, 181, 253, 0.4)",
          borderRadius: "50%",
          background: ready ? "#6d3bd3" : "rgba(91, 33, 182, 0.24)",
          color: "#f5f3ff",
          cursor: ready ? "pointer" : "default",
          fontSize: "20px",
          lineHeight: 1,
          opacity: ready ? 1 : 0.48,
        }}
      >
        <ArrowUp size={19} aria-hidden />
      </button>
    </form>
  );
};

const SAMPLE_PROMPTS = [
  "How is the system performing overall?",
  "How many units have been produced so far?",
  "How much downtime has the system had?",
  "How can I restart the plant after an emergency state?",
  "Which devices are connected to the PLC through Modbus / RS485?",
  "How many times has the system entered an emergency state?",
  "What do the single-phase motor's power, voltage, and current readings show?",
  "What do the pressure sensor readings show?",
  "What is the predicted downtime risk for the plant?"
];

const FEATURED_PROMPTS = [
  {
    title: "Emergency recovery",
    detail: "Get the safe restart path when the plant enters an emergency state.",
    prompt: SAMPLE_PROMPTS[3],
    Icon: ShieldAlert,
  },
  {
    title: "Connected devices",
    detail: "Inspect the devices connected to the PLC through Modbus / RS485.",
    prompt: SAMPLE_PROMPTS[4],
    Icon: Network,
  },
  {
    title: "Motor energy analysis",
    detail: "Analyze single-phase motor power, voltage, and current together.",
    prompt: SAMPLE_PROMPTS[6],
    Icon: Zap,
  },
];

const SECONDARY_PROMPTS = [
  SAMPLE_PROMPTS[0],
  SAMPLE_PROMPTS[1],
  SAMPLE_PROMPTS[2],
  SAMPLE_PROMPTS[5],
  SAMPLE_PROMPTS[7],
  SAMPLE_PROMPTS[8],
];

interface EmptyStateProps {
  input: string;
  pending: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onPromptClick: (prompt: string) => void;
  disabled?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  input,
  pending,
  onChange,
  onSubmit,
  onPromptClick,
  disabled,
}) => (
  <div
    className="langgraph-empty"
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
    <h3 className="langgraph-empty__heading">
      What needs attention at the plant?
    </h3>
    <p className="langgraph-empty__help">Ask about production, downtime, devices, or sensor readings.</p>

    <AssistantComposer
      input={input}
      pending={pending}
      onChange={onChange}
      onSubmit={onSubmit}
    />

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        gap: "10px",
        width: "100%",
        maxWidth: "760px",
        marginTop: "8px",
      }}
    >
      {FEATURED_PROMPTS.map((item, i) => (
        <button
          key={item.title}
          type="button"
          onClick={() => onPromptClick(item.prompt)}
          disabled={disabled}
          className="lg-prompt-card"
          style={{
            fontSize: "12.5px",
            lineHeight: 1.4,
            color: "#ede9fe",
            background:
              "linear-gradient(180deg, rgba(139, 92, 246, 0.14), rgba(91, 33, 182, 0.06))",
            border: "1px solid rgba(139, 92, 246, 0.28)",
            borderRadius: "12px",
            padding: "13px 14px",
            textAlign: "left",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.55 : 1,
            transition:
              "background 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
            fontFamily: "inherit",
            position: "relative",
            overflow: "hidden",
            animation: `lg-prompt-rise 0.45s ease-out both`,
            animationDelay: `${0.04 * i + 0.05}s`,
            boxShadow:
              "0 4px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
            minHeight: "112px",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: "22px",
              height: "22px",
              borderRadius: "7px",
              marginBottom: "10px",
              background: "rgba(124, 58, 237, 0.2)",
              border: "1px solid rgba(196, 181, 253, 0.24)",
              color: "#c4b5fd",
              fontSize: "13px",
              boxShadow: "0 0 12px rgba(139, 92, 246, 0.22)",
            }}
          >
            <item.Icon size={15} strokeWidth={1.8} />
          </span>
          <span
            style={{
              display: "block",
              position: "relative",
              zIndex: 1,
              fontWeight: 700,
              marginBottom: "4px",
            }}
          >
            {item.title}
          </span>
          <span
            style={{
              display: "block",
              position: "relative",
              zIndex: 1,
              color: "#c4b5fd",
              fontSize: "11px",
              lineHeight: 1.45,
            }}
          >
            {item.detail}
          </span>
        </button>
      ))}
    </div>
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "7px",
        maxWidth: "760px",
      }}
    >
      {SECONDARY_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onPromptClick(prompt)}
          style={{
            border: "1px solid rgba(139, 92, 246, 0.2)",
            borderRadius: "999px",
            background: "rgba(30, 27, 75, 0.34)",
            color: "#ddd6fe",
            cursor: disabled ? "default" : "pointer",
            fontFamily: "inherit",
            fontSize: "10.5px",
            lineHeight: 1.2,
            opacity: disabled ? 0.55 : 1,
            padding: "7px 10px",
          }}
        >
          {prompt}
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
        width: "100%",
        maxWidth: "760px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          maxWidth: isPending ? "100%" : isUser ? "76%" : "88%",
          width: isPending ? "100%" : undefined,
          background: isPending ? "transparent" : accent.bg,
          border: isPending ? "none" : `1px solid ${accent.border}`,
          borderRadius: isUser ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
          padding: isPending ? "8px 0" : "12px 15px",
          color: accent.text,
          fontSize: "14px",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
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

/* -- Thinking state -------------------------------------- */

/* Crisp inline icons per thinking phase — replaces the old text/emoji glyphs
 * (which were rendering as mojibake) so nothing can corrupt. */
const PhaseGlyph: React.FC<{ name: string }> = ({ name }) => {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "route":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="2.4" />
          <circle cx="18" cy="18" r="2.4" />
          <path d="M8.4 6H14a4 4 0 0 1 4 4v5.6" />
        </svg>
      );
    case "database":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="6" rx="7" ry="3" />
          <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
          <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
        </svg>
      );
    case "activity":
      return (
        <svg {...common}>
          <path d="M3 12h3l3 7 4-14 3 7h5" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common}>
          <path d="M12 3.5 21 19H3z" />
          <path d="M12 9.5v4" />
          <circle cx="12" cy="16.4" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "sparkle":
    default:
      return (
        <svg {...common}>
          <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" />
        </svg>
      );
  }
};

const THINKING_PHASES: { label: string; name: string }[] = [
  { label: "Routing query…", name: "route" },
  { label: "Fetching from Historian…", name: "database" },
  { label: "Analyzing live PLC signals…", name: "activity" },
  { label: "Cross-checking alerts…", name: "alert" },
  { label: "Synthesizing answer…", name: "sparkle" },
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

  return <ThinkingRail elapsed={sec} phase={current} onCancel={onCancel} />;

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
          key={`icon-${phase}`}
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "24px",
            height: "24px",
            borderRadius: "8px",
            background:
              "linear-gradient(135deg, rgba(167,139,250,0.28), rgba(124,58,237,0.12))",
            border: "1px solid rgba(167, 139, 250, 0.4)",
            boxShadow: "0 0 12px rgba(139,92,246,0.25)",
            color: "#ede9fe",
            flex: "none",
            animation: "lg-phase-fade 1.8s ease both",
          }}
        >
          <PhaseGlyph name={current.name} />
        </span>
        <span
          key={phase}
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#ddd6fe",
            letterSpacing: "0.01em",
            animation: "lg-phase-fade 1.8s ease both",
          }}
        >
          {current.label}
        </span>

        <span style={{ flex: 1 }} />

        {/* Step-progress dots */}
        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          {THINKING_PHASES.map((_, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                width: i === phase ? "16px" : "5px",
                height: "5px",
                borderRadius: "999px",
                background:
                  i === phase
                    ? "linear-gradient(90deg, #c4b5fd, #7c3aed)"
                    : "rgba(167, 139, 250, 0.25)",
                boxShadow:
                  i === phase ? "0 0 8px rgba(167,139,250,0.6)" : "none",
                transition: "background 0.35s ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const ThinkingRail: React.FC<{
  elapsed: string;
  phase: { label: string; name: string };
  onCancel: () => void;
}> = ({ elapsed, phase, onCancel }) => (
  <div
    style={{
      display: "grid",
      gap: "9px",
      padding: "13px 0",
      borderTop: "1px solid rgba(139, 92, 246, 0.22)",
      borderBottom: "1px solid rgba(139, 92, 246, 0.22)",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div
        aria-hidden
        style={{
          width: "24px",
          height: "24px",
          display: "grid",
          placeItems: "center",
          color: "#d8b4fe",
          flex: "none",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeOpacity="0.45" />
          <path d="M12 4.5c1.2 5 2.5 6.3 7.5 7.5-5 1.2-6.3 2.5-7.5 7.5-1.2-5-2.5-6.3-7.5-7.5 5-1.2 6.3-2.5 7.5-7.5Z" fill="currentColor">
            <animate attributeName="opacity" values="0.42;1;0.42" dur="1.7s" repeatCount="indefinite" />
          </path>
        </svg>
      </div>
      <span style={{ color: "#f5f3ff", fontSize: "14px", fontWeight: 700 }}>
        Agent is working
      </span>
      <span
        style={{
          color: "#a78bfa",
          fontSize: "11px",
          fontVariantNumeric: "tabular-nums",
          marginLeft: "2px",
        }}
      >
        {elapsed}s
      </span>
      <button
        type="button"
        onClick={onCancel}
        style={{
          marginLeft: "auto",
          border: "none",
          background: "transparent",
          color: "#fca5a5",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          padding: "5px 0 5px 10px",
          textTransform: "uppercase",
        }}
      >
        Cancel
      </button>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
      <span style={{ color: "#c4b5fd", display: "inline-flex", flex: "none" }}>
        <PhaseGlyph name={phase.name} />
      </span>
      <span
        style={{
          color: "#cbd5e1",
          fontSize: "13px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {phase.label}
      </span>
      <span
        aria-hidden
        style={{
          flex: 1,
          minWidth: "34px",
          height: "1px",
          background: "linear-gradient(90deg, rgba(167,139,250,0.48), transparent)",
        }}
      />
    </div>
  </div>
);
