// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import type {
  IncidentRecord,
  OperationsTask,
} from "../../../packages/agentic-store-contracts/src/index.js";
import { planDecision } from "../domain/decision-planner.js";
import { SqliteAgenticStore } from "../infrastructure/sqlite-store.js";
import { StoreEventBus } from "../infrastructure/store-event-bus.js";
import { AgentOrchestrator, type ActionExecutionResult } from "./agent-orchestrator.js";
import { DeterministicAgentProvider } from "./agent-provider.js";

const STORE_ID = "store-orchestrator-test";
const NOW = "2026-08-10T12:00:00.000Z";

function incident(): IncidentRecord {
  return {
    id: "incident-accessibility",
    storeId: STORE_ID,
    kind: "ACCESSIBILITY_BLOCKED",
    severity: "HIGH",
    entityId: "aisle-03",
    title: "Accessible aisle blocked",
    summary: "The measured clear route is below the accessibility envelope.",
    status: "OPEN",
    openedAt: NOW,
    updatedAt: NOW,
    triggerSourceIds: [`simulator:${STORE_ID}`],
    evidence: [{
      entityId: "aisle-03",
      property: "accessibility.clearanceM",
      sourceId: `simulator:${STORE_ID}`,
      value: 0.5,
      unit: "m",
      sampledAt: NOW,
      quality: "GOOD",
    }],
  };
}

describe("AgentOrchestrator concurrency", () => {
  const stores: SqliteAgenticStore[] = [];

  afterEach(() => {
    for (const store of stores.splice(0)) store.close();
  });

  it("does not let a late action acknowledgement resurrect a reset workflow", async () => {
    const store = new SqliteAgenticStore(":memory:");
    stores.push(store);
    const bus = new StoreEventBus();
    const opened = incident();
    store.upsertIncident(opened);

    let releaseAction!: (result: ActionExecutionResult) => void;
    let markStarted!: () => void;
    const actionStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const actionResult = new Promise<ActionExecutionResult>((resolve) => {
      releaseAction = resolve;
    });
    const orchestrator = new AgentOrchestrator(
      STORE_ID,
      store,
      bus,
      new DeterministicAgentProvider(),
      {
        applyAction: () => {
          markStarted();
          return actionResult;
        },
      },
      () => new Date(NOW),
    );

    const work = orchestrator.handleIncidentOpened(opened);
    await actionStarted;
    const plannedIncident = store.getIncident(opened.id)!;
    const resolved: IncidentRecord = {
      ...plannedIncident,
      status: "RESOLVED",
      updatedAt: NOW,
      resolvedAt: NOW,
    };
    store.upsertIncident(resolved);
    orchestrator.handleIncidentSuperseded(resolved, "the simulator was reset");

    releaseAction({
      accepted: true,
      message: "Late simulator acknowledgement",
      executor: "SIMULATOR",
    });
    await work;

    const decision = store.getDecision(plannedIncident.decisionId!)!;
    expect(decision.status).toBe("SUPERSEDED");
    expect(decision.alternatives.flatMap((alternative) => alternative.actions)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "CANCELLED",
          result: expect.stringContaining("simulator was reset"),
        }),
      ]),
    );
    expect(store.listTasks(STORE_ID).every((task) => task.status === "CANCELLED"))
      .toBe(true);
  });

  it("supersedes unfinished selected work when evidence recovers during an action", async () => {
    const store = new SqliteAgenticStore(":memory:");
    stores.push(store);
    const opened = incident();
    store.upsertIncident(opened);
    let releaseAction!: (result: ActionExecutionResult) => void;
    let markStarted!: () => void;
    const actionStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const actionResult = new Promise<ActionExecutionResult>((resolve) => {
      releaseAction = resolve;
    });
    const orchestrator = new AgentOrchestrator(
      STORE_ID,
      store,
      new StoreEventBus(),
      new DeterministicAgentProvider(),
      {
        applyAction: () => {
          markStarted();
          return actionResult;
        },
      },
      () => new Date(NOW),
    );

    const work = orchestrator.handleIncidentOpened(opened);
    await actionStarted;
    const plannedIncident = store.getIncident(opened.id)!;
    const resolved: IncidentRecord = {
      ...plannedIncident,
      status: "RESOLVED",
      updatedAt: NOW,
      resolvedAt: NOW,
    };
    store.upsertIncident(resolved);
    expect(orchestrator.handleIncidentResolved(resolved)?.alternatives
      .flatMap((alternative) => alternative.actions))
      .toEqual(expect.arrayContaining([expect.objectContaining({ status: "EXECUTING" })]));

    releaseAction({
      accepted: true,
      message: "Action acknowledged after measured recovery",
      executor: "SIMULATOR",
    });
    await work;

    const decision = store.getDecision(plannedIncident.decisionId!)!;
    const selected = decision.alternatives.find(
      (alternative) => alternative.id === decision.selectedAlternativeId,
    )!;
    expect(decision.status).toBe("SUPERSEDED");
    expect(selected.actions.some((action) =>
      ["PROPOSED", "WAITING_APPROVAL", "APPROVED", "EXECUTING"].includes(action.status),
    )).toBe(false);
    expect(store.listTasks(STORE_ID).every((task) => task.status === "CANCELLED"))
      .toBe(true);
  });

  it("cancels active tasks for an unsuccessful terminal decision on recovery or reset", () => {
    const store = new SqliteAgenticStore(":memory:");
    stores.push(store);
    const bus = new StoreEventBus();
    const opened = incident();
    const planned = planDecision(opened, {
      explanation: "Deterministic test plan.",
      confidence: 0.9,
      provider: "deterministic",
      model: "test",
    }, NOW);
    const failed = { ...planned, status: "FAILED" as const };
    const resolved = {
      ...opened,
      decisionId: failed.id,
      status: "RESOLVED" as const,
      resolvedAt: NOW,
    };
    const task: OperationsTask = {
      id: "still-open-task",
      storeId: STORE_ID,
      incidentId: opened.id,
      decisionId: failed.id,
      kind: "SAFETY",
      title: "Clear aisle",
      description: "Unfinished work from the failed decision.",
      targetEntityId: "aisle-03",
      priority: "HIGH",
      status: "OPEN",
      createdAt: NOW,
      updatedAt: NOW,
    };
    store.upsertIncident(resolved);
    store.upsertDecision(failed);
    store.upsertTask(task);
    const orchestrator = new AgentOrchestrator(
      STORE_ID,
      store,
      bus,
      new DeterministicAgentProvider(),
      { applyAction: () => ({ accepted: true, message: "unused", executor: "SIMULATOR" }) },
      () => new Date(NOW),
    );

    expect(orchestrator.handleIncidentResolved(resolved))
      .toMatchObject({ status: "FAILED" });
    expect(store.listTasks(STORE_ID)).toEqual([
      expect.objectContaining({ id: task.id, status: "CANCELLED" }),
    ]);

    store.upsertTask(task);
    expect(orchestrator.handleIncidentSuperseded(resolved, "the simulator was reset"))
      .toMatchObject({ status: "FAILED" });
    expect(store.listTasks(STORE_ID)).toEqual([
      expect.objectContaining({ id: task.id, status: "CANCELLED" }),
    ]);
  });
});
