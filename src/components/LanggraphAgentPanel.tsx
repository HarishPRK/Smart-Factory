import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Activity, ArrowUp, ArrowUpRight, Bot, Check, ChevronRight, Circle, Clock3, FileText, MessageSquare, Network, RotateCcw, ShieldCheck, Square, X } from "lucide-react";
import { useLangraphChat, type LangraphMessage } from "../hooks/useLangraphChat";
import LanggraphResponse from "./LanggraphResponse";

/** Closing this presentation preserves the shared hook's conversation and request. */
const LanggraphAgentPanel: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const chat = useLangraphChat();
  return open ? <Drawer chat={chat} onClose={onClose} /> : null;
};

export default LanggraphAgentPanel;

const INVESTIGATIONS = [
  {
    id: "production", title: "Production", Icon: Activity,
    description: "Understand output, downtime, and plant performance.",
    prompts: [
      { title: "Factory performance", detail: "Get an overview of the system.", prompt: "How is the system performing overall?" },
      { title: "Production total", detail: "Review units produced so far.", prompt: "How many units have been produced so far?" },
      { title: "Downtime history", detail: "Review the system's downtime.", prompt: "How much downtime has the system had?" },
      { title: "Downtime risk", detail: "Ask about predicted downtime risk.", prompt: "What is the predicted downtime risk for the plant?" },
    ],
  },
  {
    id: "sensors", title: "Sensors & energy", Icon: Network,
    description: "Explore sensor readings and motor energy together.",
    prompts: [
      { title: "Motor energy analysis", detail: "Compare power, voltage, and current.", prompt: "What do the single-phase motor's power, voltage, and current readings show?" },
      { title: "Pressure readings", detail: "Ask what the pressure sensor is reporting.", prompt: "What do the pressure sensor readings show?" },
    ],
  },
  {
    id: "safety", title: "Safety & devices", Icon: ShieldCheck,
    description: "Investigate emergency events and connected equipment.",
    prompts: [
      { title: "Emergency recovery", detail: "Ask for the plant's safe restart guidance.", prompt: "How can I restart the plant after an emergency state?" },
      { title: "Connected devices", detail: "Inspect equipment connected through Modbus / RS485.", prompt: "Which devices are connected to the PLC through Modbus / RS485?" },
      { title: "Emergency events", detail: "Review how often emergency states occurred.", prompt: "How many times has the system entered an emergency state?" },
    ],
  },
] as const;

function Drawer({ chat, onClose }: { chat: ReturnType<typeof useLangraphChat>; onClose: () => void }) {
  const { messages, pending, send, cancel, clear } = chat;
  const [input, setInput] = useState("");
  const [topic, setTopic] = useState<(typeof INVESTIGATIONS)[number]["id"]>("production");
  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const onCloseRef = useRef(onClose);
  const investigation = INVESTIGATIONS.find((item) => item.id === topic) ?? INVESTIGATIONS[0];

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);
  useEffect(() => {
    const launcher = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), a[href], summary, [tabindex="0"]') ?? []);
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== "Tab") return;
      const controls = focusable();
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (launcher?.isConnected) launcher.focus(); };
  }, []);

  const submit = () => {
    const prompt = input.trim();
    if (!prompt || pending) return;
    setInput(""); void send(prompt);
  };

  return ReactDOM.createPortal(
    <div className="langgraph-backdrop" role="presentation" onClick={onClose}>
      <div ref={dialogRef} id="langgraph-agent-dialog" className="langgraph-dialog langgraph-workspace" role="dialog" aria-modal="true" aria-label="LangGraph AI factory assistant" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <header className="langgraph-dialog__header">
          <div className="langgraph-identity">
            <span className="langgraph-identity__mark" aria-hidden="true"><Bot size={24} strokeWidth={1.7} /></span>
            <div><h2>LangGraph AI</h2><p>Factory assistant</p></div>
          </div>
          <div className="langgraph-dialog__actions">
            <span className="langgraph-advisory"><ShieldCheck size={14} aria-hidden="true" />Advisory</span>
            <button type="button" className="langgraph-quiet-button" onClick={clear} disabled={pending || messages.length === 0} title="Clear conversation" aria-label="Clear conversation"><RotateCcw size={15} aria-hidden="true" /><span>Clear</span></button>
            <button type="button" className="langgraph-icon-button" onClick={onClose} title="Close LangGraph AI" aria-label="Close LangGraph AI"><X size={18} aria-hidden="true" /></button>
          </div>
        </header>

        <div className="langgraph-workspace__body">
          <aside className="langgraph-investigations" aria-label="Investigation topics">
            <div className="langgraph-investigations__intro"><h3>Explore your plant</h3><p>Start with a question. Follow the evidence.</p></div>
            <nav aria-label="Choose an investigation">
              {INVESTIGATIONS.map((item) => <button key={item.id} type="button" className="langgraph-topic" aria-pressed={topic === item.id} onClick={() => setTopic(item.id)}><item.Icon size={17} aria-hidden="true" /><span>{item.title}</span><ChevronRight size={15} aria-hidden="true" /></button>)}
            </nav>
            {messages.length > 0 ? <div className="langgraph-followups"><h4>Ask a follow-up</h4>{investigation.prompts.map((item) => <button type="button" disabled={pending} key={item.title} onClick={() => { void send(item.prompt); }}><span>{item.title}</span><ArrowUpRight size={14} aria-hidden="true" /></button>)}</div> : <div className="langgraph-agent-route" aria-label="Questions are sent to the external LangGraph agent">
              <div className="langgraph-agent-route__diagram" aria-hidden="true"><MessageSquare size={20} /><span /><Bot size={30} strokeWidth={1.5} /><span /><FileText size={20} /></div>
              <h4>Your question. A factory perspective.</h4><p>Responses come from the external LangGraph agent.</p>
            </div>}
            <div className="langgraph-investigations__footer"><ShieldCheck size={17} aria-hidden="true" /><p>Guidance only. Equipment stays under operator control.</p></div>
          </aside>

          <section className="langgraph-conversation" aria-label="Factory conversation">
            <div ref={scrollRef} className="langgraph-conversation__scroll">
              {messages.length === 0 ? <div className="langgraph-start">
                <div className="langgraph-start__intro"><h3>What needs attention<br />at the plant?</h3><p>Ask a precise question, or choose an investigation below.</p></div>
                <section className="langgraph-starters" aria-labelledby="langgraph-starters-heading">
                  <div className="langgraph-starters__heading"><h4 id="langgraph-starters-heading">{investigation.title}</h4><p>{investigation.description}</p></div>
                  <div className="langgraph-starters__list">{investigation.prompts.map((item) => <button key={item.title} type="button" className="langgraph-starter" disabled={pending} onClick={() => { void send(item.prompt); }}><span><strong>{item.title}</strong><span>{item.detail}</span></span><ArrowUpRight size={18} aria-hidden="true" /></button>)}</div>
                </section>
              </div> : <div className="langgraph-messages">{messages.map((message) => <MessageEntry key={message.id} message={message} onCancel={cancel} onRetry={(prompt) => { void send(prompt); }} retryPrompt={message.status === "error" ? messages[messages.indexOf(message) - 1]?.content : undefined} pending={pending} />)}</div>}
            </div>
            <div className="langgraph-composer-wrap">
              <form className="langgraph-composer" onSubmit={(event) => { event.preventDefault(); submit(); }}>
                <label htmlFor="langgraph-message" className="langgraph-composer__label">Ask LangGraph AI</label>
                <div className="langgraph-composer__field"><textarea id="langgraph-message" ref={inputRef} aria-label="Message LangGraph AI" value={input} rows={2} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} placeholder={pending ? "Waiting for the agent's response…" : "Ask about production, sensors, or equipment…"} disabled={pending} /><button type="submit" aria-label="Send message" disabled={pending || !input.trim()}><ArrowUp size={20} aria-hidden="true" /></button></div>
              </form>
              <div className="langgraph-composer__help"><span>External agent · advisory only</span><span>Enter to send<span className="langgraph-composer__linebreak-hint"> · Shift + Enter for a new line</span></span></div>
            </div>
          </section>
        </div>
      </div>
    </div>, document.body,
  );
}

function MessageEntry({ message, onCancel, onRetry, retryPrompt, pending }: { message: LangraphMessage; onCancel: () => void; onRetry: (prompt: string) => void; retryPrompt?: string; pending: boolean }) {
  if (message.role === "user") return <div className="langgraph-question"><span className="langgraph-question__label">You</span><p>{message.content}</p></div>;
  if (message.status === "pending") return <RequestProgress message={message} onCancel={onCancel} />;
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return <article className={`langgraph-answer langgraph-answer--${message.status}`}>
    <div className="langgraph-answer__header"><Bot size={18} aria-hidden="true" /><strong>{message.status === "error" ? "Response unavailable" : message.status === "canceled" ? "Stopped listening" : "LangGraph response"}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{time}</time></div>
    {message.status === "error" ? <div className="langgraph-request-error" role="alert"><p>{message.error || "The agent could not return a response."}</p><p className="langgraph-answer__note">Try the request again. If the problem continues, check the agent connection.</p>{retryPrompt && <button type="button" className="langgraph-retry" disabled={pending} onClick={() => onRetry(retryPrompt)}><RotateCcw size={14} aria-hidden="true" />Retry request</button>}</div> : message.status === "canceled" ? <p className="langgraph-answer__note">You stopped listening to this request. The agent may continue processing on the server.</p> : message.content ? <LanggraphResponse content={message.content} /> : <p className="langgraph-answer__note">The agent returned an empty response. Try asking a more specific question.</p>}
    {message.requestId && <details className="langgraph-request-details"><summary>Request details</summary><dl><dt>Request ID</dt><dd>{message.requestId}</dd>{message.elapsedMs != null && <><dt>Last reported elapsed</dt><dd>{(message.elapsedMs / 1000).toFixed(1)} s</dd></>}</dl></details>}
  </article>;
}

/** The transport reports acceptance and elapsed time, never internal agent tools. */
function RequestProgress({ message, onCancel }: { message: LangraphMessage; onCancel: () => void }) {
  const accepted = Boolean(message.requestId);
  return <div className="langgraph-request" aria-label="Agent request progress">
    <div className="langgraph-request__heading"><span className="langgraph-request__activity" aria-hidden="true"><Bot size={20} /></span><div><strong role="status" aria-live="polite">{accepted ? "Awaiting the agent's response" : "Sending your question"}</strong><p>{accepted ? "Request accepted. The agent has not returned a response yet." : "Submitting to the external LangGraph agent."}</p></div><button type="button" onClick={onCancel} className="langgraph-cancel"><Square size={12} aria-hidden="true" />Cancel</button></div>
    <ol className="langgraph-request__steps" aria-label="Request lifecycle"><li data-state={accepted ? "complete" : "active"}>{accepted ? <Check size={13} /> : <Circle size={10} />}<span>Submitted</span></li><li data-state={accepted ? "complete" : "waiting"}>{accepted ? <Check size={13} /> : <Circle size={10} />}<span>Accepted</span></li><li data-state={accepted ? "active" : "waiting"}><Clock3 size={13} /><span>Response</span></li></ol>
    {accepted && <div className="langgraph-request__metadata"><span>Request <code>{message.requestId}</code></span><span>{((message.elapsedMs ?? 0) / 1000).toFixed(1)} s elapsed</span></div>}
    <p className="langgraph-request__cancel-note">Cancel stops listening here; server processing may continue.</p>
  </div>;
}
