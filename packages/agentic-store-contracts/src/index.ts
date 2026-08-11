export const AGENTIC_STORE_SCHEMA_VERSION = "1.0" as const;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const DATA_QUALITIES = ["GOOD", "UNCERTAIN", "BAD", "STALE"] as const;
export type DataQuality = (typeof DATA_QUALITIES)[number];

export const ENTITY_KINDS = [
  "STORE",
  "ZONE",
  "FIXTURE",
  "EQUIPMENT",
  "SHELF",
  "CHECKOUT",
  "ENTRY",
  "BACKROOM",
  "SERVICE",
] as const;
export type TwinEntityKind = (typeof ENTITY_KINDS)[number];

export interface SpatialPose {
  x: number;
  y: number;
  z: number;
  rotationY?: number;
  width?: number;
  depth?: number;
  height?: number;
}

export interface TwinPropertyDefinition {
  key: string;
  label: string;
  valueType: "number" | "boolean" | "string";
  unit?: string;
  min?: number;
  max?: number;
  precision?: number;
  semanticType?: string;
}

export interface TwinEntityDefinition {
  id: string;
  storeId: string;
  parentId?: string;
  zoneId?: string;
  kind: TwinEntityKind;
  name: string;
  description?: string;
  sceneNodeId: string;
  spatial?: SpatialPose;
  capabilities: string[];
  properties: TwinPropertyDefinition[];
  metadata?: Record<string, JsonValue>;
}

export interface StoreManifest {
  schemaVersion: typeof AGENTIC_STORE_SCHEMA_VERSION;
  storeId: string;
  name: string;
  timezone: string;
  entities: TwinEntityDefinition[];
}

export interface SensorBinding {
  id: string;
  storeId: string;
  sourceId: string;
  tag: string;
  entityId: string;
  property: string;
  valueType: "number" | "boolean" | "string";
  unit?: string;
  scale?: number;
  offset?: number;
  min?: number;
  max?: number;
  staleAfterMs?: number;
  maxSampleAgeMs?: number;
}

export interface RawReading {
  tag: string;
  value: JsonPrimitive;
  quality?: DataQuality;
}

export interface ObservationBatch {
  schemaVersion: typeof AGENTIC_STORE_SCHEMA_VERSION;
  storeId: string;
  sourceId: string;
  sourceSessionId: string;
  sequence: number;
  sampledAt: string;
  readings: RawReading[];
}

export interface NormalizedObservation {
  observationId: string;
  storeId: string;
  sourceId: string;
  sourceSessionId: string;
  sourceSequence: number;
  bindingId: string;
  entityId: string;
  property: string;
  value: JsonPrimitive;
  unit?: string;
  quality: DataQuality;
  sampledAt: string;
  receivedAt: string;
}

export interface TwinPropertyState {
  entityId: string;
  property: string;
  value: JsonPrimitive;
  unit?: string;
  quality: DataQuality;
  sampledAt: string;
  receivedAt: string;
  sourceId: string;
  sourceSessionId: string;
  sourceSequence: number;
  version: number;
}

export interface TwinSnapshot {
  schemaVersion: typeof AGENTIC_STORE_SCHEMA_VERSION;
  storeId: string;
  version: number;
  generatedAt: string;
  properties: TwinPropertyState[];
}

export interface TwinPatchChange {
  entityId: string;
  property: string;
  value: JsonPrimitive;
  unit?: string;
  quality: DataQuality;
  sampledAt: string;
  receivedAt: string;
  sourceId: string;
}

export interface TwinPatch {
  changes: TwinPatchChange[];
}

export interface ShopperTrack {
  id: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  state: "ENTERING" | "BROWSING" | "QUEUING" | "EXITING";
  destinationZoneId?: string;
  basketItems: number;
}

export interface PresenceFrame {
  storeId: string;
  sampledAt: string;
  shoppers: ShopperTrack[];
}

export const INCIDENT_KINDS = [
  "COLD_CHAIN_RISK",
  "SHELF_GAP",
  "QUEUE_PRESSURE",
  "ENERGY_ANOMALY",
  "ACCESSIBILITY_BLOCKED",
  "SENSOR_STALE",
] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

export const INCIDENT_SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export interface EvidenceReference {
  entityId: string;
  property: string;
  sourceId?: string;
  value: JsonPrimitive;
  unit?: string;
  sampledAt: string;
  quality: DataQuality;
}

export interface IncidentRecord {
  id: string;
  storeId: string;
  kind: IncidentKind;
  severity: IncidentSeverity;
  entityId: string;
  title: string;
  summary: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  openedAt: string;
  updatedAt: string;
  resolvedAt?: string;
  evidence: EvidenceReference[];
  /** Sources of the measurements that causally satisfied the incident rule. */
  triggerSourceIds: string[];
  decisionId?: string;
  acknowledgement?: {
    actorId: string;
    occurredAt: string;
    note?: string;
  };
}

export const AGENT_ROLES = [
  "STORE_ORCHESTRATOR",
  "INVENTORY_AGENT",
  "EQUIPMENT_AGENT",
  "WORKFORCE_AGENT",
  "CUSTOMER_EXPERIENCE_AGENT",
] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export const AGENT_PHASES = [
  "OBSERVE",
  "ANALYZE",
  "COMPARE",
  "PROPOSE",
  "WAIT_FOR_APPROVAL",
  "ACT",
  "VERIFY",
  "COMPLETE",
] as const;
export type AgentPhase = (typeof AGENT_PHASES)[number];

export interface AgentActivity {
  id: string;
  storeId: string;
  incidentId: string;
  decisionId?: string;
  role: AgentRole;
  phase: AgentPhase;
  summary: string;
  occurredAt: string;
}

export const ACTION_KINDS = [
  "CREATE_TASK",
  "DISPATCH_RESTOCK",
  "REQUEST_MAINTENANCE",
  "SET_DIGITAL_AVAILABILITY",
  "OPEN_CHECKOUT_LANE",
  "CLEAR_AISLE",
  "SET_EQUIPMENT_MODE",
] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];
export type ActionRisk = "LOW" | "MEDIUM" | "HIGH";
export type ActionStatus =
  | "PROPOSED"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "VERIFIED";

export interface ActionIntent {
  id: string;
  kind: ActionKind;
  targetEntityId: string;
  summary: string;
  parameters: Record<string, JsonValue>;
  risk: ActionRisk;
  requiresApproval: boolean;
  status: ActionStatus;
  executor?: "LOCAL_WORKFLOW" | "SIMULATOR" | "EXTERNAL_ADAPTER";
  result?: string;
}

export interface DecisionAlternative {
  id: string;
  label: string;
  summary: string;
  score: number;
  benefits: string[];
  risks: string[];
  actions: ActionIntent[];
}

export type DecisionStatus =
  | "PROPOSED"
  | "WAITING_APPROVAL"
  | "EXECUTING"
  | "VERIFYING"
  | "VERIFIED"
  | "SUPERSEDED"
  | "REJECTED"
  | "FAILED";

export interface AgentDecision {
  id: string;
  storeId: string;
  incidentId: string;
  createdAt: string;
  updatedAt: string;
  status: DecisionStatus;
  headline: string;
  explanation: string;
  confidence: number;
  alternatives: DecisionAlternative[];
  selectedAlternativeId: string;
  evidence: EvidenceReference[];
  model?: {
    provider: "deterministic" | "openai-compatible";
    name: string;
  };
  approval?: {
    actorId: string;
    decision: "APPROVED" | "REJECTED";
    occurredAt: string;
    note?: string;
  };
}

export interface OperationsTask {
  id: string;
  storeId: string;
  incidentId?: string;
  decisionId?: string;
  kind: "RESTOCK" | "MAINTENANCE" | "CUSTOMER_FLOW" | "SAFETY" | "GENERAL";
  title: string;
  description: string;
  targetEntityId: string;
  priority: IncidentSeverity;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  assignedRole?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export const STORE_EVENT_TYPES = [
  "twin.patch",
  "presence.frame",
  "incident.opened",
  "incident.updated",
  "incident.resolved",
  "agent.activity",
  "decision.proposed",
  "decision.updated",
  "task.updated",
  "simulator.status",
] as const;
export type StoreEventType = (typeof STORE_EVENT_TYPES)[number];

export interface StoreEventEnvelope<T = JsonValue> {
  schemaVersion: typeof AGENTIC_STORE_SCHEMA_VERSION;
  id: string;
  sequence: number;
  storeId: string;
  type: StoreEventType;
  entityId?: string;
  correlationId?: string;
  causationId?: string;
  occurredAt: string;
  recordedAt: string;
  source: "SIMULATOR" | "PLC" | "SYSTEM" | "AGENT" | "OPERATOR";
  data: T;
}

export interface SimulatorState {
  running: boolean;
  speed: number;
  tick: number;
  sourceSessionId: string;
  activeScenario?: string;
  scenarioEndsAt?: string;
}

export interface AgenticStoreCapabilities {
  simulation: boolean;
  simulationScenarios: string[];
  externalIngest: boolean;
  replay: boolean;
  approvals: boolean;
  agentQuestion: boolean;
  mutationAuthRequired: boolean;
  localAi: boolean;
  aiProvider: "deterministic" | "openai-compatible";
}

export interface TelemetrySourceStatus {
  sourceId: string;
  kind: "SIMULATOR" | "PLC";
  status: "LIVE" | "STALE" | "WAITING" | "PAUSED";
  configuredBindings: number;
  reportingProperties: number;
  lastSeenAt?: string;
}

export interface BootstrapResponse {
  schemaVersion: typeof AGENTIC_STORE_SCHEMA_VERSION;
  serverTime: string;
  manifest: StoreManifest;
  snapshot: TwinSnapshot;
  incidents: IncidentRecord[];
  decisions: AgentDecision[];
  tasks: OperationsTask[];
  activities: AgentActivity[];
  sources: TelemetrySourceStatus[];
  simulator: SimulatorState;
  capabilities: AgenticStoreCapabilities;
  stream: {
    url: string;
    latestSequence: number;
    heartbeatSeconds: number;
  };
}

export interface EventPage {
  events: StoreEventEnvelope[];
  earliestSequence: number;
  nextSequence: number;
  hasMore: boolean;
}

export interface HistoryPoint {
  sampledAt: string;
  value: JsonPrimitive;
  quality: DataQuality;
}

export interface PropertyHistoryResponse {
  storeId: string;
  entityId: string;
  property: string;
  from: string;
  to: string;
  points: HistoryPoint[];
}

export interface IngestResponse {
  accepted: number;
  rejected: number;
  unknownTags: string[];
  staleTags: string[];
  snapshotVersion: number;
}

export interface DecisionReviewRequest {
  actorId: string;
  note?: string;
}

export interface SimulatorControlRequest {
  action: "START" | "PAUSE" | "RESET";
  speed?: number;
}

export interface ScenarioStartRequest {
  durationSeconds?: number;
}

export interface AgentQuestionRequest {
  question: string;
  entityIds?: string[];
}

export interface AgentQuestionResponse {
  answer: string;
  evidence: EvidenceReference[];
  provider: "deterministic" | "openai-compatible";
  generatedAt: string;
}

export {
  agentQuestionRequestSchema,
  decisionReviewRequestSchema,
  observationBatchSchema,
  scenarioStartRequestSchema,
  sensorBindingSchema,
  sensorBindingsSchema,
  simulatorControlRequestSchema,
} from "./schemas.js";
