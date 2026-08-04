export const CONTROL_SCHEMA_VERSION = "1.0" as const;

export const MOTOR_ACTIONS = ["START", "STOP"] as const;
export type MotorAction = (typeof MOTOR_ACTIONS)[number];

export const EQUIPMENT_STATES = [
  "STOPPED",
  "STARTING",
  "RUNNING",
  "STOPPING",
  "FAULTED",
] as const;
export type EquipmentState = (typeof EQUIPMENT_STATES)[number];

export const COMMAND_STATES = [
  "REQUESTED",
  "DISPATCHED",
  "ACCEPTED",
  "EXECUTING",
  "SUCCEEDED",
  "REJECTED",
  "FAILED",
  "TIMED_OUT",
] as const;
export type CommandState = (typeof COMMAND_STATES)[number];

export const TERMINAL_COMMAND_STATES = [
  "SUCCEEDED",
  "REJECTED",
  "FAILED",
  "TIMED_OUT",
] as const satisfies readonly CommandState[];

export type CommandReasonCode =
  | "BUSY"
  | "COMMAND_EXPIRED"
  | "DUPLICATE"
  | "ESTOP_ACTIVE"
  | "GUARD_OPEN"
  | "INVALID_ACTION"
  | "INVALID_PAYLOAD"
  | "INVALID_TOPIC"
  | "REMOTE_CONTROL_DISABLED"
  | "STATE_CONFLICT"
  | "TELEMETRY_STALE"
  | "VFD_FAULT";

export interface ClientCommandRequest {
  action: MotorAction;
  idempotencyKey: string;
  expectedState: Extract<EquipmentState, "STOPPED" | "RUNNING">;
}

export interface TrustedCommandEnvelope {
  schemaVersion: typeof CONTROL_SCHEMA_VERSION;
  commandId: string;
  equipmentId: string;
  siteId: string;
  action: MotorAction;
  actorSub: string;
  issuedAt: string;
  expiresAt: string;
  expectedState: ClientCommandRequest["expectedState"];
}

export interface CommandResult {
  schemaVersion: typeof CONTROL_SCHEMA_VERSION;
  commandId: string;
  equipmentId: string;
  state: CommandState;
  observedEquipmentState?: EquipmentState;
  reasonCode?: CommandReasonCode;
  occurredAt: string;
}

export function isMotorAction(value: unknown): value is MotorAction {
  return value === "START" || value === "STOP";
}

export function isTerminalCommandState(
  state: CommandState,
): state is (typeof TERMINAL_COMMAND_STATES)[number] {
  return TERMINAL_COMMAND_STATES.includes(
    state as (typeof TERMINAL_COMMAND_STATES)[number],
  );
}
