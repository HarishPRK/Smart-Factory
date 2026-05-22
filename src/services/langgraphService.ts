/**
 * Transport for the external langgraph agent REST API.
 *
 *   POST /api/prompt          → HTTP 202 + { request_id }
 *   GET  /api/response/<id>   → { status: "pending" | "complete" | "error", response?, error? }
 *
 * No streaming. No auth. Polling is the only option.
 *
 * Mirrors the reference CLI client (scripts/langgraph_client.py) in behaviour:
 *   - submit must return 202 or we throw
 *   - poll at fixed cadence until status leaves "pending"
 *   - "error" status → reject; any other status → reject with "unexpected"
 */

export const LANGGRAPH_BASE =
  (import.meta.env.VITE_LANGGRAPH_API_BASE as string | undefined)?.trim() ||
  "http://192.168.10.71:8765";

const HTTP_TIMEOUT_MS = 30_000;

export type LangraphStatus = "pending" | "complete" | "error";

export interface LangraphStatusResponse {
  status: LangraphStatus;
  response?: string;
  error?: string;
}

interface SubmitResponse {
  request_id?: string;
}

function join(path: string): string {
  return LANGGRAPH_BASE.replace(/\/$/, "") + path;
}

/** Merge a caller-supplied AbortSignal with a per-request timeout signal. */
function withTimeout(external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(HTTP_TIMEOUT_MS);
  if (!external) return timeout;
  // `AbortSignal.any` is available in modern browsers / Node 20+.
  const anyOf = (AbortSignal as unknown as {
    any?: (signals: AbortSignal[]) => AbortSignal;
  }).any;
  return anyOf ? anyOf([external, timeout]) : external;
}

/**
 * POST /api/prompt — returns the new request_id. Throws on non-202.
 */
export async function submitPrompt(
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(join("/api/prompt"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal: withTimeout(signal),
  });

  let body: SubmitResponse;
  try {
    body = (await res.json()) as SubmitResponse;
  } catch {
    throw new Error(
      `Invalid JSON from /api/prompt (HTTP ${res.status})`,
    );
  }

  if (res.status !== 202) {
    throw new Error(
      `Expected HTTP 202 from /api/prompt, got ${res.status}`,
    );
  }
  if (!body.request_id) {
    throw new Error("Server response missing request_id");
  }
  return body.request_id;
}

/**
 * GET /api/response/<id> — returns the typed status envelope.
 */
export async function fetchStatus(
  requestId: string,
  signal?: AbortSignal,
): Promise<LangraphStatusResponse> {
  const res = await fetch(join(`/api/response/${encodeURIComponent(requestId)}`), {
    method: "GET",
    signal: withTimeout(signal),
  });
  if (!res.ok) {
    throw new Error(`Status poll failed: HTTP ${res.status}`);
  }
  return (await res.json()) as LangraphStatusResponse;
}

export interface AskAgentOptions {
  /** External cancel signal — aborts both the HTTP call and the poll loop. */
  signal?: AbortSignal;
  /** Invoked each poll tick with the current request_id and elapsed ms. */
  onPending?: (requestId: string, elapsedMs: number) => void;
  /** Poll cadence in ms. Clamped to ≥ 250. Default 500 (matches the CLI). */
  pollMs?: number;
}

/**
 * Full submit → poll → return lifecycle. Rejects on:
 *   - network / HTTP errors
 *   - server reporting status: "error"
 *   - external signal aborting (AbortError)
 *   - any unexpected status value
 */
export async function askAgent(
  prompt: string,
  opts: AskAgentOptions = {},
): Promise<string> {
  const pollMs = Math.max(250, opts.pollMs ?? 500);
  const startedAt = Date.now();

  const requestId = await submitPrompt(prompt, opts.signal);

  // Immediate first callback so the UI can show the request_id right away.
  opts.onPending?.(requestId, 0);

  while (true) {
    if (opts.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const status = await fetchStatus(requestId, opts.signal);

    if (status.status === "complete") {
      return status.response ?? "";
    }
    if (status.status === "error") {
      throw new Error(status.error || "Agent reported an error");
    }
    if (status.status !== "pending") {
      throw new Error(`Unexpected status from agent: ${String(status.status)}`);
    }

    opts.onPending?.(requestId, Date.now() - startedAt);

    await sleep(pollMs, opts.signal);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
