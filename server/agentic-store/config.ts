import { resolve } from "node:path";

export interface AgenticStoreConfig {
  storeId: string;
  databasePath: string;
  bindingsPath?: string;
  simulationEnabled: boolean;
  simulationTickMs: number;
  historyRetentionHours: number;
  eventRetentionHours?: number;
  presenceRetentionMinutes?: number;
  apiToken?: string;
  allowedOrigins?: string[];
  localAiBaseUrl?: string;
  localAiModel?: string;
  localAiApiKey?: string;
  localAiAllowRemote: boolean;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  return value.trim().toLowerCase() === "true";
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadAgenticStoreConfig(): AgenticStoreConfig {
  return {
    storeId: process.env.AGENTIC_STORE_ID?.trim() || "store-001",
    databasePath: resolve(
      process.cwd(),
      process.env.AGENTIC_STORE_DB_PATH?.trim() || ".local-data/agentic-store.sqlite",
    ),
    bindingsPath: process.env.AGENTIC_STORE_BINDINGS_PATH?.trim()
      ? resolve(process.cwd(), process.env.AGENTIC_STORE_BINDINGS_PATH.trim())
      : undefined,
    simulationEnabled: parseBoolean(process.env.AGENTIC_STORE_SIMULATION, true),
    simulationTickMs: Math.max(
      250,
      parsePositiveNumber(process.env.AGENTIC_STORE_SIMULATION_TICK_MS, 250),
    ),
    historyRetentionHours: parsePositiveNumber(
      process.env.AGENTIC_STORE_HISTORY_RETENTION_HOURS,
      72,
    ),
    eventRetentionHours: parsePositiveNumber(
      process.env.AGENTIC_STORE_EVENT_RETENTION_HOURS,
      24,
    ),
    presenceRetentionMinutes: parsePositiveNumber(
      process.env.AGENTIC_STORE_PRESENCE_RETENTION_MINUTES,
      5,
    ),
    apiToken: process.env.AGENTIC_STORE_API_TOKEN?.trim() || undefined,
    allowedOrigins: process.env.AGENTIC_STORE_ALLOWED_ORIGINS
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    localAiBaseUrl: process.env.LOCAL_AI_BASE_URL?.trim() || undefined,
    localAiModel: process.env.LOCAL_AI_MODEL?.trim() || undefined,
    localAiApiKey: process.env.LOCAL_AI_API_KEY?.trim() || undefined,
    localAiAllowRemote: parseBoolean(process.env.LOCAL_AI_ALLOW_REMOTE, false),
  };
}
