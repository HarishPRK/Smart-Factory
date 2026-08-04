import {
  PLC_CONTROL_TOPIC,
  actionFromPlcMotorControlPayload,
  type CommandReasonCode,
} from "../../../packages/control-contracts/src/index";
import {
  MotorModel,
  type MotorActionResult,
  type MotorModelOptions,
} from "./motor-model";

export interface LocalMessageResult {
  accepted: boolean;
  reasonCode?: CommandReasonCode;
  motorResult?: MotorActionResult;
}

/**
 * A network-free adapter for the verified local MQTT message shape.
 *
 * It does not create a broker connection. Tests and local backend code must
 * pass messages into receiveLocalMessage explicitly.
 */
export class MotorSimulator {
  readonly motor: MotorModel;

  constructor(options: Partial<MotorModelOptions> = {}) {
    this.motor = new MotorModel(options);
  }

  receiveLocalMessage(topic: string, payload: unknown): LocalMessageResult {
    if (topic !== PLC_CONTROL_TOPIC) {
      return { accepted: false, reasonCode: "INVALID_TOPIC" };
    }

    const action = actionFromPlcMotorControlPayload(payload);
    if (!action) {
      return { accepted: false, reasonCode: "INVALID_PAYLOAD" };
    }

    const motorResult = this.motor.applyAction(action);
    return {
      accepted: motorResult.accepted,
      reasonCode: motorResult.reasonCode,
      motorResult,
    };
  }
}
