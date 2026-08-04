import {
  CONTROL_SCHEMA_VERSION,
  type CommandReasonCode,
  type EquipmentState,
  type MotorAction,
  type MotorInterlocks,
  type MotorTelemetrySnapshot,
  type SimulatedBoardATelemetry,
} from "../../../packages/control-contracts/src/index";

export interface MotorModelOptions {
  equipmentId: string;
  startDurationMs: number;
  stopDurationMs: number;
  nominalRpm: number;
  nominalCurrentAmps: number;
  ambientTemperatureC: number;
}

export interface MotorActionResult {
  accepted: boolean;
  action: MotorAction;
  state: EquipmentState;
  changed: boolean;
  reasonCode?: CommandReasonCode;
}

const DEFAULT_OPTIONS: MotorModelOptions = {
  equipmentId: "MOTOR-01",
  startDurationMs: 2_000,
  stopDurationMs: 1_500,
  nominalRpm: 1_750,
  nominalCurrentAmps: 8.4,
  ambientTemperatureC: 24,
};

const CLEAR_INTERLOCKS: MotorInterlocks = {
  estopActive: false,
  guardOpen: false,
  vfdFault: false,
};

export class MotorModel {
  private readonly options: MotorModelOptions;
  private state: EquipmentState = "STOPPED";
  private relayCommand: 0 | 1 = 0;
  private transitionElapsedMs = 0;
  private rpm = 0;
  private currentAmps = 0;
  private temperatureC: number;
  private sequence = 0;
  private interlocks: MotorInterlocks = { ...CLEAR_INTERLOCKS };

  constructor(options: Partial<MotorModelOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.temperatureC = this.options.ambientTemperatureC;

    assertPositive("startDurationMs", this.options.startDurationMs);
    assertPositive("stopDurationMs", this.options.stopDurationMs);
    assertPositive("nominalRpm", this.options.nominalRpm);
    assertPositive("nominalCurrentAmps", this.options.nominalCurrentAmps);
  }

  applyAction(action: MotorAction): MotorActionResult {
    if (action === "START") return this.start();
    return this.stop();
  }

  setInterlocks(update: Partial<MotorInterlocks>): void {
    this.interlocks = { ...this.interlocks, ...update };

    if (
      (this.interlocks.estopActive || this.interlocks.vfdFault) &&
      (this.state === "STARTING" || this.state === "RUNNING")
    ) {
      this.relayCommand = 0;
      this.state = "FAULTED";
      this.transitionElapsedMs = 0;
      this.rpm = 0;
      this.currentAmps = 0;
    }

    if (
      this.state === "FAULTED" &&
      !this.interlocks.estopActive &&
      !this.interlocks.vfdFault
    ) {
      this.state = "STOPPED";
    }
  }

  advance(elapsedMs: number): void {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      throw new RangeError("elapsedMs must be a finite, non-negative number");
    }
    if (elapsedMs === 0) return;

    if (this.state === "STARTING") {
      this.transitionElapsedMs += elapsedMs;
      const progress = Math.min(
        this.transitionElapsedMs / this.options.startDurationMs,
        1,
      );
      this.rpm = round(this.options.nominalRpm * progress);
      this.currentAmps = round(
        this.options.nominalCurrentAmps * (1.5 - 0.5 * progress),
      );
      this.temperatureC = round(
        this.options.ambientTemperatureC + 4 * progress,
      );

      if (progress === 1) {
        this.state = "RUNNING";
        this.transitionElapsedMs = 0;
        this.rpm = this.options.nominalRpm;
        this.currentAmps = this.options.nominalCurrentAmps;
      }
      return;
    }

    if (this.state === "STOPPING") {
      this.transitionElapsedMs += elapsedMs;
      const progress = Math.min(
        this.transitionElapsedMs / this.options.stopDurationMs,
        1,
      );
      this.rpm = round(this.options.nominalRpm * (1 - progress));
      this.currentAmps = round(
        this.options.nominalCurrentAmps * (1 - progress),
      );
      this.temperatureC = round(
        Math.max(
          this.options.ambientTemperatureC,
          this.temperatureC - 2 * progress,
        ),
      );

      if (progress === 1) {
        this.state = "STOPPED";
        this.transitionElapsedMs = 0;
        this.rpm = 0;
        this.currentAmps = 0;
      }
      return;
    }

    if (this.state === "RUNNING") {
      this.temperatureC = round(
        Math.min(this.temperatureC + elapsedMs / 60_000, 72),
      );
      return;
    }

    if (this.state === "STOPPED") {
      this.temperatureC = round(
        Math.max(
          this.options.ambientTemperatureC,
          this.temperatureC - elapsedMs / 30_000,
        ),
      );
    }
  }

  snapshot(sampledAt = new Date().toISOString()): MotorTelemetrySnapshot {
    return {
      schemaVersion: CONTROL_SCHEMA_VERSION,
      equipmentId: this.options.equipmentId,
      sampledAt,
      sequence: ++this.sequence,
      state: this.state,
      relayCommand: this.relayCommand,
      rpm: this.rpm,
      currentAmps: this.currentAmps,
      temperatureC: this.temperatureC,
      interlocks: { ...this.interlocks },
      source: "SIMULATOR",
    };
  }

  boardATelemetry(): SimulatedBoardATelemetry {
    return {
      boardA_relay_motor: this.relayCommand,
      boardA_current_pot: this.currentAmps,
      boardA_temperature: this.temperatureC,
    };
  }

  private start(): MotorActionResult {
    const rejection = this.startRejection();
    if (rejection) {
      return {
        accepted: false,
        action: "START",
        state: this.state,
        changed: false,
        reasonCode: rejection,
      };
    }

    if (this.state === "STARTING" || this.state === "RUNNING") {
      return {
        accepted: true,
        action: "START",
        state: this.state,
        changed: false,
        reasonCode: "DUPLICATE",
      };
    }

    if (this.state === "STOPPING") {
      return {
        accepted: false,
        action: "START",
        state: this.state,
        changed: false,
        reasonCode: "BUSY",
      };
    }

    this.relayCommand = 1;
    this.state = "STARTING";
    this.transitionElapsedMs = 0;

    return {
      accepted: true,
      action: "START",
      state: this.state,
      changed: true,
    };
  }

  private stop(): MotorActionResult {
    if (this.state === "STOPPED" || this.state === "STOPPING") {
      this.relayCommand = 0;
      return {
        accepted: true,
        action: "STOP",
        state: this.state,
        changed: false,
        reasonCode: "DUPLICATE",
      };
    }

    if (this.state === "FAULTED") {
      this.relayCommand = 0;
      return {
        accepted: true,
        action: "STOP",
        state: this.state,
        changed: false,
      };
    }

    this.relayCommand = 0;
    this.state = "STOPPING";
    this.transitionElapsedMs = 0;

    return {
      accepted: true,
      action: "STOP",
      state: this.state,
      changed: true,
    };
  }

  private startRejection(): CommandReasonCode | null {
    if (this.interlocks.estopActive) return "ESTOP_ACTIVE";
    if (this.interlocks.guardOpen) return "GUARD_OPEN";
    if (this.interlocks.vfdFault || this.state === "FAULTED") {
      return "VFD_FAULT";
    }
    return null;
  }
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than zero`);
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
