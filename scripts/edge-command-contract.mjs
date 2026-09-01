/**
 * Pure validation for the AWS IoT -> factory PLC command boundary.
 *
 * Keep this module free of broker clients and startup side effects so tests and
 * builds can exercise the command contract without opening a network socket.
 */

export const EDGE_COMMAND_TOPIC = "plc/control";
export const EDGE_COMMAND_MAX_BYTES = 256;
export const EDGE_COMMAND_RELAY_FIELDS = Object.freeze([
  "boardA_relay_motor",
  "boardA_relay_alarm",
]);

const relayFields = new Set(EDGE_COMMAND_RELAY_FIELDS);
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const utf8Encoder = new TextEncoder();

/**
 * Select the AWS command transport without exposing either Greengrass IPC
 * credential. Partial IPC configuration fails closed instead of silently
 * falling back to standalone AWS credentials.
 */
export function selectEdgeCommandTransport(environment) {
  const hasSocket = hasEnvironmentValue(
    environment?.AWS_GG_NUCLEUS_DOMAIN_SOCKET_FILEPATH_FOR_COMPONENT,
  );
  const hasServiceToken = hasEnvironmentValue(environment?.SVCUID);

  if (hasSocket !== hasServiceToken) {
    throw new Error(
      "Greengrass IPC requires both the nucleus domain socket and SVCUID",
    );
  }
  return hasSocket ? "greengrass-ipc" : "sigv4-websocket";
}

/**
 * Validate an AWS MQTT publish and return a canonical local PLC command.
 * Only the exact topic, one relay field, and a numeric 0 or 1 are accepted.
 */
export function validateEdgeCommandFrame({ topic, payload, retain }) {
  const payloadBytes = byteLength(payload);

  if (retain === true) {
    return reject("RETAINED_MESSAGE", payloadBytes);
  }
  if (retain !== false) {
    return reject("RETAIN_FLAG_INVALID", payloadBytes);
  }
  if (topic !== EDGE_COMMAND_TOPIC) {
    return reject("TOPIC_NOT_ALLOWED", payloadBytes);
  }
  if (payloadBytes === null) {
    return reject("PAYLOAD_TYPE_NOT_ALLOWED", null);
  }
  if (payloadBytes > EDGE_COMMAND_MAX_BYTES) {
    return reject("PAYLOAD_TOO_LARGE", payloadBytes);
  }

  let decoded;
  try {
    decoded = decodeUtf8(payload);
  } catch {
    return reject("PAYLOAD_NOT_UTF8", payloadBytes);
  }

  let command;
  try {
    command = JSON.parse(decoded);
  } catch {
    return reject("PAYLOAD_NOT_JSON", payloadBytes);
  }

  if (!isPlainObject(command)) {
    return reject("PAYLOAD_NOT_OBJECT", payloadBytes);
  }

  const keys = Object.keys(command);
  if (keys.length !== 1) {
    return reject("RELAY_FIELD_COUNT", payloadBytes);
  }

  const field = keys[0];
  if (!relayFields.has(field)) {
    return reject("RELAY_FIELD_NOT_ALLOWED", payloadBytes);
  }

  const value = command[field];
  if (typeof value !== "number" || (value !== 0 && value !== 1)) {
    return reject("RELAY_VALUE_NOT_ALLOWED", payloadBytes, { field });
  }

  return {
    ok: true,
    topic: EDGE_COMMAND_TOPIC,
    payload: JSON.stringify({ [field]: value }),
    field,
    value,
    action: value === 1 ? "ON" : "OFF",
    payloadBytes,
  };
}

function reject(reason, payloadBytes, details = {}) {
  return { ok: false, reason, payloadBytes, ...details };
}

function byteLength(payload) {
  if (typeof payload === "string") return utf8Encoder.encode(payload).byteLength;
  if (isArrayBuffer(payload)) return payload.byteLength;
  if (ArrayBuffer.isView(payload)) return payload.byteLength;
  return null;
}

function decodeUtf8(payload) {
  if (typeof payload === "string") return payload;
  if (isArrayBuffer(payload)) {
    return utf8Decoder.decode(new Uint8Array(payload));
  }
  if (ArrayBuffer.isView(payload)) {
    return utf8Decoder.decode(
      new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength),
    );
  }
  throw new TypeError("Unsupported payload type");
}

function isArrayBuffer(value) {
  return (
    value instanceof ArrayBuffer ||
    Object.prototype.toString.call(value) === "[object ArrayBuffer]"
  );
}

function isPlainObject(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasEnvironmentValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}
