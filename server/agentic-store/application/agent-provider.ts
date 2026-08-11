import { z } from "zod";
import type {
  AgentQuestionResponse,
  EvidenceReference,
  IncidentRecord,
  TwinSnapshot,
} from "../../../packages/agentic-store-contracts/src/index.js";
import type { AgenticStoreConfig } from "../config.js";

export interface IncidentNarrative {
  explanation: string;
  confidence: number;
  provider: "deterministic" | "openai-compatible";
  model: string;
}

export interface AgentProvider {
  readonly kind: "deterministic" | "openai-compatible";
  readonly model: string;
  explainIncident(incident: IncidentRecord): Promise<IncidentNarrative>;
  answerQuestion(
    question: string,
    snapshot: TwinSnapshot,
    incidents: IncidentRecord[],
    entityIds?: string[],
  ): Promise<AgentQuestionResponse>;
}

const narrativeSchema = z.object({
  explanation: z.string().trim().min(1).max(4_000),
  confidence: z.number().min(0).max(1),
}).strict();

const answerSchema = z.object({
  answer: z.string().trim().min(1).max(6_000),
  evidence: z.array(z.object({
    entityId: z.string(),
    property: z.string(),
    sourceId: z.string(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    unit: z.string().optional(),
    sampledAt: z.string(),
    quality: z.enum(["GOOD", "UNCERTAIN", "BAD", "STALE"]),
  })).max(20),
}).strict();

export class DeterministicAgentProvider implements AgentProvider {
  readonly kind = "deterministic" as const;
  readonly model = "local-playbook-v1";

  async explainIncident(incident: IncidentRecord): Promise<IncidentNarrative> {
    const evidence = incident.evidence
      .map((item) => `${item.entityId}.${item.property}=${String(item.value)}${item.unit ? ` ${item.unit}` : ""}`)
      .join(", ");
    const guidance: Record<IncidentRecord["kind"], string> = {
      COLD_CHAIN_RISK:
        "The observed temperature pattern threatens product integrity. Check door state and equipment power, protect affected inventory, and dispatch maintenance before restoring availability.",
      SHELF_GAP:
        "On-shelf availability is below the operating threshold while backroom stock can be checked. A coordinated restock task is preferred over changing the customer promise without evidence.",
      QUEUE_PRESSURE:
        "Demand currently exceeds checkout capacity. Rebalancing an associate or opening another simulated lane should reduce abandonment and waiting time.",
      ENERGY_ANOMALY:
        "Store demand is materially above its operating baseline. Correlate the increase with refrigeration, HVAC, and occupancy before changing equipment state.",
      ACCESSIBILITY_BLOCKED:
        "The accessible route no longer meets the minimum clearance. Clear the obstruction before dispatching any equipment through the same aisle.",
      SENSOR_STALE:
        "The source is too old to support a confident operational decision. Restore telemetry before executing dependent actions.",
    };
    return {
      explanation: `${guidance[incident.kind]} Evidence: ${evidence || "no fresh evidence"}.`,
      confidence: incident.evidence.every((item) => item.quality === "GOOD") ? 0.91 : 0.66,
      provider: this.kind,
      model: this.model,
    };
  }

  async answerQuestion(
    question: string,
    snapshot: TwinSnapshot,
    incidents: IncidentRecord[],
    entityIds?: string[],
  ): Promise<AgentQuestionResponse> {
    const wanted = entityIds?.length ? new Set(entityIds) : undefined;
    const evidence = snapshot.properties
      .filter((property) => !wanted || wanted.has(property.entityId))
      .filter((property) => property.quality !== "BAD")
      .slice(-12)
      .map<EvidenceReference>((property) => ({
        entityId: property.entityId,
        property: property.property,
        sourceId: property.sourceId,
        value: property.value,
        unit: property.unit,
        sampledAt: property.sampledAt,
        quality: property.quality,
      }));
    const active = incidents.filter((incident) => incident.status !== "RESOLVED");
    const incidentText = active.length
      ? `Active incidents: ${active.map((incident) => `${incident.title} (${incident.severity})`).join(", ")}.`
      : "There are no active incidents.";
    const evidenceText = evidence.length
      ? ` Relevant current evidence: ${evidence.map((item) => `${item.entityId}.${item.property}=${String(item.value)}${item.unit ? ` ${item.unit}` : ""}`).join(", ")}.`
      : " No matching current evidence is available.";
    return {
      answer: `For “${question}”: ${incidentText}${evidenceText}`,
      evidence,
      provider: this.kind,
      generatedAt: new Date().toISOString(),
    };
  }
}

class OpenAICompatibleAgentProvider implements AgentProvider {
  readonly kind = "openai-compatible" as const;

  constructor(
    private readonly baseUrl: string,
    readonly model: string,
    private readonly apiKey: string | undefined,
    private readonly fallback: DeterministicAgentProvider,
  ) {}

  async explainIncident(incident: IncidentRecord): Promise<IncidentNarrative> {
    try {
      const result = narrativeSchema.parse(await this.completeJson([
        {
          role: "system",
          content:
            "You are a retail operations advisor. Return JSON only with explanation and confidence. Use only supplied evidence. Do not reveal chain-of-thought and never claim an action was executed.",
        },
        { role: "user", content: JSON.stringify(incident) },
      ]));
      return {
        ...result,
        provider: this.kind,
        model: this.model,
      };
    } catch {
      return this.fallback.explainIncident(incident);
    }
  }

  async answerQuestion(
    question: string,
    snapshot: TwinSnapshot,
    incidents: IncidentRecord[],
    entityIds?: string[],
  ): Promise<AgentQuestionResponse> {
    const allowed = entityIds?.length ? new Set(entityIds) : undefined;
    const properties = snapshot.properties
      .filter((property) => !allowed || allowed.has(property.entityId))
      .slice(-100);
    try {
      const result = answerSchema.parse(await this.completeJson([
        {
          role: "system",
          content:
            "Answer using only the supplied store facts. Return JSON with answer and evidence. Evidence entries must be copied from supplied properties. Do not reveal chain-of-thought or claim to execute actions.",
        },
        {
          role: "user",
          content: JSON.stringify({ question, properties, incidents: incidents.slice(0, 20) }),
        },
      ]));
      const allowedEvidence = new Set(properties.map(evidenceFingerprint));
      if (result.evidence.some((item) => !allowedEvidence.has(evidenceFingerprint(item)))) {
        throw new Error("Local AI returned evidence that was not present in the supplied snapshot.");
      }
      return {
        ...result,
        provider: this.kind,
        generatedAt: new Date().toISOString(),
      };
    } catch {
      return this.fallback.answerQuestion(question, snapshot, incidents, entityIds);
    }
  }

  private async completeJson(messages: { role: "system" | "user"; content: string }[]): Promise<unknown> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: this.model, messages, temperature: 0.1 }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Local AI returned HTTP ${response.status}.`);
    const body = await response.json() as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("Local AI response did not contain message content.");
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Local AI response was not JSON.");
    return JSON.parse(content.slice(start, end + 1));
  }
}

function evidenceFingerprint(item: EvidenceReference): string {
  return JSON.stringify([
    item.entityId,
    item.property,
    item.sourceId ?? null,
    item.value,
    item.unit ?? null,
    item.sampledAt,
    item.quality,
  ]);
}

function assertLocalBaseUrl(baseUrl: string, allowRemote: boolean): string {
  const parsed = new URL(baseUrl);
  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!allowRemote && !localHosts.has(parsed.hostname)) {
    throw new Error(
      `LOCAL_AI_BASE_URL must be loopback unless LOCAL_AI_ALLOW_REMOTE=true (got ${parsed.hostname}).`,
    );
  }
  return parsed.toString().replace(/\/$/, "");
}

export function createAgentProvider(config: AgenticStoreConfig): AgentProvider {
  const fallback = new DeterministicAgentProvider();
  if (!config.localAiBaseUrl || !config.localAiModel) return fallback;
  return new OpenAICompatibleAgentProvider(
    assertLocalBaseUrl(config.localAiBaseUrl, config.localAiAllowRemote),
    config.localAiModel,
    config.localAiApiKey,
    fallback,
  );
}
