/**
 * Factory command downlink: AWS IoT Core -> local Mosquitto -> PLC.
 *
 * This process subscribes to exactly `plc/control` through Greengrass IPC when
 * the nucleus injects its socket/token environment, or through a standalone
 * SigV4 WebSocket otherwise. It forwards only the two absolute, binary relay
 * commands accepted by the PLC, never publishes at startup, and rejects
 * retained AWS messages.
 *
 * Usage: npm run edge-command
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mqtt from "mqtt";
import {
  auth,
  eventstream_rpc as eventstreamRpc,
  greengrasscoreipc,
  iot,
  mqtt as iotMqtt,
} from "aws-iot-device-sdk-v2";
import {
  EDGE_COMMAND_TOPIC,
  selectEdgeCommandTransport,
  validateEdgeCommandFrame,
} from "./edge-command-contract.mjs";

const LOCAL_RECONNECT_DELAY_MS = 5_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;

export async function main() {
  loadDotenv();
  const config = readConfig();

  let shuttingDown = false;
  let shutdownPromise = null;
  let awsConnection = null;
  let awsConnected = false;
  let awsEpoch = 0;
  let subscriptionReady = false;
  let subscribeAttempt = null;
  let ipcClient = null;
  let ipcSubscription = null;
  let localClient = null;
  let localConnected = false;
  let localGeneration = 0;
  let localReconnectTimer = null;
  const localPublishWaiters = new Set();
  const inFlightCommands = new Set();

  log("info", "STARTING", {
    commandTransport: config.transportMode,
    ...(config.transportMode === "sigv4-websocket"
      ? {
          awsEndpoint: config.endpoint,
          awsRegion: config.region,
          awsClientId: config.awsClientId,
        }
      : {}),
    localBroker: `mqtt://${config.mqttHost}:${config.mqttPort}`,
    localAuthentication: Boolean(config.mqttUsername),
    subscription: EDGE_COMMAND_TOPIC,
  });

  function connectLocal() {
    if (shuttingDown || localClient) return;

    const generation = ++localGeneration;
    const client = mqtt.connect(`mqtt://${config.mqttHost}:${config.mqttPort}`, {
      clientId: `${config.localClientId}-${generation}`.slice(0, 128),
      clean: true,
      reconnectPeriod: 0,
      connectTimeout: 10_000,
      queueQoSZero: false,
      ...(config.mqttUsername ? { username: config.mqttUsername } : {}),
      ...(config.mqttPassword ? { password: config.mqttPassword } : {}),
    });
    localClient = client;

    client.once("connect", () => {
      if (shuttingDown || client !== localClient) return;
      localConnected = true;
      log("info", "LOCAL_CONNECTED", { generation });
    });

    client.on("error", (error) => {
      if (client !== localClient || shuttingDown) return;
      log("error", "LOCAL_ERROR", {
        generation,
        error: summarizeError(error),
      });
    });

    client.once("close", () => {
      rejectLocalPublishes(
        generation,
        new Error("Local broker disconnected before PUBACK"),
      );
      if (client !== localClient) return;

      localConnected = false;
      localClient = null;
      log("warn", "LOCAL_DISCONNECTED", { generation });
      if (!shuttingDown) {
        localReconnectTimer = setTimeout(() => {
          localReconnectTimer = null;
          connectLocal();
        }, LOCAL_RECONNECT_DELAY_MS);
      }
    });
  }

  function publishLocal(command) {
    const client = localClient;
    const generation = localGeneration;
    if (
      shuttingDown ||
      !localConnected ||
      !client ||
      !client.connected
    ) {
      return Promise.reject(new Error("Local broker is not connected"));
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const waiter = {
        generation,
        reject: (error) => finish(error),
      };
      const finish = (error) => {
        if (settled) return;
        settled = true;
        localPublishWaiters.delete(waiter);
        if (error) reject(error);
        else resolve();
      };

      localPublishWaiters.add(waiter);
      try {
        client.publish(
          EDGE_COMMAND_TOPIC,
          command.payload,
          { qos: 1, retain: false },
          (error) => finish(error || null),
        );
      } catch (error) {
        finish(error);
      }
    });
  }

  function rejectLocalPublishes(generation, error) {
    for (const waiter of [...localPublishWaiters]) {
      if (waiter.generation === generation) waiter.reject(error);
    }
  }

  function onAwsMessage(topic, payload, dup, qos, retain) {
    const receivedAt = Date.now();
    const validation = validateEdgeCommandFrame({ topic, payload, retain });
    const frameMetadata = {
      sourceTopic: topic,
      qos: Number(qos),
      duplicate: Boolean(dup),
      retained:
        retain === true ? true : retain === false ? false : "unknown",
      payloadBytes: validation.payloadBytes,
    };

    if (!validation.ok) {
      log("warn", "COMMAND_REJECTED", {
        ...frameMetadata,
        reason: validation.reason,
        ...(validation.field ? { field: validation.field } : {}),
      });
      return;
    }

    if (shuttingDown || !awsConnected || !subscriptionReady) {
      log("warn", "COMMAND_REJECTED", {
        ...frameMetadata,
        field: validation.field,
        value: validation.value,
        reason: "COMMAND_SOURCE_NOT_READY",
      });
      return;
    }

    if (!localConnected || !localClient?.connected) {
      log("warn", "COMMAND_REJECTED", {
        ...frameMetadata,
        field: validation.field,
        value: validation.value,
        reason: "LOCAL_BROKER_NOT_READY",
      });
      return;
    }

    const operation = publishLocal(validation)
      .then(() => {
        log("info", "COMMAND_FORWARDED", {
          ...frameMetadata,
          destinationTopic: EDGE_COMMAND_TOPIC,
          field: validation.field,
          value: validation.value,
          action: validation.action,
          localQos: 1,
          localRetain: false,
          elapsedMs: Date.now() - receivedAt,
        });
      })
      .catch((error) => {
        log("error", "COMMAND_REJECTED", {
          ...frameMetadata,
          field: validation.field,
          value: validation.value,
          reason: "LOCAL_PUBLISH_NOT_ACKNOWLEDGED",
          error: summarizeError(error),
        });
      })
      .finally(() => inFlightCommands.delete(operation));

    inFlightCommands.add(operation);
  }

  async function subscribeExact() {
    if (!awsConnection || !awsConnected || shuttingDown) {
      throw new Error("AWS connection is not ready for subscription");
    }
    const epoch = awsEpoch;
    if (subscribeAttempt?.epoch === epoch) return subscribeAttempt.promise;

    subscriptionReady = false;
    const promise = awsConnection
      .subscribe(EDGE_COMMAND_TOPIC, iotMqtt.QoS.AtLeastOnce, onAwsMessage)
      .then(() => {
        if (shuttingDown || !awsConnected || epoch !== awsEpoch) return;
        subscriptionReady = true;
        log("info", "AWS_SUBSCRIBED", {
          topic: EDGE_COMMAND_TOPIC,
          qos: 1,
        });
      })
      .catch((error) => {
        if (shuttingDown || epoch !== awsEpoch) return;
        throw error;
      })
      .finally(() => {
        if (subscribeAttempt?.promise === promise) subscribeAttempt = null;
      });
    subscribeAttempt = { epoch, promise };

    return promise;
  }

  async function connectAws() {
    const credentialsProvider = auth.AwsCredentialsProvider.newDefault();
    const builder = iot.AwsIotMqttConnectionConfigBuilder.new_with_websockets({
      region: config.region,
      credentials_provider: credentialsProvider,
    });
    builder.with_endpoint(config.endpoint);
    builder.with_client_id(config.awsClientId);
    builder.with_clean_session(true);
    builder.with_keep_alive_seconds(60);

    const client = new iotMqtt.MqttClient();
    awsConnection = client.new_connection(builder.build());

    awsConnection.on("interrupt", (error) => {
      awsEpoch += 1;
      awsConnected = false;
      subscriptionReady = false;
      log("warn", "AWS_INTERRUPTED", { error: summarizeError(error) });
    });
    awsConnection.on("resume", () => {
      if (shuttingDown) return;
      awsEpoch += 1;
      awsConnected = true;
      subscriptionReady = false;
      log("info", "AWS_RESUMED", { topic: EDGE_COMMAND_TOPIC });
      subscribeExact().catch((error) => {
        log("error", "AWS_RESUBSCRIBE_FAILED", {
          error: summarizeError(error),
        });
        void shutdown("AWS_RESUBSCRIBE_FAILED", 1);
      });
    });
    awsConnection.on("error", (error) => {
      log("error", "AWS_ERROR", { error: summarizeError(error) });
    });

    await awsConnection.connect();
    awsEpoch += 1;
    awsConnected = true;
    log("info", "AWS_CONNECTED", { endpoint: config.endpoint });
    await subscribeExact();
  }

  async function connectGreengrass() {
    const client = greengrasscoreipc.createClient();
    ipcClient = client;

    client.on("disconnection", (event) => {
      if (shuttingDown) return;
      awsConnected = false;
      subscriptionReady = false;
      log("error", "GREENGRASS_IPC_DISCONNECTED", {
        error: summarizeError(event?.reason),
      });
      void shutdown("GREENGRASS_IPC_DISCONNECTED", 1);
    });

    await client.connect();
    if (shuttingDown) return;
    awsConnected = true;
    log("info", "GREENGRASS_IPC_CONNECTED");

    const subscription = client.subscribeToIoTCore({
      topicName: EDGE_COMMAND_TOPIC,
      qos: greengrasscoreipc.model.QOS.AT_LEAST_ONCE,
    });
    ipcSubscription = subscription;

    subscription.on(eventstreamRpc.StreamingOperation.MESSAGE, (event) => {
      const message = event?.message;
      onAwsMessage(
        message?.topicName,
        message?.payload,
        false,
        1,
        message?.retain,
      );
    });
    subscription.on(eventstreamRpc.StreamingOperation.STREAM_ERROR, (error) => {
      if (shuttingDown) return;
      awsConnected = false;
      subscriptionReady = false;
      log("error", "GREENGRASS_IPC_STREAM_ERROR", {
        error: summarizeError(error),
      });
      void shutdown("GREENGRASS_IPC_STREAM_ERROR", 1);
    });
    subscription.on(eventstreamRpc.StreamingOperation.ENDED, () => {
      if (shuttingDown) return;
      awsConnected = false;
      subscriptionReady = false;
      log("error", "GREENGRASS_IPC_STREAM_ENDED");
      void shutdown("GREENGRASS_IPC_STREAM_ENDED", 1);
    });

    await subscription.activate();
    if (shuttingDown) return;
    subscriptionReady = true;
    log("info", "GREENGRASS_IPC_SUBSCRIBED", {
      topic: EDGE_COMMAND_TOPIC,
      qos: 1,
    });
  }

  async function shutdown(reason, exitCode = 0) {
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;
    awsConnected = false;
    subscriptionReady = false;
    if (localReconnectTimer) {
      clearTimeout(localReconnectTimer);
      localReconnectTimer = null;
    }

    shutdownPromise = (async () => {
      log("info", "SHUTTING_DOWN", { reason });

      if (awsConnection) {
        await settleWithTimeout(
          awsConnection.disconnect(),
          SHUTDOWN_TIMEOUT_MS,
        );
      }
      if (ipcSubscription) {
        await settleWithTimeout(
          ipcSubscription.close(),
          SHUTDOWN_TIMEOUT_MS,
        );
      }
      if (ipcClient) {
        await settleWithTimeout(ipcClient.close(), SHUTDOWN_TIMEOUT_MS);
      }

      await settleWithTimeout(
        Promise.allSettled([...inFlightCommands]),
        SHUTDOWN_TIMEOUT_MS,
      );

      const client = localClient;
      if (client) {
        const graceful = inFlightCommands.size === 0;
        await settleWithTimeout(
          new Promise((resolve) => client.end(!graceful, {}, resolve)),
          SHUTDOWN_TIMEOUT_MS,
        );
        rejectLocalPublishes(
          localGeneration,
          new Error("Service shut down before PUBACK"),
        );
      }

      log("info", "STOPPED", { reason, exitCode });
      process.exitCode = exitCode;
    })();

    return shutdownPromise;
  }

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  connectLocal();
  try {
    if (config.transportMode === "greengrass-ipc") {
      await connectGreengrass();
    } else {
      await connectAws();
    }
  } catch (error) {
    log("error", "START_FAILED", { error: summarizeError(error) });
    await shutdown("START_FAILED", 1);
  }
}

function readConfig() {
  const transportMode = selectEdgeCommandTransport(process.env);
  const endpoint =
    process.env.AWS_IOT_ENDPOINT ??
    process.env.IOT_ENDPOINT ??
    "alht1i2bx8tzt-ats.iot.us-east-1.amazonaws.com";
  const region = process.env.AWS_REGION ?? process.env.IOT_REGION ?? "us-east-1";
  const mqttHost = process.env.MQTT_HOST ?? "192.168.10.254";
  const mqttPort = Number(process.env.MQTT_PORT ?? 1883);

  if (
    transportMode === "sigv4-websocket" &&
    !/^[A-Za-z0-9.-]+$/.test(endpoint)
  ) {
    throw new Error("AWS IoT endpoint must be a hostname without a URL scheme");
  }
  if (transportMode === "sigv4-websocket" && !/^[a-z0-9-]+$/.test(region)) {
    throw new Error("AWS region is invalid");
  }
  if (!/^[A-Za-z0-9.-]+$/.test(mqttHost)) {
    throw new Error("MQTT_HOST must be a hostname or IPv4 address");
  }
  if (!Number.isInteger(mqttPort) || mqttPort < 1 || mqttPort > 65_535) {
    throw new Error("MQTT_PORT must be an integer from 1 through 65535");
  }

  const suffix = `${safeHostname()}-${process.pid}-${crypto.randomBytes(3).toString("hex")}`;
  const awsClientId = process.env.EDGE_COMMAND_CLIENT_ID ?? `edge-command-${suffix}`;
  const localClientId = `edge-command-local-${suffix}`;
  if (
    transportMode === "sigv4-websocket" &&
    !/^[A-Za-z0-9:_-]{1,128}$/.test(awsClientId)
  ) {
    throw new Error("EDGE_COMMAND_CLIENT_ID contains unsupported characters");
  }

  return {
    transportMode,
    endpoint,
    region,
    mqttHost,
    mqttPort,
    mqttUsername: process.env.MQTT_USERNAME,
    mqttPassword: process.env.MQTT_PASSWORD,
    awsClientId,
    localClientId,
  };
}

function loadDotenv() {
  try {
    const directory = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.resolve(directory, "..", ".env");
    if (!fs.existsSync(envPath)) return;

    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 0) continue;

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    log("warn", "DOTENV_LOAD_FAILED", { error: summarizeError(error) });
  }
}

function safeHostname() {
  return os.hostname().replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40) || "host";
}

function summarizeError(error) {
  const raw = error?.message ?? error?.error ?? String(error ?? "Unknown error");
  return String(raw)
    .replace(/([?&]X-Amz-(?:Credential|Signature|Security-Token)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/(aws_(?:secret_access_key|session_token)\s*[=:]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/(mqtts?:\/\/)[^@\s/]+@/gi, "$1[redacted]@")
    .slice(0, 500);
}

function log(level, event, metadata = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "edge-command",
    event,
    ...metadata,
  });
  const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  writer(entry);
}

async function settleWithTimeout(promise, timeoutMs) {
  let timer;
  try {
    await Promise.race([
      Promise.resolve(promise).catch(() => undefined),
      new Promise((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const isEntryPoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntryPoint) {
  main().catch((error) => {
    log("error", "FATAL", { error: summarizeError(error) });
    process.exitCode = 1;
  });
}
