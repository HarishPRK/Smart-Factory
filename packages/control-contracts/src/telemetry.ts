import {
  CONTROL_SCHEMA_VERSION,
  type EquipmentState,
} from "./command";
import type { BinarySignal } from "./plc-control";

export interface MotorInterlocks {
  estopActive: boolean;
  guardOpen: boolean;
  vfdFault: boolean;
}

export interface MotorTelemetrySnapshot {
  schemaVersion: typeof CONTROL_SCHEMA_VERSION;
  equipmentId: string;
  sampledAt: string;
  sequence: number;
  state: EquipmentState;
  relayCommand: BinarySignal;
  rpm: number;
  currentAmps: number;
  temperatureC: number;
  interlocks: MotorInterlocks;
  source: "SIMULATOR" | "PLC";
}

/**
 * The board-shaped subset produced by the simulator. It can be handed to a
 * future local telemetry adapter, but this package performs no publication.
 */
export interface SimulatedBoardATelemetry {
  boardA_relay_motor: BinarySignal;
  boardA_current_pot: number;
  boardA_temperature: number;
}
