import cors from "cors";
import { timingSafeEqual } from "node:crypto";
import express, {
  type ErrorRequestHandler,
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { ZodError } from "zod";

import {
  STORE_EVENT_TYPES,
  agentQuestionRequestSchema,
  decisionReviewRequestSchema,
  observationBatchSchema,
  scenarioStartRequestSchema,
  simulatorControlRequestSchema,
  type StoreEventEnvelope,
  type StoreEventType,
} from "../../../packages/agentic-store-contracts/src/index.js";
import {
  AgenticStoreConflictError,
  AgenticStoreNotFoundError,
} from "../application/agent-orchestrator.js";
import type { AgenticStoreRuntime } from "../runtime.js";
import { STORE_SCENARIO_IDS } from "../simulation/store-simulator.js";

export const AGENTIC_STORE_API_PREFIX = "/api/agentic-store";
const MAX_SSE_REPLAY_EVENTS = 5_000;
const MAX_SSE_CLIENTS = 32;

export class AgenticStoreStreamRegistry {
  private readonly closers = new Set<() => void>();

  get size(): number {
    return this.closers.size;
  }

  register(close: () => void): () => void {
    this.closers.add(close);
    return () => this.closers.delete(close);
  }

  closeAll(): void {
    for (const close of [...this.closers]) close();
    this.closers.clear();
  }
}

export function createAgenticStoreHttpApp(
  runtime: AgenticStoreRuntime,
  streams = new AgenticStoreStreamRegistry(),
): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({
    origin: (origin, callback) => callback(
      null,
      origin == null || isAllowedBrowserOrigin(origin, runtime.config.allowedOrigins),
    ),
  }));
  app.use(express.json({ limit: "1mb" }));
  registerAgenticStoreRoutes(app, runtime, streams);
  app.use(agenticStoreErrorHandler);
  return app;
}

export function registerAgenticStoreRoutes(
  app: Express,
  runtime: AgenticStoreRuntime,
  streams = new AgenticStoreStreamRegistry(),
): void {
  const prefix = AGENTIC_STORE_API_PREFIX;

  app.use(prefix, (request, response, next) => {
    authorizeMutation(request, response, next, runtime.config.apiToken);
  });

  app.get(`${prefix}/health`, (_request, response) => {
    response.json(runtime.health());
  });

  app.get(`${prefix}/bootstrap`, (_request, response) => {
    response.json(runtime.bootstrap(`${prefix}/stream`));
  });

  app.get(`${prefix}/snapshot`, (_request, response) => {
    response.json(runtime.snapshot());
  });

  app.get(`${prefix}/events`, (request, response) => {
    response.json(runtime.listEvents({
      afterSequence: parseNonNegativeInteger(request.query.after, 0),
      limit: parsePositiveInteger(request.query.limit, 200),
      entityId: queryString(request.query.entityId),
      from: optionalIso(request.query.from, "from"),
      to: optionalIso(request.query.to, "to"),
      types: parseEventTypes(request.query.types),
    }));
  });

  app.get(`${prefix}/history`, (request, response) => {
    const entityId = requiredQueryString(request.query.entityId, "entityId");
    const property = requiredQueryString(request.query.property, "property");
    const latestSample = runtime.snapshot().properties.find(
      (item) => item.entityId === entityId && item.property === property,
    )?.sampledAt;
    const anchor = latestSample && Number.isFinite(Date.parse(latestSample))
      ? new Date(latestSample)
      : new Date();
    const from = optionalIso(request.query.from, "from")
      ?? new Date(anchor.getTime() - 60 * 60 * 1_000).toISOString();
    const to = optionalIso(request.query.to, "to") ?? anchor.toISOString();
    if (Date.parse(from) > Date.parse(to)) {
      throw new RangeError("History from must not be after to.");
    }
    response.json(runtime.history(
      entityId,
      property,
      from,
      to,
      parsePositiveInteger(request.query.limit, 2_000),
    ));
  });

  app.get(`${prefix}/incidents`, (_request, response) => {
    response.json(runtime.listIncidents());
  });

  app.get(`${prefix}/decisions`, (request, response) => {
    response.json(runtime.listDecisions(parsePositiveInteger(request.query.limit, 100)));
  });

  app.get(`${prefix}/tasks`, (_request, response) => {
    response.json(runtime.listTasks());
  });

  app.get(`${prefix}/activities`, (request, response) => {
    response.json(runtime.listActivities(parsePositiveInteger(request.query.limit, 100)));
  });

  app.get(`${prefix}/simulator`, (_request, response) => {
    response.json(runtime.simulator.getState());
  });

  app.get(`${prefix}/scenarios`, (_request, response) => {
    response.json({
      enabled: runtime.config.simulationEnabled,
      scenarios: runtime.config.simulationEnabled ? STORE_SCENARIO_IDS : [],
    });
  });

  app.get(`${prefix}/stream`, (request, response) => {
    openEventStream(request, response, runtime, streams);
  });

  app.post(`${prefix}/ingest`, (request, response) => {
    const batch = observationBatchSchema.parse(request.body);
    response.status(202).json(runtime.ingest(batch, "PLC"));
  });

  app.post(`${prefix}/simulator/control`, (request, response) => {
    const command = simulatorControlRequestSchema.parse(request.body);
    response.json(runtime.controlSimulator(command));
  });

  app.post(`${prefix}/scenarios/:scenarioId/start`, (request, response) => {
    const body = scenarioStartRequestSchema.parse(request.body ?? {});
    response.json(runtime.startScenario(request.params.scenarioId, body.durationSeconds));
  });

  app.post(`${prefix}/scenarios/stop`, (_request, response) => {
    response.json(runtime.stopScenario());
  });

  app.post(`${prefix}/incidents/:incidentId/acknowledge`, (request, response) => {
    const review = decisionReviewRequestSchema.parse(request.body);
    response.json(runtime.acknowledgeIncident(request.params.incidentId, review));
  });

  app.post(`${prefix}/decisions/:decisionId/approve`, async (request, response) => {
    const review = decisionReviewRequestSchema.parse(request.body);
    response.json(await runtime.reviewDecision(request.params.decisionId, review, true));
  });

  app.post(`${prefix}/decisions/:decisionId/reject`, async (request, response) => {
    const review = decisionReviewRequestSchema.parse(request.body);
    response.json(await runtime.reviewDecision(request.params.decisionId, review, false));
  });

  app.post(`${prefix}/agent/question`, async (request, response) => {
    const question = agentQuestionRequestSchema.parse(request.body);
    response.json(await runtime.askAgent(question.question, question.entityIds));
  });
}

function openEventStream(
  request: Request,
  response: Response,
  runtime: AgenticStoreRuntime,
  streams: AgenticStoreStreamRegistry,
): void {
  if (streams.size >= MAX_SSE_CLIENTS) {
    response.status(503).json({
      error: "STREAM_CAPACITY_REACHED",
      message: "Too many live event streams are open.",
    });
    return;
  }
  const headerCursor = request.get("last-event-id");
  let cursor = parseNonNegativeInteger(
    headerCursor ?? request.query.after,
    0,
  );
  const latestSequence = runtime.latestSequence();
  if (cursor > latestSequence) {
    response.status(409).json({
      error: "EVENT_CURSOR_AHEAD",
      message: "The event cursor is ahead of this store log; reload bootstrap.",
      latestSequence,
    });
    return;
  }
  const retentionFloor = runtime.listEvents({ afterSequence: 0, limit: 1 }).earliestSequence;
  if (cursor > 0 && retentionFloor > cursor + 1) {
    response.status(409).json({
      error: "EVENT_CURSOR_EXPIRED",
      message: "The event cursor is older than local retention; reload bootstrap.",
      earliestSequence: retentionFloor,
    });
    return;
  }
  if (latestSequence - cursor > MAX_SSE_REPLAY_EVENTS) {
    response.status(409).json({
      error: "EVENT_REPLAY_TOO_LARGE",
      message: "The event backlog is too large for SSE catch-up; reload bootstrap.",
      latestSequence,
    });
    return;
  }

  response.status(200);
  response.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.flushHeaders();
  response.write("retry: 2000\n\n");

  let closed = false;
  const streamState: { heartbeat?: NodeJS.Timeout } = {};
  let unsubscribe: () => void = () => undefined;
  let unregisterClose: () => void = () => undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    unregisterClose();
    if (streamState.heartbeat) clearInterval(streamState.heartbeat);
    unsubscribe();
    if (!response.writableEnded) response.end();
  };

  const send = (event: StoreEventEnvelope<unknown>) => {
    if (
      event.sequence <= cursor ||
      response.writableEnded ||
      response.destroyed
    ) return;
    const accepted = response.write(
      `id: ${event.sequence}\nevent: store.event\ndata: ${JSON.stringify(event)}\n\n`,
    );
    cursor = event.sequence;
    // Live updates are recoverable by event ID. Closing a slow client keeps one
    // socket from buffering the retained store log into process memory.
    if (!accepted) close();
  };

  // Subscribe before catch-up so a reconnect cannot miss a newly appended
  // event between the database query and live subscription.
  unsubscribe = runtime.subscribe(send);
  unregisterClose = streams.register(close);
  request.once("close", close);
  request.once("aborted", close);
  response.once("close", close);

  let page = runtime.listEvents({ afterSequence: cursor, limit: 1_000 });
  for (const event of page.events) {
    if (closed) break;
    send(event);
  }
  while (page.hasMore && !closed) {
    page = runtime.listEvents({ afterSequence: page.nextSequence, limit: 1_000 });
    for (const event of page.events) {
      if (closed) break;
      send(event);
    }
  }
  if (closed) return;

  streamState.heartbeat = setInterval(() => {
    if (!response.writableEnded) response.write(`: heartbeat ${Date.now()}\n\n`);
  }, 15_000);
  streamState.heartbeat.unref();
}

const agenticStoreErrorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  // Express identifies an error handler by its four-argument signature.
  void _next;
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "INVALID_REQUEST",
      message: "Request validation failed.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }
  if (error instanceof AgenticStoreNotFoundError) {
    response.status(404).json({ error: "NOT_FOUND", message: error.message });
    return;
  }
  if (error instanceof AgenticStoreConflictError) {
    response.status(409).json({ error: "CONFLICT", message: error.message });
    return;
  }
  const parserStatus = errorStatus(error);
  if (parserStatus === 400 || parserStatus === 413) {
    response.status(parserStatus).json({
      error: parserStatus === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST",
      message: parserStatus === 413
        ? "Request body exceeds the 1 MB limit."
        : "Request body is not valid JSON.",
    });
    return;
  }
  if (error instanceof RangeError || error instanceof TypeError) {
    response.status(400).json({ error: "INVALID_REQUEST", message: error.message });
    return;
  }
  console.error("[agentic-store] request failed", error);
  response.status(500).json({
    error: "INTERNAL_ERROR",
    message: "The Agentic Store backend could not complete the request.",
  });
};

function parseEventTypes(value: unknown): StoreEventType[] | undefined {
  const raw = queryString(value);
  if (!raw) return undefined;
  const allowed = new Set<string>(STORE_EVENT_TYPES);
  const types = raw.split(",").map((item) => item.trim()).filter(Boolean);
  const invalid = types.filter((type) => !allowed.has(type));
  if (invalid.length > 0) throw new RangeError(`Unknown event types: ${invalid.join(", ")}`);
  return types as StoreEventType[];
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  return typeof error.status === "number" ? error.status : undefined;
}

function authorizeMutation(
  request: Request,
  response: Response,
  next: NextFunction,
  apiToken: string | undefined,
): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method) || !apiToken) {
    next();
    return;
  }
  const authorization = request.get("authorization");
  const candidate = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const expectedBytes = Buffer.from(apiToken);
  const candidateBytes = Buffer.from(candidate);
  const accepted = expectedBytes.length === candidateBytes.length
    && timingSafeEqual(expectedBytes, candidateBytes);
  if (!accepted) {
    response.status(401).json({
      error: "UNAUTHORIZED",
      message: "A valid Agentic Store API bearer token is required.",
    });
    return;
  }
  next();
}

function isAllowedBrowserOrigin(origin: string, allowedOrigins: string[] | undefined): boolean {
  if (allowedOrigins?.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function requiredQueryString(value: unknown, name: string): string {
  const parsed = queryString(value);
  if (!parsed) throw new RangeError(`Query parameter ${name} is required.`);
  return parsed;
}

function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalIso(value: unknown, name: string): string | undefined {
  const parsed = queryString(value);
  if (!parsed) return undefined;
  if (!Number.isFinite(Date.parse(parsed))) {
    throw new RangeError(`Query parameter ${name} must be an ISO-8601 timestamp.`);
  }
  return new Date(parsed).toISOString();
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new RangeError("Expected a positive integer query parameter.");
  }
  return parsed;
}

function parseNonNegativeInteger(value: unknown, fallback: number): number {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new RangeError("Expected a non-negative integer event cursor.");
  }
  return parsed;
}
