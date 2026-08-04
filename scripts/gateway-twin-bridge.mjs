/**
 * Gateway Twin telemetry bridge.
 *
 * This is deliberately separate from cloud-bridge.mjs. The Smart Factory
 * dashboard already has its own MQTT/WebSocket data plane; this process adds a
 * read-only SSE feed for the embedded GW Operational Twin without changing or
 * rewriting any existing factory payloads.
 *
 * AWS IoT Core -> this process -> same-origin SSE -> GW Twin iframe
 *
 * The bridge publishes only the eight prplOS DeviceInfo topics consumed by the
 * Twin's live adapter. It keeps the latest sample per topic so a newly opened
 * iframe hydrates immediately instead of waiting for the next device report.
 */

import http from 'node:http';
import process from 'node:process';
import { mqtt as iotMqtt, iot, auth } from 'aws-iot-device-sdk-v2';

const DEFAULT_TOPICS = Object.freeze([
  'prplos/deviceinfo/uptime',
  'prplos/deviceinfo/softwareversion',
  'prplos/deviceinfo/hardwareversion',
  'prplos/deviceinfo/serialnumber',
  'prplos/deviceinfo/memorystatus',
  'prplos/deviceinfo/cpuutilization',
  'prplos/deviceinfo/temperaturesensor',
  'prplos/deviceinfo/processes',
]);

const ENDPOINT = process.env.AWS_IOT_ENDPOINT ?? process.env.IOT_ENDPOINT ??
  'alht1i2bx8tzt-ats.iot.us-east-1.amazonaws.com';
const REGION = process.env.AWS_REGION ?? process.env.IOT_REGION ?? 'us-east-1';
const PORT = Number(process.env.GATEWAY_TWIN_STREAM_PORT ?? 46121);
const HOST = process.env.GATEWAY_TWIN_STREAM_HOST ?? '127.0.0.1';
const CLIENT_ID = process.env.GATEWAY_TWIN_CLIENT_ID ??
  `cloud-bridge-gateway-twin-${Date.now().toString(36)}`;
const TOPICS = (process.env.GATEWAY_TWIN_DEVICE_INFO_TOPICS ?? DEFAULT_TOPICS.join(','))
  .split(',')
  .map((topic) => topic.trim())
  .filter(Boolean);

if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  throw new Error(`GATEWAY_TWIN_STREAM_PORT must be a valid TCP port (got ${PORT})`);
}

const MAX_PAYLOAD_BYTES = 1_048_576;
const clients = new Set();
const latestDeviceInfo = new Map();
let connection;
let stopping = false;
let upstream = {
  state: 'connecting',
  endpoint: ENDPOINT,
  connectedAt: null,
  lastMessageAt: null,
  error: null,
};

function sseRecord(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function writeClient(response, chunk) {
  if (response.destroyed || response.writableEnded) return false;
  try {
    response.write(chunk);
    return true;
  } catch {
    clients.delete(response);
    return false;
  }
}

function broadcast(chunk) {
  for (const response of clients) writeClient(response, chunk);
}

function setUpstreamState(state, error = null) {
  upstream = {
    ...upstream,
    state,
    error,
    connectedAt: state === 'connected' ? upstream.connectedAt ?? Date.now() : upstream.connectedAt,
  };
  broadcast(sseRecord('state', upstream));
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function decodeJsonPayload(payload) {
  const bytes = Buffer.from(payload);
  if (bytes.byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error(`payload exceeds ${MAX_PAYLOAD_BYTES} bytes`);
  }
  const value = JSON.parse(bytes.toString('utf8'));
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('expected a JSON object');
  }
  return value;
}

function publishDeviceInfo(topic, payload, receivedAt) {
  const item = { topic, receivedAt, payload };
  latestDeviceInfo.set(topic, item);
  broadcast(sseRecord('device-telemetry', item));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/readyz') {
    const ready = upstream.state === 'connected';
    response.writeHead(ready ? 200 : 503, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify({ ready, ...upstream, topics: TOPICS }));
    return;
  }

  if (request.method !== 'GET' || url.pathname !== '/stream') {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  response.flushHeaders?.();
  response.socket?.setNoDelay(true);
  response.socket?.setKeepAlive(true);
  writeClient(response, 'retry: 2000\n\n');
  writeClient(response, sseRecord('state', upstream));
  for (const item of latestDeviceInfo.values()) {
    writeClient(response, sseRecord('device-telemetry', item));
  }
  clients.add(response);
  request.on('close', () => clients.delete(response));
});

async function subscribeAll() {
  if (!connection) return;
  for (const topic of TOPICS) {
    await connection.subscribe(topic, iotMqtt.QoS.AtLeastOnce, (receivedTopic, payload) => {
      const receivedAt = Date.now();
      try {
        const decoded = decodeJsonPayload(payload);
        upstream = { ...upstream, state: 'connected', error: null, lastMessageAt: receivedAt };
        publishDeviceInfo(receivedTopic, decoded, receivedAt);
      } catch (error) {
        setUpstreamState('error', `${receivedTopic}: invalid DeviceInfo JSON (${error.message})`);
      }
    });
  }
}

async function connectAws() {
  const credentialsProvider = auth.AwsCredentialsProvider.newDefault();
  const builder = iot.AwsIotMqttConnectionConfigBuilder.new_with_websockets({
    region: REGION,
    credentials_provider: credentialsProvider,
  });
  builder.with_endpoint(ENDPOINT);
  builder.with_client_id(CLIENT_ID);
  builder.with_clean_session(true);
  builder.with_keep_alive_seconds(60);

  const client = new iotMqtt.MqttClient();
  connection = client.new_connection(builder.build());
  connection.on('interrupt', (error) => {
    setUpstreamState('reconnecting', error?.error ?? String(error));
  });
  connection.on('resume', async () => {
    setUpstreamState('connecting');
    try {
      await subscribeAll();
      setUpstreamState('connected');
    } catch (error) {
      setUpstreamState('error', `AWS IoT subscription failed: ${errorText(error)}`);
    }
  });
  connection.on('disconnect', () => setUpstreamState('offline'));
  connection.on('error', (error) => setUpstreamState('error', error?.message ?? String(error)));

  await connection.connect();
  await subscribeAll();
  setUpstreamState('connected');
  console.log(`[gateway-twin] connected to ${ENDPOINT} as ${CLIENT_ID}`);
  console.log(`[gateway-twin] subscribed to ${TOPICS.join(', ')}`);
}

server.listen(PORT, HOST, () => {
  console.log(`[gateway-twin] SSE listening on http://${HOST}:${PORT}/stream`);
});

connectAws().catch((error) => {
  setUpstreamState('error', errorText(error));
  console.error('[gateway-twin] AWS IoT connection failed:', errorText(error));
  shutdown('aws-startup-failure');
});

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[gateway-twin] shutting down (${signal})`);
  for (const response of clients) response.end();
  clients.clear();
  const forceExit = setTimeout(() => process.exit(0), 1500);
  server.close(() => {
    clearTimeout(forceExit);
    process.exit(0);
  });
  void connection?.disconnect().catch(() => {});
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
