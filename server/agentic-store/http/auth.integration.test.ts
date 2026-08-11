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
import { createAgenticStoreHttpApp } from "./routes.js";

const STORE_ID = "store-auth-test";
const API_TOKEN = "agentic-store-test-token";
const binding: SensorBinding = {
  id: "auth-occupancy",
  storeId: STORE_ID,
  sourceId: "plc:auth-test",
  tag: "occupancy",
  entityId: STORE_ID,
  property: "occupancy.count",
  valueType: "number",
  unit: "people",
};

function config(): AgenticStoreConfig {
  return {
    storeId: STORE_ID,
    databasePath: ":memory:",
    simulationEnabled: false,
    simulationTickMs: 5_000,
    historyRetentionHours: 72,
    apiToken: API_TOKEN,
    localAiAllowRemote: false,
  };
}

function batch(): ObservationBatch {
  return {
    schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
    storeId: STORE_ID,
    sourceId: binding.sourceId,
    sourceSessionId: "auth-session",
    sequence: 1,
    sampledAt: new Date().toISOString(),
    readings: [{ tag: binding.tag, value: 12 }],
  };
}

describe("Agentic Store mutation authentication", () => {
  let runtime: AgenticStoreRuntime;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    runtime = createAgenticStoreRuntime({ config: config(), bindings: [binding] });
    server = createServer(createAgenticStoreHttpApp(runtime));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/agentic-store`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await runtime.dispose();
  });

  it("keeps read endpoints public while rejecting missing and invalid bearer tokens", async () => {
    expect((await fetch(`${baseUrl}/health`)).status).toBe(200);

    for (const authorization of [undefined, "Basic nope", "Bearer wrong-token"]) {
      const response = await fetch(`${baseUrl}/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify(batch()),
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: "UNAUTHORIZED",
        message: "A valid Agentic Store API bearer token is required.",
      });
    }
    expect(runtime.snapshot().properties).toEqual([]);
  });

  it("allows a mutation carrying the configured bearer token", async () => {
    const response = await fetch(`${baseUrl}/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify(batch()),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ accepted: 1, rejected: 0 });
    expect(runtime.snapshot().properties).toEqual([
      expect.objectContaining({ property: "occupancy.count", value: 12 }),
    ]);
  });
});
