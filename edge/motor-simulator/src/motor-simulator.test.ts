import { describe, expect, it } from "vitest";
import {
  PLC_CONTROL_TOPIC,
  toPlcMotorControlMessage,
} from "../../../packages/control-contracts/src/index";
import { MotorSimulator } from "./motor-simulator";

const FIXED_TIME = "2026-07-28T12:00:00.000Z";

describe("MotorSimulator", () => {
  it("runs a complete deterministic START then STOP cycle", () => {
    const simulator = new MotorSimulator({
      startDurationMs: 1_000,
      stopDurationMs: 500,
    });

    const startMessage = toPlcMotorControlMessage("START");
    const startResult = simulator.receiveLocalMessage(
      startMessage.topic,
      startMessage.payload,
    );

    expect(startResult).toMatchObject({
      accepted: true,
      motorResult: { action: "START", state: "STARTING", changed: true },
    });
    expect(simulator.motor.boardATelemetry().boardA_relay_motor).toBe(1);

    simulator.motor.advance(1_000);
    expect(simulator.motor.snapshot(FIXED_TIME)).toMatchObject({
      state: "RUNNING",
      relayCommand: 1,
      rpm: 1_750,
      source: "SIMULATOR",
    });

    const stopMessage = toPlcMotorControlMessage("STOP");
    const stopResult = simulator.receiveLocalMessage(
      stopMessage.topic,
      stopMessage.payload,
    );
    expect(stopResult).toMatchObject({
      accepted: true,
      motorResult: { action: "STOP", state: "STOPPING", changed: true },
    });
    expect(simulator.motor.boardATelemetry().boardA_relay_motor).toBe(0);

    simulator.motor.advance(500);
    expect(simulator.motor.snapshot(FIXED_TIME)).toMatchObject({
      state: "STOPPED",
      relayCommand: 0,
      rpm: 0,
      currentAmps: 0,
    });
  });

  it("rejects START when an interlock is active but still accepts STOP", () => {
    const simulator = new MotorSimulator();
    simulator.motor.setInterlocks({ estopActive: true });

    expect(
      simulator.receiveLocalMessage(PLC_CONTROL_TOPIC, {
        boardA_relay_motor: 1,
      }),
    ).toMatchObject({
      accepted: false,
      reasonCode: "ESTOP_ACTIVE",
    });
    expect(simulator.motor.snapshot(FIXED_TIME).state).toBe("STOPPED");

    expect(
      simulator.receiveLocalMessage(PLC_CONTROL_TOPIC, {
        boardA_relay_motor: 0,
      }),
    ).toMatchObject({
      accepted: true,
      reasonCode: "DUPLICATE",
    });
  });

  it("rejects non-allowlisted topics and payload fields without changing state", () => {
    const simulator = new MotorSimulator();

    expect(
      simulator.receiveLocalMessage("plc/other", {
        boardA_relay_motor: 1,
      }),
    ).toEqual({
      accepted: false,
      reasonCode: "INVALID_TOPIC",
    });
    expect(
      simulator.receiveLocalMessage(PLC_CONTROL_TOPIC, {
        boardA_relay_motor: 1,
        boardA_relay_alarm: 1,
      }),
    ).toEqual({
      accepted: false,
      reasonCode: "INVALID_PAYLOAD",
    });
    expect(simulator.motor.snapshot(FIXED_TIME).state).toBe("STOPPED");
  });

  it("treats repeated START as idempotent", () => {
    const simulator = new MotorSimulator();
    const message = toPlcMotorControlMessage("START");

    simulator.receiveLocalMessage(message.topic, message.payload);
    const duplicate = simulator.receiveLocalMessage(
      message.topic,
      message.payload,
    );

    expect(duplicate).toMatchObject({
      accepted: true,
      reasonCode: "DUPLICATE",
      motorResult: { changed: false, state: "STARTING" },
    });
  });

  it("forces a running motor to a safe fault state on E-stop", () => {
    const simulator = new MotorSimulator({ startDurationMs: 100 });
    const message = toPlcMotorControlMessage("START");
    simulator.receiveLocalMessage(message.topic, message.payload);
    simulator.motor.advance(100);

    simulator.motor.setInterlocks({ estopActive: true });

    expect(simulator.motor.snapshot(FIXED_TIME)).toMatchObject({
      state: "FAULTED",
      relayCommand: 0,
      rpm: 0,
      currentAmps: 0,
      interlocks: { estopActive: true },
    });
  });
});
