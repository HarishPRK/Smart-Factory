import type { MotorAction } from "./command";

export const PLC_CONTROL_TOPIC = "plc/control" as const;
export const PLC_MOTOR_RELAY_FIELD = "boardA_relay_motor" as const;

export type BinarySignal = 0 | 1;

export interface PlcMotorControlPayload {
  boardA_relay_motor: BinarySignal;
}

export interface PlcMotorControlMessage {
  topic: typeof PLC_CONTROL_TOPIC;
  payload: PlcMotorControlPayload;
}

/**
 * This is the only shared mapping between logical motor actions and the
 * verified local PLC contract. Client applications must send MotorAction,
 * never MQTT topics or raw payload fields.
 */
export function toPlcMotorControlMessage(
  action: MotorAction,
): PlcMotorControlMessage {
  return {
    topic: PLC_CONTROL_TOPIC,
    payload: {
      boardA_relay_motor: action === "START" ? 1 : 0,
    },
  };
}

/**
 * Strictly decodes the allowlisted local payload. Extra keys are rejected so a
 * future edge adapter cannot accidentally forward arbitrary PLC writes.
 */
export function actionFromPlcMotorControlPayload(
  payload: unknown,
): MotorAction | null {
  if (!isPlainObject(payload)) return null;

  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== PLC_MOTOR_RELAY_FIELD) return null;

  const relayValue = payload[PLC_MOTOR_RELAY_FIELD];
  if (relayValue === 1) return "START";
  if (relayValue === 0) return "STOP";
  return null;
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
