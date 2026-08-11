// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AGENTIC_STORE_SCHEMA_VERSION,
  type TwinSnapshot,
} from "../../../packages/agentic-store-contracts/src/index.js";
import type { AgenticStoreConfig } from "../config.js";
import { createAgentProvider } from "./agent-provider.js";

const sampledAt = "2026-08-10T12:00:00.000Z";

function config(): AgenticStoreConfig {
  return {
    storeId: "store-provider-test",
    databasePath: ":memory:",
    simulationEnabled: false,
    simulationTickMs: 250,
    historyRetentionHours: 72,
    localAiBaseUrl: "http://127.0.0.1:11434/v1",
    localAiModel: "local-test-model",
    localAiAllowRemote: false,
  };
}

function snapshot(): TwinSnapshot {
  return {
    schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
    storeId: "store-provider-test",
    version: 1,
    generatedAt: sampledAt,
    properties: [{
      entityId: "checkout-cluster-01",
      property: "queue.length",
      value: 9,
      unit: "people",
      quality: "GOOD",
      sampledAt,
      receivedAt: sampledAt,
      sourceId: "plc:checkout-controller",
      sourceSessionId: "session-1",
      sourceSequence: 1,
      version: 1,
    }],
  };
}

describe("OpenAI-compatible AgentProvider evidence validation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falls back when a model changes the evidence source identity", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            answer: "The queue is elevated.",
            evidence: [{
              entityId: "checkout-cluster-01",
              property: "queue.length",
              sourceId: "simulator:forged-source",
              value: 9,
              unit: "people",
              sampledAt,
              quality: "GOOD",
            }],
          }),
        },
      }],
    }), { status: 200 })));
    const provider = createAgentProvider(config());

    const answer = await provider.answerQuestion("How long is the queue?", snapshot(), []);

    expect(answer.provider).toBe("deterministic");
    expect(answer.evidence).toEqual([
      expect.objectContaining({ sourceId: "plc:checkout-controller", value: 9 }),
    ]);
  });
});
