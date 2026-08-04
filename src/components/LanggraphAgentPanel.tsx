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
 * No tabs, no PLC context, no streaming - submit > poll > render.
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

/* -- Floating button ------------------------------------- */

const AgenticCoreMark: React.FC<{ size?: number; active?: boolean }> = ({
  size = 64,
  active = false,
}) => (
  <svg
    aria-hidden
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    style={{ display: "block", overflow: "visible" }}
  >
    <defs>
      <linearGradient id="lg-core-gradient" x1="18" y1="14" x2="84" y2="88">
        <stop stopColor="#DCC8FF" />
        <stop offset="0.42" stopColor="#A855F7" />
        <stop offset="1" stopColor="#4F46E5" />
      </linearGradient>
      <linearGradient id="lg-core-orbit" x1="10" y1="0" x2="90" y2="100">
        <stop stopColor="#5EEAD4" stopOpacity="0.9" />
        <stop offset="0.55" stopColor="#C084FC" stopOpacity="0.15" />
        <stop offset="1" stopColor="#818CF8" stopOpacity="0.9" />
      </linearGradient>
      <filter id="lg-core-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <g opacity={active ? 0.95 : 0.72}>
      <ellipse
        cx="50"
        cy="50"
        rx="43"
        ry="18"
        stroke="url(#lg-core-orbit)"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 50 50"
          to="360 50 50"
          dur="8s"
          repeatCount="indefinite"
        />
      </ellipse>
      <ellipse
        cx="50"
        cy="50"
        rx="18"
        ry="43"
        stroke="url(#lg-core-orbit)"
        strokeWidth="1.2"
        opacity="0.7"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="360 50 50"
          to="0 50 50"
          dur="10s"
          repeatCount="indefinite"
        />
      </ellipse>
    </g>
    <circle cx="50" cy="50" r="25" fill="url(#lg-core-gradient)" filter="url(#lg-core-glow)">
      <animate attributeName="r" values="24;26;24" dur="3s" repeatCount="indefinite" />
    </circle>
    <circle cx="50" cy="50" r="17" fill="rgba(16, 12, 39, 0.3)" stroke="rgba(255,255,255,0.35)" />
    <path
      d="M50 25c2.6 16.3 7.3 21 23 25-15.7 4-20.4 8.7-23 25-2.6-16.3-7.3-21-23-25 15.7-4 20.4-8.7 23-25Z"
      fill="#F5F3FF"
    />
    <circle cx="70" cy="31" r="3.1" fill="#5EEAD4">
      <animate attributeName="opacity" values="0.45;1;0.45" dur="1.8s" repeatCount="indefinite" />
    </circle>
    <circle cx="30" cy="69" r="2.2" fill="#C4B5FD" />
  </svg>
);

const FloatingButton: React.FC<{ open: boolean; onClick: () => void }> = ({
  open,
  onClick,
}) => (
  <button
    onClick={onClick}
    aria-label={open ? "Close Agentic AI assistant" : "Open Agentic AI assistant"}
    aria-pressed={open}
    title="Agentic AI · Plant intelligence"
    className="lg-agent-trigger"
    style={{
      position: "fixed",
      left: "18px",
      bottom: "18px",
      zIndex: 40,
      width: "66px",
      height: "66px",
      padding: 0,
      borderRadius: "20px",
      border: "1px solid rgba(167, 139, 250, 0.58)",
      background:
        "radial-gradient(circle at 28% 20%, rgba(196,181,253,0.28), transparent 43%), linear-gradient(145deg, rgba(60, 26, 130, 0.96), rgba(13, 25, 67, 0.98))",
      boxShadow: open
        ? "0 0 0 3px rgba(139, 92, 246, 0.25), 0 0 28px rgba(124, 58, 237, 0.5), 0 14px 34px rgba(0,0,0,0.56)"
        : "0 0 22px rgba(124, 58, 237, 0.28), 0 12px 30px rgba(0,0,0,0.5)",
      cursor: "pointer",
      display: "grid",
      placeItems: "center",
      transition: "box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease",
      transform: open ? "translateY(-3px) scale(1.02)" : "translateY(0)",
    }}
  >
    <AgenticCoreMark size={57} active={open} />
    <span
      aria-hidden
      style={{
        position: "absolute",
        right: "8px",
        bottom: "8px",
        width: "8px",
        height: "8px",
        borderRadius: "999px",
        background: "#34d399",
        border: "2px solid #18112e",
        boxShadow: "0 0 10px rgba(52, 211, 153, 0.9)",
      }}
    />
  </button>
);

/* -- Drawer ---------------------------------------------- */

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
        aria-label="Agentic AI factory assistant"
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
            <AgenticCoreMark size={34} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "#a78bfa",
                  marginBottom: "2px",
                }}
              >
                Agentic AI
              </div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#f5f3ff",
                }}
              >
                Factory Assistant
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginLeft: "auto",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 9px",
                borderRadius: "999px",
                border: "1px solid rgba(52, 211, 153, 0.25)",
                background: "rgba(16, 185, 129, 0.08)",
                color: "#a7f3d0",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#34d399",
                  boxShadow: "0 0 8px #34d399",
                }}
              />
              External agent · advisory
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
                X
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
        Live context
      </div>
      <input
        type="text"
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
        ↑
      </button>
    </form>
  );
};

const SAMPLE_PROMPTS = [
  "How is my overall system performance?",
  "How many units have been produced so far?",
  "What is the downtime of my system?",
  "The system is in emergency state. How to restart the plant?",
  "List all devices connected through modbus/rs485 with plc.",
  "How many times has the system entered emergency state?",
  "Analyze the power consumption, voltage and current of single phase motor.",
  "Analyze pressure sensor data.",
  "Predict downtime risk for the plant."
];

const FEATURED_PROMPTS = [
  {
    title: "Emergency recovery",
    detail: "Get the safe restart path when the plant enters an emergency state.",
    prompt: SAMPLE_PROMPTS[3],
    glyph: "!",
  },
  {
    title: "Connected devices",
    detail: "Inspect the devices connected to the PLC through Modbus / RS485.",
    prompt: SAMPLE_PROMPTS[4],
    glyph: "⌘",
  },
  {
    title: "Motor energy analysis",
    detail: "Analyze single-phase motor power, voltage, and current together.",
    prompt: SAMPLE_PROMPTS[6],
    glyph: "ϟ",
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

const AgenticOperationsMesh: React.FC = () => (
  <div
    aria-hidden
    style={{
      position: "relative",
      width: "min(520px, 100%)",
      height: "198px",
      marginBottom: "-2px",
      pointerEvents: "none",
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: "30px 76px 22px",
        borderRadius: "50%",
        background:
          "radial-gradient(ellipse, rgba(124, 58, 237, 0.2) 0%, rgba(49, 46, 129, 0.1) 42%, transparent 72%)",
        filter: "blur(12px)",
      }}
    />
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 520 198"
      fill="none"
      style={{ position: "absolute", inset: 0, overflow: "visible" }}
    >
      <defs>
        <linearGradient id="lg-mesh-line" x1="55" y1="38" x2="461" y2="164">
          <stop stopColor="#5EEAD4" stopOpacity="0.8" />
          <stop offset="0.5" stopColor="#C084FC" stopOpacity="0.82" />
          <stop offset="1" stopColor="#818CF8" stopOpacity="0.72" />
        </linearGradient>
        <filter id="lg-mesh-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M260 95 L72 48 M260 95 L448 48 M260 95 L260 171"
        stroke="url(#lg-mesh-line)"
        strokeWidth="1.4"
        strokeDasharray="5 7"
        opacity="0.78"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="48"
          to="0"
          dur="3.2s"
          repeatCount="indefinite"
        />
      </path>
      <path
        d="M72 48 Q156 5 260 34 Q364 5 448 48"
        stroke="rgba(196, 181, 253, 0.3)"
        strokeWidth="1"
        strokeDasharray="2 8"
      />
      <path
        d="M72 48 Q136 176 260 171 Q384 176 448 48"
        stroke="rgba(94, 234, 212, 0.18)"
        strokeWidth="1"
      />
      {[
        [72, 48, "#5eead4"],
        [448, 48, "#a78bfa"],
        [260, 171, "#818cf8"],
      ].map(([cx, cy, color], index) => (
        <g key={index}>
          <circle
            cx={cx}
            cy={cy}
            r="12"
            fill="rgba(15, 23, 42, 0.9)"
            stroke={color as string}
            strokeWidth="1.2"
            filter="url(#lg-mesh-glow)"
          />
          <circle cx={cx} cy={cy} r="3.5" fill={color as string}>
            <animate
              attributeName="r"
              values="2.8;4.2;2.8"
              dur="2.1s"
              begin={`${index * 0.32}s`}
              repeatCount="indefinite"
            />
          </circle>
        </g>
      ))}
      <circle
        cx="260"
        cy="95"
        r="56"
        stroke="rgba(196, 181, 253, 0.28)"
        strokeWidth="1"
        strokeDasharray="2 7"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 260 95"
          to="360 260 95"
          dur="17s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="260" cy="95" r="70" stroke="rgba(139, 92, 246, 0.14)" strokeWidth="1" />
    </svg>
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "39px",
        transform: "translateX(-50%)",
        filter: "drop-shadow(0 12px 20px rgba(76, 29, 149, 0.35))",
      }}
    >
      <AgenticCoreMark size={112} active />
    </div>
    <MeshLabel side="left" top="22px" label="Recovery route" accent="#5eead4" />
    <MeshLabel side="right" top="22px" label="PLC device map" accent="#c4b5fd" />
    <MeshLabel side="bottom" top="168px" label="Motor signals" accent="#a5b4fc" />
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "119px",
        transform: "translateX(-50%)",
        color: "#ddd6fe",
        fontSize: "9px",
        fontWeight: 800,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      Agentic operations mesh
    </div>
  </div>
);

const MeshLabel: React.FC<{
  side: "left" | "right" | "bottom";
  top: string;
  label: string;
  accent: string;
}> = ({ side, top, label, accent }) => {
  const position =
    side === "left"
      ? { left: "0" }
      : side === "right"
        ? { right: "0" }
        : { left: "50%", transform: "translateX(-50%)" };

  return (
    <div
      style={{
        position: "absolute",
        top,
        ...position,
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        color: "#cbd5e1",
        fontSize: "9px",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: accent,
          boxShadow: `0 0 8px ${accent}`,
        }}
      />
      {label}
    </div>
  );
};

const CommandHeroMark: React.FC = () => (
  <div
    aria-hidden
    style={{
      width: "min(430px, 88vw)",
      height: "54px",
      display: "grid",
      placeItems: "center",
      marginBottom: "4px",
    }}
  >
    <svg width="100%" height="54" viewBox="0 0 430 54" fill="none">
      <defs>
        <linearGradient id="lg-command-beam" x1="0" y1="27" x2="430" y2="27">
          <stop stopColor="#8B5CF6" stopOpacity="0" />
          <stop offset="0.34" stopColor="#A78BFA" stopOpacity="0.46" />
          <stop offset="0.5" stopColor="#E879F9" stopOpacity="0.96" />
          <stop offset="0.66" stopColor="#A78BFA" stopOpacity="0.46" />
          <stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
        </linearGradient>
        <filter id="lg-command-star" x="-40%" y="-60%" width="180%" height="220%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d="M0 27H430" stroke="url(#lg-command-beam)" strokeWidth="1.2" />
      <path
        d="M215 2c2.8 17.2 7.8 22.2 25 25-17.2 2.8-22.2 7.8-25 25-2.8-17.2-7.8-22.2-25-25 17.2-2.8 22.2-7.8 25-25Z"
        fill="#C084FC"
        filter="url(#lg-command-star)"
      />
      <circle cx="215" cy="27" r="5.4" fill="#F5F3FF" />
    </svg>
  </div>
);

const EmptyState: React.FC<EmptyStateProps> = ({
  input,
  pending,
  onChange,
  onSubmit,
  onPromptClick,
  disabled,
}) => (
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
    <CommandHeroMark />

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
      Live plant context
    </div>

    <div
      style={{
        fontSize: "34px",
        fontWeight: 400,
        letterSpacing: "-0.03em",
        color: "#ddd6fe",
      }}
    >
      Good afternoon, operator.
    </div>
    <div
      style={{
        fontSize: "34px",
        fontWeight: 700,
        letterSpacing: "-0.03em",
        color: "#a78bfa",
        marginTop: "-14px",
      }}
    >
      What needs attention on the plant?
    </div>
    <div
      style={{
        fontSize: "11px",
        lineHeight: 1.6,
        maxWidth: "540px",
        color: "#a78bfa",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      Prompt sent to the external LangGraph service · verify before operational action
    </div>

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
            {item.glyph}
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
          {prompt
            .replace("How many ", "")
            .replace("What is the ", "")
            .replace("Analyze ", "")
            .replace("List all ", "")
            .replace("The system is in emergency state. ", "")}
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
                transition: "width 0.35s ease, background 0.35s ease",
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
