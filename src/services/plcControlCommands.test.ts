import { describe, expect, it } from "vitest";
import {
  emergencyLightControlCommand,
  motorFanControlCommand,
} from "./plcControlCommands";

describe("dashboard PLC control commands", () => {
  it("publishes motor state on plc/control", () => {
    expect(motorFanControlCommand(true)).toEqual({
      _topic: "plc/control",
      _rawPayload: { boardA_relay_motor: 1 },
    });
    expect(motorFanControlCommand(false)).toEqual({
      _topic: "plc/control",
      _rawPayload: { boardA_relay_motor: 0 },
    });
  });

  it("publishes emergency beacon state on plc/control", () => {
    expect(emergencyLightControlCommand(true)).toEqual({
      _topic: "plc/control",
      _rawPayload: { boardA_relay_alarm: 1 },
    });
    expect(emergencyLightControlCommand(false)).toEqual({
      _topic: "plc/control",
      _rawPayload: { boardA_relay_alarm: 0 },
    });
  });
});
