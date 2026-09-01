import { describe, expect, it } from "vitest";
import {
  EDGE_COMMAND_MAX_BYTES,
  EDGE_COMMAND_TOPIC,
  selectEdgeCommandTransport,
  validateEdgeCommandFrame,
} from "./edge-command-contract.mjs";

function validate(
  payload: string | Uint8Array | ArrayBuffer,
  overrides: { topic?: string; retain?: boolean } = {},
) {
  return validateEdgeCommandFrame({
    topic: overrides.topic ?? EDGE_COMMAND_TOPIC,
    payload,
    retain: overrides.retain ?? false,
  });
}

describe("factory edge command contract", () => {
  it("selects Greengrass IPC only when both injected credentials exist", () => {
    expect(
      selectEdgeCommandTransport({
        AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT: "/gg/ipc.socket",
        SVCUID: "opaque-service-token",
      }),
    ).toBe("greengrass-ipc");
    expect(selectEdgeCommandTransport({})).toBe("sigv4-websocket");
  });

  it.each([
    {
      AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT: "/gg/ipc.socket",
    },
    { SVCUID: "opaque-service-token" },
  ])("rejects partial Greengrass IPC configuration", (environment) => {
    expect(() => selectEdgeCommandTransport(environment)).toThrow(
      "Greengrass IPC requires both",
    );
  });

  it.each([
    ["boardA_relay_motor", 0],
    ["boardA_relay_motor", 1],
    ["boardA_relay_alarm", 0],
    ["boardA_relay_alarm", 1],
  ] as const)("accepts the absolute %s=%i command", (field, value) => {
    const result = validate(JSON.stringify({ [field]: value }));

    expect(result).toEqual({
      ok: true,
      topic: "plc/control",
      payload: JSON.stringify({ [field]: value }),
      field,
      value,
      action: value === 1 ? "ON" : "OFF",
      payloadBytes: JSON.stringify({ [field]: value }).length,
    });
  });

  it("accepts AWS ArrayBuffer data and emits one canonical JSON object", () => {
    const bytes = new TextEncoder().encode(
      ' { "boardA_relay_motor" : 1 } ',
    );
    const payload = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );

    expect(validate(payload)).toMatchObject({
      ok: true,
      topic: "plc/control",
      payload: '{"boardA_relay_motor":1}',
      field: "boardA_relay_motor",
      value: 1,
    });
  });

  it("is idempotent for duplicate absolute commands", () => {
    const frame = '{"boardA_relay_alarm":0}';

    expect(validate(frame)).toEqual(validate(frame));
  });

  it("rejects retained frames even when their topic and payload are valid", () => {
    expect(
      validate('{"boardA_relay_motor":0}', { retain: true }),
    ).toMatchObject({ ok: false, reason: "RETAINED_MESSAGE" });
  });

  it("fails closed when retained-message metadata is unavailable", () => {
    expect(
      validateEdgeCommandFrame({
        topic: EDGE_COMMAND_TOPIC,
        payload: '{"boardA_relay_motor":0}',
        retain: undefined,
      }),
    ).toMatchObject({ ok: false, reason: "RETAIN_FLAG_INVALID" });
  });

  it.each([
    "plc/cmd",
    "plc/control/extra",
    "plc/#",
    " plc/control",
    "PLC/control",
  ])("rejects the non-exact topic %s", (topic) => {
    expect(
      validate('{"boardA_relay_motor":0}', { topic }),
    ).toMatchObject({ ok: false, reason: "TOPIC_NOT_ALLOWED" });
  });

  it.each([
    ["{}", "RELAY_FIELD_COUNT"],
    [
      '{"boardA_relay_motor":1,"boardA_relay_alarm":0}',
      "RELAY_FIELD_COUNT",
    ],
    ['{"boardA_relay_unknown":1}', "RELAY_FIELD_NOT_ALLOWED"],
    ['{"boardA_relay_motor":true}', "RELAY_VALUE_NOT_ALLOWED"],
    ['{"boardA_relay_motor":"1"}', "RELAY_VALUE_NOT_ALLOWED"],
    ['{"boardA_relay_motor":2}', "RELAY_VALUE_NOT_ALLOWED"],
    ['{"boardA_relay_motor":-1}', "RELAY_VALUE_NOT_ALLOWED"],
    ['{"boardA_relay_motor":null}', "RELAY_VALUE_NOT_ALLOWED"],
    ["[]", "PAYLOAD_NOT_OBJECT"],
    ["null", "PAYLOAD_NOT_OBJECT"],
    ["1", "PAYLOAD_NOT_OBJECT"],
    ["not-json", "PAYLOAD_NOT_JSON"],
  ])("rejects invalid payload %s", (payload, reason) => {
    expect(validate(payload)).toMatchObject({ ok: false, reason });
  });

  it("rejects non-UTF-8 and oversized payloads", () => {
    expect(validate(new Uint8Array([0xc3, 0x28]))).toMatchObject({
      ok: false,
      reason: "PAYLOAD_NOT_UTF8",
    });
    expect(validate("x".repeat(EDGE_COMMAND_MAX_BYTES + 1))).toMatchObject({
      ok: false,
      reason: "PAYLOAD_TOO_LARGE",
    });
  });

  it("rejects unsupported payload container types", () => {
    expect(
      validateEdgeCommandFrame({
        topic: EDGE_COMMAND_TOPIC,
        payload: { boardA_relay_motor: 1 },
        retain: false,
      }),
    ).toMatchObject({ ok: false, reason: "PAYLOAD_TYPE_NOT_ALLOWED" });
  });
});
