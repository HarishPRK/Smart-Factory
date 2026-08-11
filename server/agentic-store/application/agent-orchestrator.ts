import { randomUUID } from "node:crypto";
import type {
  ActionIntent,
  AgentActivity,
  AgentDecision,
  AgentQuestionResponse,
  DecisionReviewRequest,
  IncidentRecord,
  OperationsTask,
} from "../../../packages/agentic-store-contracts/src/index.js";
import { planDecision } from "../domain/decision-planner.js";
import { SqliteAgenticStore } from "../infrastructure/sqlite-store.js";
import { StoreEventBus } from "../infrastructure/store-event-bus.js";
import type { AgentProvider } from "./agent-provider.js";

export interface ActionExecutionResult {
  accepted: boolean;
  message: string;
  executor: ActionIntent["executor"];
}

export interface StoreActionTarget {
  applyAction(action: ActionIntent): ActionExecutionResult | Promise<ActionExecutionResult>;
}

type Clock = () => Date;
type IdGenerator = () => string;

export class AgentOrchestrator {
  constructor(
    private readonly storeId: string,
    private readonly store: SqliteAgenticStore,
    private readonly bus: StoreEventBus,
    private readonly provider: AgentProvider,
    private readonly actionTarget: StoreActionTarget,
    private readonly clock: Clock = () => new Date(),
    private readonly id: IdGenerator = randomUUID,
  ) {}

  async handleIncidentOpened(incident: IncidentRecord): Promise<AgentDecision | undefined> {
    this.activity(incident, "STORE_ORCHESTRATOR", "OBSERVE", "Collected the incident evidence and affected store entities.");
    this.activity(incident, specialistFor(incident), "ANALYZE", "Correlated current measurements with the local operating playbook.");

    const narrative = await this.provider.explainIncident(incident);
    const actionable = this.store.getIncident(incident.id);
    if (!actionable || actionable.status === "RESOLVED") return undefined;
    this.activity(incident, "STORE_ORCHESTRATOR", "COMPARE", "Compared observe-only, speed-first, and balanced coordinated responses.");
    const decision = planDecision(actionable, narrative, this.clock().toISOString(), this.id);

    const proposedEvent = this.store.transaction(() => {
      this.store.upsertDecision(decision);
      const latestIncident = this.store.getIncident(incident.id) ?? incident;
      this.store.upsertIncident({
        ...latestIncident,
        decisionId: decision.id,
        updatedAt: decision.updatedAt,
      });
      return this.store.appendEvent<AgentDecision>({
        storeId: decision.storeId,
        type: "decision.proposed",
        entityId: incident.entityId,
        correlationId: incident.id,
        source: "AGENT",
        occurredAt: decision.createdAt,
        data: decision,
      });
    });
    this.bus.publish(proposedEvent);
    this.activity(
      incident,
      "STORE_ORCHESTRATOR",
      decision.status === "WAITING_APPROVAL" ? "WAIT_FOR_APPROVAL" : "PROPOSE",
      decision.status === "WAITING_APPROVAL"
        ? "Prepared reversible low-risk work and held customer-facing or physical changes for approval."
        : "Proposed a response that can execute within the local demo policy.",
      decision.id,
    );

    const executed = await this.executeEligibleActions(decision, false);
    const latestIncident = this.store.getIncident(incident.id);
    return latestIncident?.status === "RESOLVED"
      ? (this.handleIncidentResolved(latestIncident) ?? executed)
      : executed;
  }

  async reviewDecision(
    decisionId: string,
    review: DecisionReviewRequest,
    approved: boolean,
  ): Promise<AgentDecision> {
    const current = this.store.getDecision(decisionId);
    if (!current) throw new AgenticStoreNotFoundError(`Decision ${decisionId} was not found.`);
    if (current.status !== "WAITING_APPROVAL") {
      throw new AgenticStoreConflictError(
        `Decision ${decisionId} is ${current.status}, not WAITING_APPROVAL.`,
      );
    }
    const currentIncident = this.store.getIncident(current.incidentId);
    if (!currentIncident || currentIncident.status === "RESOLVED") {
      if (currentIncident) this.handleIncidentResolved(currentIncident);
      throw new AgenticStoreConflictError(
        `Decision ${decisionId} can no longer be reviewed because its incident is resolved.`,
      );
    }

    const now = this.clock().toISOString();
    const selected = selectedAlternative(current);
    const decision: AgentDecision = {
      ...current,
      updatedAt: now,
      status: approved ? "EXECUTING" : "REJECTED",
      approval: {
        actorId: review.actorId,
        decision: approved ? "APPROVED" : "REJECTED",
        occurredAt: now,
        note: review.note,
      },
      alternatives: current.alternatives.map((alternative) =>
        alternative.id !== selected.id
          ? alternative
          : {
              ...alternative,
              actions: alternative.actions.map((action) =>
                action.status !== "WAITING_APPROVAL"
                  ? action
                  : { ...action, status: approved ? "APPROVED" : "REJECTED" },
              ),
            },
      ),
    };
    this.persistDecision(decision, "OPERATOR");

    const incident = this.store.getIncident(decision.incidentId);
    if (incident) {
      this.activity(
        incident,
        "STORE_ORCHESTRATOR",
        approved ? "ACT" : "COMPLETE",
        approved
          ? `Operator ${review.actorId} approved the guarded actions.`
          : `Operator ${review.actorId} rejected the guarded actions.`,
        decision.id,
      );
    }
    if (!approved) return decision;
    const executed = await this.executeEligibleActions(decision, true);
    const latestIncident = this.store.getIncident(executed.incidentId);
    return latestIncident?.status === "RESOLVED"
      ? (this.handleIncidentResolved(latestIncident) ?? executed)
      : executed;
  }

  handleIncidentResolved(incident: IncidentRecord): AgentDecision | undefined {
    if (!incident.decisionId) return undefined;
    const decision = this.store.getDecision(incident.decisionId);
    if (!decision) return undefined;
    const actions = selectedAlternative(decision).actions;
    if (actions.some((action) => action.status === "EXECUTING")) {
      // The action acknowledgement owns the final receipt. It will re-enter
      // resolution after the await, unless another lifecycle transition (such
      // as simulator reset) supersedes it first.
      return decision;
    }
    if (
      decision.status === "REJECTED" ||
      decision.status === "FAILED" ||
      decision.status === "SUPERSEDED"
    ) {
      this.cancelDecisionTasks(decision.id, this.clock().toISOString());
      return decision;
    }
    if (decision.status === "VERIFIED") return decision;
    if (actions.some((action) => action.status === "FAILED")) {
      const now = this.clock().toISOString();
      const failed: AgentDecision = {
        ...decision,
        status: "FAILED",
        updatedAt: now,
      };
      this.cancelDecisionTasks(failed.id, now);
      this.persistDecision(failed, "SYSTEM");
      this.activity(
        incident,
        "STORE_ORCHESTRATOR",
        "COMPLETE",
        "The condition recovered, but the response was not verified because an action failed.",
        failed.id,
      );
      return failed;
    }
    if (!actions.every((action) => action.status === "SUCCEEDED" || action.status === "VERIFIED")) {
      const reason = actions.some((action) => action.status === "WAITING_APPROVAL")
        ? "the incident recovered before approval; the guarded action was not executed"
        : "the incident recovered before all planned actions completed";
      return this.handleIncidentSuperseded(
        incident,
        reason,
      );
    }
    this.completeDecisionTasks(decision.id, this.clock().toISOString());
    const now = this.clock().toISOString();
    const updated: AgentDecision = {
      ...decision,
      status: "VERIFIED",
      updatedAt: now,
      alternatives: decision.alternatives.map((alternative) =>
        alternative.id !== decision.selectedAlternativeId
          ? alternative
          : {
              ...alternative,
              actions: alternative.actions.map((action) =>
                action.status === "SUCCEEDED" ? { ...action, status: "VERIFIED" } : action,
              ),
            },
      ),
    };
    this.persistDecision(updated, "SYSTEM");
    this.activity(
      incident,
      "STORE_ORCHESTRATOR",
      "VERIFY",
      "Observed the expected recovery in fresh twin evidence; the response is verified.",
      updated.id,
    );
    this.activity(
      incident,
      "STORE_ORCHESTRATOR",
      "COMPLETE",
      "Closed the incident with an evidence-linked decision receipt.",
      updated.id,
    );
    return updated;
  }

  handleIncidentSuperseded(
    incident: IncidentRecord,
    reason: string,
  ): AgentDecision | undefined {
    if (!incident.decisionId) return undefined;
    const decision = this.store.getDecision(incident.decisionId);
    if (!decision) return undefined;
    const now = this.clock().toISOString();
    // Tasks may still be active even when a prior action made the decision
    // terminal. A reset must retire that operational work idempotently.
    this.cancelDecisionTasks(decision.id, now);
    if (
      decision.status === "VERIFIED" ||
      decision.status === "SUPERSEDED" ||
      decision.status === "REJECTED" ||
      decision.status === "FAILED"
    ) return decision;

    const superseded: AgentDecision = {
      ...decision,
      status: "SUPERSEDED",
      updatedAt: now,
      alternatives: decision.alternatives.map((alternative) => ({
        ...alternative,
        actions: alternative.actions.map((action) =>
          ["PROPOSED", "WAITING_APPROVAL", "APPROVED", "EXECUTING"].includes(action.status)
            ? {
                ...action,
                status: "CANCELLED",
                result: `Workflow superseded: ${reason}`,
              }
            : action,
        ),
      })),
    };
    this.persistDecision(superseded, "SYSTEM");
    this.activity(
      incident,
      "STORE_ORCHESTRATOR",
      "COMPLETE",
      `The workflow was safely superseded: ${reason}`,
      superseded.id,
    );
    return superseded;
  }

  answerQuestion(question: string, entityIds?: string[]): Promise<AgentQuestionResponse> {
    const snapshot = this.store.getSnapshot(this.storeId);
    const incidents = this.store.listIncidents(snapshot.storeId);
    return this.provider.answerQuestion(question, snapshot, incidents, entityIds);
  }

  private async executeEligibleActions(
    input: AgentDecision,
    includeApproved: boolean,
  ): Promise<AgentDecision> {
    let decision = input;
    const actionIds = selectedAlternative(input).actions.map((action) => action.id);
    for (const actionId of actionIds) {
      const current = this.store.getDecision(decision.id) ?? decision;
      if (isTerminalDecision(current)) return current;
      const candidate = findAction(current, actionId);
      if (!candidate) continue;
      const eligible = candidate.status === "PROPOSED" ||
        (includeApproved && candidate.status === "APPROVED");
      if (!eligible) {
        decision = current;
        continue;
      }

      decision = updateAction(current, candidate.id, {
        status: "EXECUTING",
      }, this.clock().toISOString());
      this.persistDecision(decision, "AGENT");
      let task: OperationsTask | undefined;
      let result: ActionExecutionResult | undefined;
      let executionError: unknown;
      try {
        task = this.createTaskForAction(decision, candidate);
        if (task) this.persistTask(task);
        result = await this.actionTarget.applyAction(candidate);
      } catch (error) {
        executionError = error;
      }

      // applyAction may be asynchronous. Reload the authoritative workflow
      // after every await so a reset/rejection cannot be overwritten by a late
      // adapter acknowledgement and stale local object copies.
      const latest = this.store.getDecision(decision.id);
      const latestAction = latest ? findAction(latest, candidate.id) : undefined;
      if (!latest || isTerminalDecision(latest) || latestAction?.status !== "EXECUTING") {
        if (task) this.cancelTaskIfActive(task.id, this.clock().toISOString());
        return latest ?? decision;
      }
      decision = latest;
      const persistedTask = task ? this.findTask(task.id) : undefined;
      if (persistedTask && result && !result.accepted) {
        this.persistTask({
          ...persistedTask,
          status: "CANCELLED",
          updatedAt: this.clock().toISOString(),
        });
      } else if (persistedTask && result?.executor === "SIMULATOR") {
        this.persistTask({
          ...persistedTask,
          status: "IN_PROGRESS",
          updatedAt: this.clock().toISOString(),
        });
      } else if (persistedTask && executionError != null) {
        this.cancelTaskIfActive(persistedTask.id, this.clock().toISOString());
      }

      decision = updateAction(decision, candidate.id, result ? {
        status: result.accepted ? "SUCCEEDED" : "FAILED",
        executor: result.executor,
        result: result.message,
      } : {
        status: "FAILED",
        result: executionError instanceof Error ? executionError.message : String(executionError),
      }, this.clock().toISOString());
      this.persistDecision(decision, "AGENT");

      const latestIncident = this.store.getIncident(decision.incidentId);
      if (latestIncident?.status === "RESOLVED") {
        return this.handleIncidentResolved(latestIncident) ?? decision;
      }
    }

    const latest = this.store.getDecision(decision.id) ?? decision;
    if (isTerminalDecision(latest)) return latest;
    decision = latest;
    const actions = selectedAlternative(decision).actions;
    const hasFailure = actions.some((action) => action.status === "FAILED");
    const waiting = actions.some((action) => action.status === "WAITING_APPROVAL");
    decision = {
      ...decision,
      updatedAt: this.clock().toISOString(),
      status: hasFailure ? "FAILED" : waiting ? "WAITING_APPROVAL" : "VERIFYING",
    };
    this.persistDecision(decision, "AGENT");
    return decision;
  }

  private createTaskForAction(
    decision: AgentDecision,
    action: ActionIntent,
  ): OperationsTask | undefined {
    if (!["CREATE_TASK", "DISPATCH_RESTOCK", "REQUEST_MAINTENANCE", "CLEAR_AISLE"].includes(action.kind)) {
      return undefined;
    }
    const now = this.clock().toISOString();
    const kind: OperationsTask["kind"] =
      action.kind === "DISPATCH_RESTOCK" ? "RESTOCK" :
      action.kind === "REQUEST_MAINTENANCE" ? "MAINTENANCE" :
      action.kind === "CLEAR_AISLE" ? "SAFETY" :
      action.parameters.taskType === "CUSTOMER_FLOW" ? "CUSTOMER_FLOW" :
      action.parameters.taskType === "SAFETY" ? "SAFETY" : "GENERAL";
    return {
      id: this.id(),
      storeId: decision.storeId,
      incidentId: decision.incidentId,
      decisionId: decision.id,
      kind,
      title: action.summary,
      description: `Created by the ${decision.headline} workflow.`,
      targetEntityId: action.targetEntityId,
      priority: kind === "SAFETY" || kind === "MAINTENANCE" ? "HIGH" : "MEDIUM",
      status: "OPEN",
      assignedRole: kind === "MAINTENANCE" ? "maintenance-associate" : "store-associate",
      createdAt: now,
      updatedAt: now,
    };
  }

  private persistTask(
    task: OperationsTask,
    source: "AGENT" | "SYSTEM" = "AGENT",
  ): void {
    const event = this.store.transaction(() => {
      this.store.upsertTask(task);
      return this.store.appendEvent<OperationsTask>({
        storeId: task.storeId,
        type: "task.updated",
        entityId: task.targetEntityId,
        correlationId: task.incidentId,
        causationId: task.decisionId,
        source,
        occurredAt: task.updatedAt,
        data: task,
      });
    });
    this.bus.publish(event);
  }

  private completeDecisionTasks(decisionId: string, completedAt: string): void {
    for (const task of this.store.listTasks(this.storeId)) {
      if (
        task.decisionId !== decisionId ||
        task.status === "COMPLETED" ||
        task.status === "CANCELLED"
      ) continue;
      this.persistTask({
        ...task,
        status: "COMPLETED",
        updatedAt: completedAt,
        completedAt,
      }, "SYSTEM");
    }
  }

  private cancelDecisionTasks(decisionId: string, cancelledAt: string): void {
    for (const task of this.store.listTasks(this.storeId)) {
      if (
        task.decisionId !== decisionId ||
        task.status === "COMPLETED" ||
        task.status === "CANCELLED"
      ) continue;
      this.persistTask({
        ...task,
        status: "CANCELLED",
        updatedAt: cancelledAt,
      }, "SYSTEM");
    }
  }

  private findTask(taskId: string): OperationsTask | undefined {
    return this.store.listTasks(this.storeId).find((task) => task.id === taskId);
  }

  private cancelTaskIfActive(taskId: string, cancelledAt: string): void {
    const task = this.findTask(taskId);
    if (!task || task.status === "COMPLETED" || task.status === "CANCELLED") return;
    this.persistTask({
      ...task,
      status: "CANCELLED",
      updatedAt: cancelledAt,
    }, "SYSTEM");
  }

  private persistDecision(decision: AgentDecision, source: "AGENT" | "OPERATOR" | "SYSTEM"): void {
    const event = this.store.transaction(() => {
      this.store.upsertDecision(decision);
      return this.store.appendEvent<AgentDecision>({
        storeId: decision.storeId,
        type: "decision.updated",
        correlationId: decision.incidentId,
        causationId: decision.id,
        source,
        occurredAt: decision.updatedAt,
        data: decision,
      });
    });
    this.bus.publish(event);
  }

  reconcileInterruptedWorkflows(): AgentDecision[] {
    const repaired: AgentDecision[] = [];
    for (const decision of this.store.listDecisions(this.storeId, 1_000)) {
      const hasInterruptedAction = selectedAlternative(decision).actions.some(
        (action) => action.status === "EXECUTING",
      );
      if (!hasInterruptedAction) continue;
      const now = this.clock().toISOString();
      const updated: AgentDecision = {
        ...decision,
        status: "FAILED",
        updatedAt: now,
        alternatives: decision.alternatives.map((alternative) => ({
          ...alternative,
          actions: alternative.actions.map((action) =>
            action.status === "EXECUTING"
              ? {
                  ...action,
                  status: "FAILED",
                  result: "Backend restarted during execution; manual reconciliation is required.",
                }
              : action,
          ),
        })),
      };
      this.persistDecision(updated, "SYSTEM");
      repaired.push(updated);
    }
    return repaired;
  }

  private activity(
    incident: IncidentRecord,
    role: AgentActivity["role"],
    phase: AgentActivity["phase"],
    summary: string,
    decisionId?: string,
  ): void {
    const activity: AgentActivity = {
      id: this.id(),
      storeId: incident.storeId,
      incidentId: incident.id,
      decisionId,
      role,
      phase,
      summary,
      occurredAt: this.clock().toISOString(),
    };
    const event = this.store.appendEvent<AgentActivity>({
      storeId: incident.storeId,
      type: "agent.activity",
      entityId: incident.entityId,
      correlationId: incident.id,
      causationId: decisionId,
      source: "AGENT",
      occurredAt: activity.occurredAt,
      data: activity,
    });
    this.bus.publish(event);
  }

}

function selectedAlternative(decision: AgentDecision) {
  const selected = decision.alternatives.find(
    (alternative) => alternative.id === decision.selectedAlternativeId,
  );
  if (!selected) throw new AgenticStoreConflictError("Decision has no selected alternative.");
  return selected;
}

function findAction(decision: AgentDecision, actionId: string): ActionIntent | undefined {
  return decision.alternatives
    .flatMap((alternative) => alternative.actions)
    .find((action) => action.id === actionId);
}

function isTerminalDecision(decision: AgentDecision): boolean {
  return ["VERIFIED", "SUPERSEDED", "REJECTED", "FAILED"].includes(decision.status);
}

function updateAction(
  decision: AgentDecision,
  actionId: string,
  patch: Partial<ActionIntent>,
  updatedAt: string,
): AgentDecision {
  return {
    ...decision,
    updatedAt,
    alternatives: decision.alternatives.map((alternative) => ({
      ...alternative,
      actions: alternative.actions.map((action) =>
        action.id === actionId ? { ...action, ...patch } : action,
      ),
    })),
  };
}

function specialistFor(incident: IncidentRecord): AgentActivity["role"] {
  switch (incident.kind) {
    case "COLD_CHAIN_RISK":
    case "ENERGY_ANOMALY":
    case "SENSOR_STALE":
      return "EQUIPMENT_AGENT";
    case "SHELF_GAP":
      return "INVENTORY_AGENT";
    case "QUEUE_PRESSURE":
      return "WORKFORCE_AGENT";
    case "ACCESSIBILITY_BLOCKED":
      return "CUSTOMER_EXPERIENCE_AGENT";
  }
}

export class AgenticStoreNotFoundError extends Error {}
export class AgenticStoreConflictError extends Error {}
