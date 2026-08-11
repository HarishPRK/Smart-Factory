import { randomUUID } from "node:crypto";
import type {
  ActionIntent,
  ActionKind,
  AgentDecision,
  DecisionAlternative,
  IncidentRecord,
  JsonValue,
} from "../../../packages/agentic-store-contracts/src/index.js";
import type { IncidentNarrative } from "../application/agent-provider.js";

type IdGenerator = () => string;

interface ActionTemplate {
  kind: ActionKind;
  targetEntityId: string;
  summary: string;
  parameters?: Record<string, JsonValue>;
  risk: ActionIntent["risk"];
  requiresApproval: boolean;
}

const action = (template: ActionTemplate, id: IdGenerator): ActionIntent => ({
  id: id(),
  kind: template.kind,
  targetEntityId: template.targetEntityId,
  summary: template.summary,
  parameters: template.parameters ?? {},
  risk: template.risk,
  requiresApproval: template.requiresApproval,
  status: template.requiresApproval ? "WAITING_APPROVAL" : "PROPOSED",
});

const alternative = (
  label: string,
  summary: string,
  score: number,
  benefits: string[],
  risks: string[],
  actions: ActionTemplate[],
  id: IdGenerator,
): DecisionAlternative => ({
  id: id(),
  label,
  summary,
  score,
  benefits,
  risks,
  actions: actions.map((item) => action(item, id)),
});

export function planDecision(
  incident: IncidentRecord,
  narrative: IncidentNarrative,
  now = new Date().toISOString(),
  id: IdGenerator = randomUUID,
): AgentDecision {
  const alternatives = buildAlternatives(incident, id);
  const selected = alternatives.reduce((best, candidate) =>
    candidate.score > best.score ? candidate : best,
  );
  return {
    id: id(),
    storeId: incident.storeId,
    incidentId: incident.id,
    createdAt: now,
    updatedAt: now,
    status: selected.actions.some((item) => item.requiresApproval)
      ? "WAITING_APPROVAL"
      : "PROPOSED",
    headline: `Coordinated response: ${incident.title}`,
    explanation: narrative.explanation,
    confidence: narrative.confidence,
    alternatives,
    selectedAlternativeId: selected.id,
    evidence: incident.evidence,
    model: { provider: narrative.provider, name: narrative.model },
  };
}

function buildAlternatives(incident: IncidentRecord, id: IdGenerator): DecisionAlternative[] {
  const monitor = alternative(
    "Observe",
    "Continue monitoring and notify an associate without changing connected store systems.",
    0.42,
    ["Lowest immediate disruption", "No customer-facing state changes"],
    ["Condition may worsen before intervention"],
    [{
      kind: "CREATE_TASK",
      targetEntityId: incident.entityId,
      summary: "Ask an associate to inspect the evidence.",
      parameters: { taskType: "GENERAL", priority: incident.severity },
      risk: "LOW",
      requiresApproval: false,
    }],
    id,
  );

  const rapid = alternative(
    "Protect customers first",
    "Apply the fastest customer-protection response and escalate operational work immediately.",
    0.68,
    ["Fast reduction of customer exposure"],
    ["May create avoidable operational disruption"],
    rapidActions(incident),
    id,
  );

  const balanced = alternative(
    "Balanced coordinated response",
    "Coordinate the relevant equipment, inventory, workforce, and customer-facing systems, then verify the outcome.",
    0.88,
    ["Addresses the cause and customer impact", "Produces an observable verification trail"],
    ["Customer-facing or physical changes require explicit approval"],
    balancedActions(incident),
    id,
  );

  return [monitor, rapid, balanced];
}

function rapidActions(incident: IncidentRecord): ActionTemplate[] {
  switch (incident.kind) {
    case "COLD_CHAIN_RISK":
      return [{
        kind: "SET_DIGITAL_AVAILABILITY",
        targetEntityId: incident.entityId,
        summary: "Temporarily remove affected chilled inventory from digital availability.",
        parameters: { available: false },
        risk: "MEDIUM",
        requiresApproval: true,
      }];
    case "SHELF_GAP":
      return [{
        kind: "DISPATCH_RESTOCK",
        targetEntityId: incident.entityId,
        summary: "Dispatch the closest available associate for immediate restock.",
        risk: "LOW",
        requiresApproval: false,
      }];
    case "QUEUE_PRESSURE":
      return [{
        kind: "OPEN_CHECKOUT_LANE",
        targetEntityId: incident.entityId,
        summary: "Open an additional simulated checkout lane.",
        risk: "MEDIUM",
        requiresApproval: true,
      }];
    case "ACCESSIBILITY_BLOCKED":
      return [{
        kind: "CLEAR_AISLE",
        targetEntityId: incident.entityId,
        summary: "Create and dispatch an urgent aisle-clearance task.",
        risk: "LOW",
        requiresApproval: false,
      }];
    case "ENERGY_ANOMALY":
      return [{
        kind: "SET_EQUIPMENT_MODE",
        targetEntityId: incident.entityId,
        summary: "Request an energy-saving equipment mode.",
        parameters: { mode: "ECONOMY" },
        risk: "HIGH",
        requiresApproval: true,
      }];
    case "SENSOR_STALE":
      return [{
        kind: "REQUEST_MAINTENANCE",
        targetEntityId: incident.entityId,
        summary: "Dispatch telemetry diagnostics.",
        risk: "LOW",
        requiresApproval: false,
      }];
  }
}

function balancedActions(incident: IncidentRecord): ActionTemplate[] {
  const task = (
    kind: ActionKind,
    summary: string,
    parameters: Record<string, JsonValue> = {},
  ): ActionTemplate => ({
    kind,
    targetEntityId: incident.entityId,
    summary,
    parameters,
    risk: "LOW",
    requiresApproval: false,
  });

  switch (incident.kind) {
    case "COLD_CHAIN_RISK":
      return [
        task("REQUEST_MAINTENANCE", "Create a high-priority refrigeration inspection task."),
        task("CREATE_TASK", "Ask an associate to assess and protect exposed inventory.", {
          taskType: "SAFETY",
          priority: "HIGH",
        }),
        {
          kind: "SET_DIGITAL_AVAILABILITY",
          targetEntityId: incident.entityId,
          summary: "Pause digital availability until safe temperature is verified.",
          parameters: { available: false },
          risk: "MEDIUM",
          requiresApproval: true,
        },
      ];
    case "SHELF_GAP":
      return [
        task("DISPATCH_RESTOCK", "Reserve backroom inventory and dispatch a restock task."),
        task("CREATE_TASK", "Verify the planogram after replenishment.", {
          taskType: "RESTOCK",
          priority: "MEDIUM",
        }),
      ];
    case "QUEUE_PRESSURE":
      return [
        task("CREATE_TASK", "Reassign an available associate to checkout support.", {
          taskType: "CUSTOMER_FLOW",
          priority: "MEDIUM",
        }),
        {
          kind: "OPEN_CHECKOUT_LANE",
          targetEntityId: incident.entityId,
          summary: "Open one additional simulated checkout lane.",
          parameters: { additionalLanes: 1 },
          risk: "MEDIUM",
          requiresApproval: true,
        },
      ];
    case "ACCESSIBILITY_BLOCKED":
      return [
        task("CLEAR_AISLE", "Dispatch an urgent accessibility-clearance task."),
        task("CREATE_TASK", "Hold automated routes through aisle 3 until clearance is verified.", {
          taskType: "SAFETY",
          priority: "HIGH",
        }),
      ];
    case "ENERGY_ANOMALY":
      return [
        task("CREATE_TASK", "Inspect the largest electrical loads against the current occupancy."),
        {
          kind: "SET_EQUIPMENT_MODE",
          targetEntityId: incident.entityId,
          summary: "Request economy mode only after an operator confirms noncritical loads.",
          parameters: { mode: "ECONOMY" },
          risk: "HIGH",
          requiresApproval: true,
        },
      ];
    case "SENSOR_STALE":
      return [
        task("REQUEST_MAINTENANCE", "Restore the sensor or gateway connection."),
        task("CREATE_TASK", "Use the documented manual inspection until telemetry recovers."),
      ];
  }
}
