import { useCallback, useEffect, useRef, useState } from "react";
import { askAgent } from "../services/langgraphService";

export type LangraphMessageStatus =
  | "complete"
  | "pending"
  | "canceled"
  | "error";

export interface LangraphMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: LangraphMessageStatus;
  /** Populated once the server assigns a request_id (pending → complete/error/canceled). */
  requestId?: string;
  /** Elapsed ms while pending — updated from askAgent's onPending callback. */
  elapsedMs?: number;
  /** Set when status === "error". */
  error?: string;
  createdAt: number;
}

let messageCounter = 0;
const nextId = () => `lg-${Date.now().toString(36)}-${(++messageCounter).toString(36)}`;

export interface UseLangraphChat {
  messages: LangraphMessage[];
  pending: boolean;
  send: (prompt: string) => Promise<void>;
  cancel: () => void;
  clear: () => void;
}

/**
 * Owns chat state for the langgraph agent drawer. One in-flight request at a
 * time — `send` no-ops while `pending` is true.
 *
 * Cancel semantics match the CLI (Ctrl-C): we stop listening client-side, the
 * agent continues server-side and its result is dropped. The pending message
 * flips to `status: "canceled"`.
 */
export function useLangraphChat(): UseLangraphChat {
  const [messages, setMessages] = useState<LangraphMessage[]>([]);
  const [pending, setPending] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // On unmount, abort any in-flight request so the poll loop doesn't keep running.
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const updateMessage = useCallback(
    (id: string, patch: Partial<LangraphMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
    },
    [],
  );

  const send = useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || controllerRef.current) return;

    const userMsg: LangraphMessage = {
      id: nextId(),
      role: "user",
      content: trimmed,
      status: "complete",
      createdAt: Date.now(),
    };
    const assistantId = nextId();
    const assistantMsg: LangraphMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      status: "pending",
      elapsedMs: 0,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setPending(true);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const reply = await askAgent(trimmed, {
        signal: controller.signal,
        onPending: (requestId, elapsedMs) => {
          updateMessage(assistantId, { requestId, elapsedMs });
        },
      });
      updateMessage(assistantId, { content: reply, status: "complete" });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        updateMessage(assistantId, { status: "canceled" });
      } else {
        const message =
          err instanceof Error ? err.message : "Unknown error from agent";
        updateMessage(assistantId, { status: "error", error: message });
      }
    } finally {
      // Only clear our own controller — a later send may have replaced it,
      // though the `if (controllerRef.current) return` guard above prevents that.
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
      setPending(false);
    }
  }, [updateMessage]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    if (controllerRef.current) return;
    setMessages([]);
  }, []);

  return { messages, pending, send, cancel, clear };
}
