import { describe, expect, it } from "vitest";
import {
  PLC_CONTROL_TOPIC,
  actionFromPlcMotorControlPayload,
  toPlcMotorControlMessage,
} from "./plc-control";

describe("verified PLC motor-control contract", () => {
  it("maps START to the allowlisted relay-on payload", () => {
    expect(toPlcMotorControlMessage("START")).toEqual({
      topic: PLC_CONTROL_TOPIC,
      payload: { boardA_relay_motor: 1 },
    });
  });

  it("maps STOP to the allowlisted relay-off payload", () => {
    expect(toPlcMotorControlMessage("STOP")).toEqual({
      topic: PLC_CONTROL_TOPIC,
      payload: { boardA_relay_motor: 0 },
    });
  });

  it("decodes only exact binary relay payloads", () => {
    expect(
      actionFromPlcMotorControlPayload({ boardA_relay_motor: 1 }),
    ).toBe("START");
    expect(
      actionFromPlcMotorControlPayload({ boardA_relay_motor: 0 }),
    ).toBe("STOP");
    expect(
      actionFromPlcMotorControlPayload({ boardA_relay_motor: true }),
    ).toBeNull();
    expect(
      actionFromPlcMotorControlPayload({
        boardA_relay_motor: 1,
        boardA_relay_alarm: 1,
      }),
    ).toBeNull();
  });
});
