/**
 * Local MQTT-to-WebSocket bridge.
 *
 * Connects to the Mosquitto broker via TCP (mqtt://) and exposes a plain
 * WebSocket server on localhost for the browser dashboard.
 *
 * Usage:  node scripts/mqtt-bridge.mjs
 * Env:    MQTT_HOST (default 192.168.10.254)
 *         MQTT_PORT (default 1883)
 *         WS_PORT   (default 9001)
 */

import mqtt from "mqtt";
import { WebSocketServer } from "ws";

const MQTT_HOST = process.env.MQTT_HOST ?? "192.168.10.254";
const MQTT_PORT = Number(process.env.MQTT_PORT ?? 1883);
const WS_PORT = Number(process.env.WS_PORT ?? 9001);

// --- MQTT client (TCP) ---
const mqttUrl = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
const client = mqtt.connect(mqttUrl, {
  clientId: `bridge-${Date.now()}`,
  clean: true,
  reconnectPeriod: 5000,
});

client.on("connect", () => {
  console.log(`[bridge] Connected to MQTT broker at ${mqttUrl}`);
  client.subscribe("plc/#", { qos: 0 }, (err) => {
    if (err) console.error("[bridge] Subscribe error:", err);
    else console.log("[bridge] Subscribed to plc/#");
  });
});

client.on("error", (err) => {
  console.error("[bridge] MQTT error:", err.message);
});

// --- WebSocket server ---
const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Set();

wss.on("listening", () => {
  console.log(`[bridge] WebSocket server listening on ws://localhost:${WS_PORT}`);
});

wss.on("connection", (ws) => {
  console.log("[bridge] Browser connected");
  clients.add(ws);

  // Browser → MQTT (for commands)
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const topic = msg.topic ?? "plc/cmd";
      const payload = JSON.stringify(msg.payload ?? msg);
      client.publish(topic, payload);
    } catch {
      console.error("[bridge] Bad message from browser");
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("[bridge] Browser disconnected");
  });
});

// MQTT → all connected browsers
client.on("message", (topic, payload) => {
  const msg = JSON.stringify({ topic, payload: JSON.parse(payload.toString()) });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
});

console.log(`[bridge] Starting — MQTT ${mqttUrl} ↔ WS ws://localhost:${WS_PORT}`);
