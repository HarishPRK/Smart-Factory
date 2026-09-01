export const PLC_CONTROL_TOPIC = "plc/control";
export const PLC_COMMAND_TOPIC = "plc/cmd";

const PLC_CONTROL_FIELDS = new Set([
  "boardA_relay_motor",
  "boardA_relay_alarm",
]);
const LOCAL_TOGGLE_DEVICES = new Set(["photoE", "metal"]);
const RFID_AUTHORIZATION_FIELDS = [
  "boardA_rfid_authorized_user",
  "rfid_authorized_user",
  "rfid_authorized",
  "rfid_authorised",
  "rfidAuthorized",
  "rfid",
  "authorized",
  "badge",
];
const EMERGENCY_STOP_FIELDS = [
  "boardB_io_push_lock_button",
  "boardA_push_lock_button",
  "push_lock_button",
  "system_in_emergency_stop_state",
  "system_emergency_stop",
];
const LATCHED_EMERGENCY_STOP_FIELD = "system_was_in_emergency_stop_state";

/**
 * Parse and strictly allowlist a browser-to-broker command frame. This keeps
 * the public WebSocket from becoming an arbitrary MQTT publisher.
 */
export function parseBrowserPublish(data, { allowLegacyCommand = false } = {}) {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch {
    return { ok: false, requestId: null, error: "Invalid command JSON" };
  }

  const requestId =
    typeof message?.requestId === "string" ? message.requestId : null;

  if (!isPlainObject(message)) {
    return { ok: false, requestId, error: "Command frame must be an object" };
  }
  if (message.type !== undefined && message.type !== "publish") {
    return { ok: false, requestId, error: "Unsupported bridge message type" };
  }

  const topic = message.topic ?? PLC_COMMAND_TOPIC;
  if (topic !== PLC_CONTROL_TOPIC && topic !== PLC_COMMAND_TOPIC) {
    return { ok: false, requestId, error: "MQTT topic is not allowlisted" };
  }
  if (topic === PLC_COMMAND_TOPIC && !allowLegacyCommand) {
    return {
      ok: false,
      requestId,
      error: "The public bridge only allows plc/control",
    };
  }

  const payload = message.payload ?? message;
  const validationError =
    topic === PLC_CONTROL_TOPIC
      ? validateControlPayload(payload)
      : validateLegacyCommandPayload(payload);
  if (validationError) {
    return { ok: false, requestId, error: validationError };
  }

  return {
    ok: true,
    command: {
      requestId,
      topic,
      payload: JSON.stringify(payload),
    },
  };
}

export function createPublishAck(requestId, ok, error) {
  if (!requestId) return null;
  return JSON.stringify({
    type: "publish-ack",
    requestId,
    ok,
    ...(error ? { error } : {}),
  });
}

/** Legacy local toggles still require an RFID operator grant. */
export function commandRequiresAuthorization(command) {
  return command?.topic !== PLC_CONTROL_TOPIC;
}

/**
 * Relay ON commands require fresh PLC telemetry showing that E-stop is clear.
 * Exact relay-off commands remain unconditional fail-safe STOP/CLEAR actions.
 */
export function commandRequiresSafetyCheck(command) {
  if (command?.topic !== PLC_CONTROL_TOPIC) return false;
  try {
    const payload = JSON.parse(command.payload);
    return Object.values(payload)[0] !== 0;
  } catch {
    return true;
  }
}

export function isProtectedCommandTopic(topic) {
  return (
    topic === PLC_CONTROL_TOPIC ||
    topic?.startsWith(`${PLC_CONTROL_TOPIC}/`) ||
    topic === PLC_COMMAND_TOPIC ||
    topic?.startsWith(`${PLC_COMMAND_TOPIC}/`)
  );
}

export function createRfidAuthorizationGate({
  windowMs = 60_000,
  telemetryFreshnessMs = 10_000,
  now = Date.now,
} = {}) {
  let authorizedUntil = 0;
  let lastEStopTelemetryAt = null;
  let sawEmergencyStopBaseline = false;
  const rfidLevels = new Map();
  const emergencyStopLevels = new Map();
  let latchedEmergencyStopLevel = false;

  const invalidate = () => {
    authorizedUntil = 0;
    lastEStopTelemetryAt = null;
    sawEmergencyStopBaseline = false;
    rfidLevels.clear();
    emergencyStopLevels.clear();
    latchedEmergencyStopLevel = false;
  };

  const isSafeToEnergize = () => {
    const emergencyStopActive = [...emergencyStopLevels.values()].some(
      Boolean,
    );
    return (
      sawEmergencyStopBaseline &&
      !emergencyStopActive &&
      lastEStopTelemetryAt !== null &&
      now() - lastEStopTelemetryAt <= telemetryFreshnessMs
    );
  };

  return {
    invalidate,
    observe(topic, payload) {
      if (!isPlcDataTopic(topic) || !isPlainObject(payload)) return;

      const emergencyStopEntries = readBitEntries(
        payload,
        EMERGENCY_STOP_FIELDS,
      );
      if (emergencyStopEntries.length > 0) {
        lastEStopTelemetryAt = now();
        for (const [field, active] of emergencyStopEntries) {
          emergencyStopLevels.set(field, active);
        }
      }
      const emergencyStopActive = [...emergencyStopLevels.values()].some(
        Boolean,
      );
      if (emergencyStopLevels.size > 0 && !emergencyStopActive) {
        sawEmergencyStopBaseline = true;
      }

      const latchedEmergencyStop = readBitEntries(payload, [
        LATCHED_EMERGENCY_STOP_FIELD,
      ])[0]?.[1];
      const latchedEmergencyStopRising =
        latchedEmergencyStop === true && !latchedEmergencyStopLevel;
      if (latchedEmergencyStop !== undefined) {
        latchedEmergencyStopLevel = latchedEmergencyStop;
      }

      if (emergencyStopActive || latchedEmergencyStopRising) {
        authorizedUntil = 0;
      }
      if (latchedEmergencyStopRising) {
        lastEStopTelemetryAt = null;
        sawEmergencyStopBaseline = false;
      }

      const rfidEntries = readBitEntries(payload, RFID_AUTHORIZATION_FIELDS);
      const freshRfidRisingEdge = rfidEntries.some(
        ([field, active]) => active && rfidLevels.get(field) === false,
      );
      for (const [field, active] of rfidEntries) {
        rfidLevels.set(field, active);
      }
      if (
        freshRfidRisingEdge &&
        sawEmergencyStopBaseline &&
        !emergencyStopActive
      ) {
        authorizedUntil = now() + windowMs;
      }
    },
    isSafeToEnergize,
    isAuthorized() {
      return (
        isSafeToEnergize() &&
        authorizedUntil > 0 &&
        now() <= authorizedUntil
      );
    },
  };
}

export function isAllowedCommandOrigin(headers, configuredOrigins = []) {
  const origin = typeof headers?.origin === "string" ? headers.origin : "";
  if (!origin) return false;
  if (configuredOrigins.includes(origin)) return true;

  const host = typeof headers?.host === "string" ? headers.host : "";
  if (!host) return false;

  try {
    const originUrl = new URL(origin);
    const requestHostname = new URL(`http://${host}`).hostname;
    return originUrl.hostname.toLowerCase() === requestHostname.toLowerCase();
  } catch {
    return false;
  }
}

function validateControlPayload(payload) {
  if (!isPlainObject(payload)) {
    return "plc/control payload must be an object";
  }
  const keys = Object.keys(payload);
  if (keys.length !== 1 || !PLC_CONTROL_FIELDS.has(keys[0])) {
    return "plc/control payload must contain one allowlisted relay field";
  }
  if (payload[keys[0]] !== 0 && payload[keys[0]] !== 1) {
    return "plc/control relay value must be 0 or 1";
  }
  return null;
}

function validateLegacyCommandPayload(payload) {
  if (!isPlainObject(payload)) return "plc/cmd payload must be an object";
  const keys = Object.keys(payload).sort();
  if (keys.length !== 2 || keys[0] !== "action" || keys[1] !== "deviceId") {
    return "plc/cmd only accepts deviceId and action";
  }
  if (!LOCAL_TOGGLE_DEVICES.has(payload.deviceId)) {
    return "plc/cmd device is not allowlisted";
  }
  if (payload.action !== "toggle") {
    return "plc/cmd only allows the toggle action";
  }
  return null;
}

function isPlainObject(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPlcDataTopic(topic) {
  return (
    topic === "prplHome/McKinney/lineA/plc1/data" ||
    topic?.startsWith("prplHome/McKinney/lineA/plc1/data/") ||
    topic === "plc/data" ||
    topic?.startsWith("plc/data/")
  );
}

function isActiveBit(value) {
  if (Array.isArray(value)) value = value[0];
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "on";
  }
  return value === 1 || value === true;
}

function readBitEntries(payload, fields) {
  return fields
    .filter((field) => Object.prototype.hasOwnProperty.call(payload, field))
    .map((field) => [field, isActiveBit(payload[field])]);
}
