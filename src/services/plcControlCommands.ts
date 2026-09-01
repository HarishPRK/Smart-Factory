import {
  toPlcAlarmControlMessage,
  toPlcMotorControlMessage,
} from "../../packages/control-contracts/src/plc-control";

export interface PLCControlCommand extends Record<string, unknown> {
  _topic: "plc/control";
  _rawPayload:
    | { boardA_relay_motor: 0 | 1 }
    | { boardA_relay_alarm: 0 | 1 };
}

export function motorFanControlCommand(active: boolean): PLCControlCommand {
  return asTransportCommand(
    toPlcMotorControlMessage(active ? "START" : "STOP"),
  );
}

export function emergencyLightControlCommand(
  active: boolean,
): PLCControlCommand {
  return asTransportCommand(toPlcAlarmControlMessage(active));
}

function asTransportCommand(message: {
  topic: "plc/control";
  payload: PLCControlCommand["_rawPayload"];
}): PLCControlCommand {
  return {
    _topic: message.topic,
    _rawPayload: message.payload,
  };
}
