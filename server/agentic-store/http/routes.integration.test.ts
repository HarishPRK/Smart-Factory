// @vitest-environment node

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AGENTIC_STORE_SCHEMA_VERSION,
  type ObservationBatch,
  type SensorBinding,
} from "../../../packages/agentic-store-contracts/src/index.js";
import type { AgenticStoreConfig } from "../config.js";
import { createAgenticStoreRuntime, type AgenticStoreRuntime } from "../runtime.js";
import {
  AgenticStoreStreamRegistry,
  createAgenticStoreHttpApp,
} from "./routes.js";

const STORE_ID = "store-http-test";

function config(): AgenticStoreConfig {
  return {
    storeId: STORE_ID,
    databasePath: ":memory:",
    simulationEnabled: false,
    simulationTickMs: 5_000,
    historyRetentionHours: 72,
    localAiAllowRemote: false,
  };
}

const binding: SensorBinding = {
  id: "http-plc-occupancy",
  storeId: STORE_ID,
  sourceId: "plc:http-test",
  tag: "occupancy",
  entityId: STORE_ID,
  property: "occupancy.count",
  valueType: "number",
  unit: "people",
  min: 0,
};

function batch(sequence: number): ObservationBatch {
  return {
    schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
    storeId: STORE_ID,
    sourceId: binding.sourceId,
    sourceSessionId: "http-test-session",
    sequence,
    sampledAt: new Date(Date.now() + sequence * 1_000).toISOString(),
    readings: [{ tag: binding.tag, value: sequence * 10 }],
  };
}

describe("Agentic Store HTTP API", () => {
  let runtime: AgenticStoreRuntime;
  let server: Server;
  let streams: AgenticStoreStreamRegistry;
  let baseUrl: string;

  beforeEach(async () => {
    runtime = createAgenticStoreRuntime({ config: config(), bindings: [binding] });
    streams = new AgenticStoreStreamRegistry();
    server = createServer(createAgenticStoreHttpApp(runtime, streams));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/agentic-store`;
  });

  afterEach(async () => {
    streams.closeAll();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await runtime.dispose();
  });

  it("accepts valid ingest and returns a frontend-ready bootstrap document", async () => {
    const ingest = await fetch(`${baseUrl}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch(1)),
    });
    expect(ingest.status).toBe(202);
    expect(await ingest.json()).toMatchObject({ accepted: 1, snapshotVersion: 1 });

    const bootstrap = await fetch(`${baseUrl}/bootstrap`);
    expect(bootstrap.status).toBe(200);
    expect(await bootstrap.json()).toMatchObject({
      manifest: { storeId: STORE_ID },
      snapshot: {
        version: 1,
        properties: [expect.objectContaining({ value: 10 })],
      },
      capabilities: { simulation: false, externalIngest: true },
      stream: { url: "/api/agentic-store/stream?after=1", latestSequence: 1 },
    });
  });

  it.each([
    ["POST", "/ingest", {}, "INVALID_REQUEST"],
    ["POST", "/simulator/control", { action: "FLY" }, "INVALID_REQUEST"],
    ["GET", "/events?after=-1", undefined, "INVALID_REQUEST"],
    ["GET", "/events?types=not.an.event", undefined, "INVALID_REQUEST"],
    ["GET", "/history?entityId=store-http-test", undefined, "INVALID_REQUEST"],
  ] as const)("returns a structured 400 for %s %s", async (method, path, body, code) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: code });
  });

  it("returns a structured 400 for malformed JSON", async () => {
    const response = await fetch(`${baseUrl}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "INVALID_REQUEST" });
  });

  it("replays only events after Last-Event-ID on an SSE reconnect", async () => {
    runtime.ingest(batch(1), "PLC");
    runtime.ingest(batch(2), "PLC");
    runtime.ingest(batch(3), "PLC");
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/stream?after=0`, {
      headers: { "Last-Event-ID": "1" },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let content = "";
    const timeout = setTimeout(() => controller.abort(), 2_000);
    try {
      while (!content.includes('"sequence":3')) {
        const chunk = await reader.read();
        if (chunk.done) break;
        content += decoder.decode(chunk.value, { stream: true });
      }
    } finally {
      clearTimeout(timeout);
      await reader.cancel();
      controller.abort();
    }

    expect(content).toContain("retry: 2000");
    expect(content).not.toContain("id: 1\n");
    expect(content).toContain("id: 2\n");
    expect(content).toContain("id: 3\n");
    const dataLines = content
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)) as { sequence: number; type: string });
    expect(dataLines).toMatchObject([
      { sequence: 2, type: "twin.patch" },
      { sequence: 3, type: "twin.patch" },
    ]);
  });

  it("rejects an SSE cursor ahead of the local event log", async () => {
    runtime.ingest(batch(1), "PLC");

    const response = await fetch(`${baseUrl}/stream?after=999`);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "EVENT_CURSOR_AHEAD",
      latestSequence: 1,
    });
    expect(streams.size).toBe(0);
  });

  it("lets graceful shutdown close active SSE responses immediately", async () => {
    const response = await fetch(`${baseUrl}/stream?after=0`);
    expect(response.status).toBe(200);
    expect(streams.size).toBe(1);
    const reader = response.body!.getReader();

    streams.closeAll();

    let ended = false;
    for (let attempt = 0; attempt < 3 && !ended; attempt += 1) {
      ended = (await reader.read()).done;
    }
    expect(ended).toBe(true);
    expect(streams.size).toBe(0);
  });
});
