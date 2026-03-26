import type { PLCParameter } from "../types";
import { plcParameters } from "../data/mockData";

/* ── Raw MQTT payload from plc/data topic ────────────── */

export interface RawPLCPayload {
  voltage_pot: [number];
  current_pot: [number];
  photoE_sensor: [number];
  metal_sensor: [number];
  alerts: number[];
  "8ch_relay_1": number[];
  push_button: [number];
  temperature: [number];
  pH: [number];
}

/* ── Shared types ──────────────────────────────────────── */

export interface PLCOutputs {
  motorFanOn: boolean;
  emergencyLightOn: boolean;
  photoESensor: boolean;
  relay: boolean[];
  pushButton: boolean;
  alerts: boolean[];
}

export interface PLCState {
  params: PLCParameter[];
  outputs: PLCOutputs;
}

export const DEFAULT_OUTPUTS: PLCOutputs = {
  motorFanOn: false,
  emergencyLightOn: false,
  photoESensor: false,
  relay: [false, false, false, false, false, false, false, false],
  pushButton: false,
  alerts: [false, false, false, false],
};

/* ── Payload parser ───────────────────────────────────── */

function deriveStatus(
  value: number,
  nominal: number,
  min: number,
  max: number
): "normal" | "warning" | "critical" {
  const range = max - min;
  if (range === 0) return "normal";
  const deviation = Math.abs(value - nominal) / range;
  if (deviation > 0.4) return "critical";
  if (deviation > 0.2) return "warning";
  return "normal";
}

/** Relay color: red when sensor active (motor running), green when idle */
export function deriveRelayColor(photoEActive: boolean): string {
  if (photoEActive) return "#ef4444";   // red — motor running
  return "#10b981";                     // green — idle
}

// Safe accessors for payload fields that might be null/undefined/missing
function num(arr: unknown, fallback: number): number {
  if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "number") return arr[0];
  return fallback;
}

function bit(arr: unknown, fallback: boolean): boolean {
  if (Array.isArray(arr) && arr.length > 0) return arr[0] === 1;
  return fallback;
}

function bits(arr: unknown, len: number): boolean[] {
  if (Array.isArray(arr)) return Array.from({ length: len }, (_, i) => arr[i] === 1);
  return Array(len).fill(false);
}

/** Helper to look up the last value of an analog param by id. */
function prevNum(prev: PLCState | null, id: string, fallback: number): number {
  const p = prev?.params.find((p) => p.id === id);
  return p?.value ?? fallback;
}

function prevBit(prev: PLCState | null, id: string, fallback: boolean): boolean {
  const p = prev?.params.find((p) => p.id === id);
  return p?.active ?? fallback;
}

/** Map the raw MQTT JSON from plc/data into our frontend PLCState. */
export function parsePLCPayload(raw: RawPLCPayload, prev?: PLCState | null): PLCState {
  const relay = bits(raw["8ch_relay_1"], 8);

  const v = num(raw.voltage_pot, prevNum(prev ?? null, "voltage", 0));
  const c = num(raw.current_pot, prevNum(prev ?? null, "current", 0));
  const ph = num(raw.pH, prevNum(prev ?? null, "ph", 7));
  const photoEActive = bit(raw.photoE_sensor, prevBit(prev ?? null, "photoE", false));
  const metalActive = bit(raw.metal_sensor, prevBit(prev ?? null, "metal", false));
  const sensorTriggered = photoEActive || metalActive;

  const params: PLCParameter[] = [
    {
      id: "voltage",
      label: "Voltage",
      kind: "analog",
      value: v,
      unit: "V",
      min: 0,
      max: 12,
      nominal: 5.0,
      decimals: 1,
      accentHex: "#f59e0b",
      status: deriveStatus(v, 5.0, 0, 12),
    },
    {
      id: "current",
      label: "Current",
      kind: "analog",
      value: c,
      unit: "A",
      min: 0,
      max: 10,
      nominal: 6.0,
      decimals: 1,
      accentHex: "#06b6d4",
      status: deriveStatus(c, 6.0, 0, 10),
    },
    {
      id: "relay",
      label: "Relay",
      kind: "relay",
      active: true,
      accentHex: deriveRelayColor(sensorTriggered),
      status: "normal",
    },
    {
      id: "ph",
      label: "pH",
      kind: "analog",
      value: ph,
      unit: "",
      min: 0,
      max: 14,
      nominal: 7.0,
      decimals: 1,
      accentHex: "#8b5cf6",
      status: deriveStatus(ph, 7.0, 0, 14),
    },
    {
      id: "photoE",
      label: "Photo-E",
      kind: "digital",
      active: photoEActive,
      accentHex: "#10b981",
      status: "normal",
    },
    {
      id: "metal",
      label: "Metal Det.",
      kind: "digital",
      active: metalActive,
      accentHex: "#f97316",
      status: "normal",
    },
  ];

  return {
    params,
    outputs: {
      motorFanOn: relay[0] || sensorTriggered,
      emergencyLightOn: relay[1],
      photoESensor: photoEActive,
      relay,
      pushButton: bit(raw.push_button, prev?.outputs.pushButton ?? false),
      alerts: bits(raw.alerts, 4),
    },
  };
}

/* ── Interface ─────────────────────────────────────────── */

export interface PLCService {
  subscribe(onUpdate: (state: PLCState) => void): () => void;
  sendCommand(deviceId: string, command: Record<string, unknown>): Promise<void>;
  fetchCurrentState(): Promise<PLCState>;
}

/* ── Mock implementation ──────────────────────────────── */

export class MockPLCService implements PLCService {
  private params: PLCParameter[] = plcParameters.map((p) => ({ ...p }));
  private outputs: PLCOutputs = {
    ...DEFAULT_OUTPUTS,
    // Derive initial motor fan state from Photo-E default
    motorFanOn: plcParameters.find((p) => p.id === "photoE")?.active ?? false,
    photoESensor: plcParameters.find((p) => p.id === "photoE")?.active ?? false,
  };
  private listeners: Set<(state: PLCState) => void> = new Set();

  subscribe(onUpdate: (state: PLCState) => void): () => void {
    this.listeners.add(onUpdate);
    onUpdate(this.getState());
    return () => {
      this.listeners.delete(onUpdate);
    };
  }

  async sendCommand(deviceId: string, command: Record<string, unknown>): Promise<void> {
    await new Promise((r) => setTimeout(r, 150));

    if (deviceId === "motor_fan" && command.action === "toggle") {
      const newVal = !this.outputs.motorFanOn;
      const relay = [...this.outputs.relay];
      relay[0] = newVal;
      this.outputs = { ...this.outputs, motorFanOn: newVal, relay };
      this.notify();
      return;
    }

    const idx = this.params.findIndex((p) => p.id === deviceId);
    if (idx !== -1 && this.params[idx].kind === "digital") {
      const param = this.params[idx];
      const newActive = !param.active;
      this.params = this.params.map((p, i) =>
        i === idx ? { ...p, active: newActive } : p
      );

      if (deviceId === "photoE") {
        this.outputs = { ...this.outputs, motorFanOn: newActive, photoESensor: newActive };
        // Sync relay card color with photoE state
        const relayIdx = this.params.findIndex((p) => p.id === "relay");
        if (relayIdx !== -1) {
          this.params = this.params.map((p, i) =>
            i === relayIdx ? { ...p, accentHex: deriveRelayColor(newActive) } : p
          );
        }
      }

      this.notify();
    }
  }

  async fetchCurrentState(): Promise<PLCState> {
    return this.getState();
  }

  private getState(): PLCState {
    return { params: [...this.params], outputs: { ...this.outputs } };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((cb) => cb(state));
  }
}

/* ── IoT Core Direct (browser → MQTT/WSS → IoT Core) ── */

export class IoTCorePLCService implements PLCService {
  private client: import("mqtt").MqttClient | null = null;
  private listeners: Set<(state: PLCState) => void> = new Set();
  private lastState: PLCState | null = null;
  private pendingRaw: RawPLCPayload | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly endpoint: string;
  private readonly identityPoolId: string;
  private readonly region: string;
  private readonly attachPolicyUrl: string;

  constructor(endpoint: string, identityPoolId: string, region: string, attachPolicyUrl: string) {
    this.endpoint = endpoint;
    this.identityPoolId = identityPoolId;
    this.region = region;
    this.attachPolicyUrl = attachPolicyUrl;
  }

  subscribe(onUpdate: (state: PLCState) => void): () => void {
    this.listeners.add(onUpdate);

    if (this.lastState) {
      onUpdate(this.lastState);
    }

    if (!this.client) {
      this.connect();
    }

    return () => {
      this.listeners.delete(onUpdate);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  async sendCommand(deviceId: string, command: Record<string, unknown>): Promise<void> {
    if (!this.client || !this.client.connected) {
      throw new Error("Not connected to IoT Core");
    }
    const payload = JSON.stringify({ deviceId, ...command });
    this.client.publish("plc/cmd", payload);
  }

  async fetchCurrentState(): Promise<PLCState> {
    if (this.lastState) return this.lastState;
    return {
      params: plcParameters.map((p) => ({ ...p })),
      outputs: { ...DEFAULT_OUTPUTS },
    };
  }

  private async connect() {
    try {
      const { fromCognitoIdentityPool } = await import("@aws-sdk/credential-providers");
      const { CognitoIdentityClient, GetIdCommand } = await import("@aws-sdk/client-cognito-identity");
      const mqttModule = await import("mqtt");
      const mqttConnect = mqttModule.connect ?? mqttModule.default?.connect ?? mqttModule.default;

      // 1. Get Cognito identity ID
      const cognitoClient = new CognitoIdentityClient({ region: this.region });
      const { IdentityId: identityId } = await cognitoClient.send(
        new GetIdCommand({ IdentityPoolId: this.identityPoolId })
      );
      console.log("[IoTCore] Identity ID:", identityId);

      // 2. Attach IoT policy to this identity (via REST endpoint)
      if (this.attachPolicyUrl) {
        try {
          await fetch(this.attachPolicyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identityId }),
          });
          console.log("[IoTCore] Policy attached to identity");
        } catch (err) {
          console.warn("[IoTCore] Policy attach failed (may already be attached):", err);
        }
      }

      // 3. Get credentials
      const credentialProvider = fromCognitoIdentityPool({
        identityPoolId: this.identityPoolId,
        clientConfig: { region: this.region },
      });
      const credentials = await credentialProvider();

      // 4. Build signed URL and connect
      const url = await this.buildSignedUrl(credentials);
      const clientId = `dashboard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      this.client = mqttConnect(url, {
        clientId,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        protocolVersion: 4,
        protocolId: "MQTT",
        createWebsocket: (wsUrl: string) => new WebSocket(wsUrl, ["mqtt"]),
      });

      this.client.on("connect", () => {
        console.log("[IoTCore] Connected — direct MQTT, no Lambda delay");
        this.client!.subscribe("plc/data", { qos: 0 }, (err) => {
          if (err) console.error("[IoTCore] Subscribe error:", err);
          else console.log("[IoTCore] Subscribed to plc/data");
        });
      });

      this.client.on("message", (_topic: string, payload: Buffer) => {
        try {
          this.pendingRaw = JSON.parse(payload.toString()) as RawPLCPayload;
          if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => {
              this.flushTimer = null;
              if (!this.pendingRaw) return;
              const state = parsePLCPayload(this.pendingRaw, this.lastState);
              this.pendingRaw = null;
              this.lastState = state;
              this.listeners.forEach((cb) => cb(state));
            }, 50);
          }
        } catch (err) {
          console.error("[IoTCore] Parse error:", err);
        }
      });

      this.client.on("error", (err: Error) => {
        console.error("[IoTCore] Error:", err);
      });

      this.client.on("close", () => {
        console.log("[IoTCore] Disconnected");
      });
    } catch (err) {
      console.error("[IoTCore] Connection setup failed:", err);
    }
  }

  private async buildSignedUrl(credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }): Promise<string> {
    // IoT Core WebSocket uses SigV4 WITHOUT X-Amz-Expires (unlike standard presigning).
    // We must sign manually since SignatureV4.presign() always adds X-Amz-Expires.
    const { Sha256 } = await import("@aws-crypto/sha256-js");

    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const dateShort = amzDate.slice(0, 8);
    const scope = `${dateShort}/${this.region}/iotdevicegateway/aws4_request`;

    // Query params — NO X-Amz-Expires (IoT Core rejects it)
    const params: Record<string, string> = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${credentials.accessKeyId}/${scope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-SignedHeaders": "host",
    };
    if (credentials.sessionToken) {
      params["X-Amz-Security-Token"] = credentials.sessionToken;
    }

    const canonicalQS = Object.keys(params)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join("&");

    const canonicalRequest = [
      "GET",
      "/mqtt",
      canonicalQS,
      `host:${this.endpoint}\n`,
      "host",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ].join("\n");

    // Hash the canonical request
    const crHash = new Sha256();
    crHash.update(canonicalRequest);
    const crDigest = toHex(await crHash.digest());

    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${crDigest}`;

    // Derive signing key: HMAC chain
    const kDate = await hmacSha256(Sha256, `AWS4${credentials.secretAccessKey}`, dateShort);
    const kRegion = await hmacSha256(Sha256, kDate, this.region);
    const kService = await hmacSha256(Sha256, kRegion, "iotdevicegateway");
    const kSigning = await hmacSha256(Sha256, kService, "aws4_request");

    const signature = toHex(await hmacSha256(Sha256, kSigning, stringToSign));

    return `wss://${this.endpoint}/mqtt?${canonicalQS}&X-Amz-Signature=${signature}`;
  }

  private disconnect() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }
}

// HMAC-SHA256 using @aws-crypto/sha256-js (pass key as string or Uint8Array)
async function hmacSha256(
  Sha256: new (key: Uint8Array) => { update(data: string): void; digest(): Promise<Uint8Array> },
  key: string | Uint8Array,
  data: string
): Promise<Uint8Array> {
  const keyBytes = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const h = new Sha256(keyBytes);
  h.update(data);
  return h.digest();
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ── AWS implementation (API Gateway + IoT Core) ──────── */

export class AWSPLCService implements PLCService {
  private ws: WebSocket | null = null;
  private listeners: Set<(state: PLCState) => void> = new Set();
  private lastState: PLCState | null = null;
  private pendingData: RawPLCPayload | PLCState | null = null;
  private pendingIsRaw = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly apiUrl: string;
  private readonly wsUrl: string;

  constructor(apiUrl: string, wsUrl: string) {
    this.apiUrl = apiUrl;
    this.wsUrl = wsUrl;
  }

  subscribe(onUpdate: (state: PLCState) => void): () => void {
    this.listeners.add(onUpdate);

    // Cancel any pending disconnect (React StrictMode remount)
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect();
    }

    return () => {
      this.listeners.delete(onUpdate);
      if (this.listeners.size === 0) {
        // Delay disconnect to survive React StrictMode unmount/remount
        this.disconnectTimer = setTimeout(() => {
          if (this.listeners.size === 0) this.disconnect();
        }, 1000);
      }
    };
  }

  async sendCommand(deviceId: string, command: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${this.apiUrl}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, ...command }),
    });
    if (!res.ok) {
      throw new Error(`Command failed: ${res.status} ${res.statusText}`);
    }
  }

  async fetchCurrentState(): Promise<PLCState> {
    const res = await fetch(`${this.apiUrl}/state`);
    if (!res.ok) {
      throw new Error(`Fetch state failed: ${res.status}`);
    }
    return res.json();
  }

  private connect() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const isRaw = data.voltage_pot !== undefined;
        this.pendingData = data;
        this.pendingIsRaw = isRaw;

        if (!this.flushTimer) {
          this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            if (!this.pendingData) return;
            const state = this.pendingIsRaw
              ? parsePLCPayload(this.pendingData as RawPLCPayload, this.lastState)
              : this.pendingData as PLCState;
            this.pendingData = null;
            this.lastState = state;
            this.listeners.forEach((cb) => cb(state));
          }, 50);
        }
      } catch {
        console.error("[AWSPLCService] Failed to parse WebSocket message");
      }
    };

    this.ws.onclose = () => {
      if (this.listeners.size > 0) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = (err) => {
      console.error("[AWSPLCService] WebSocket error:", err);
      this.ws?.close();
    };
  }

  private disconnect() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/* ── Mosquitto via local bridge (browser → WS → bridge → MQTT broker) ── */

export class MosquittoPLCService implements PLCService {
  private ws: WebSocket | null = null;
  private listeners: Set<(state: PLCState) => void> = new Set();
  private lastState: PLCState | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRaw: RawPLCPayload | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly wsUrl: string;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  subscribe(onUpdate: (state: PLCState) => void): () => void {
    this.listeners.add(onUpdate);

    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    if (this.lastState) {
      onUpdate(this.lastState);
    }

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect();
    }

    return () => {
      this.listeners.delete(onUpdate);
      if (this.listeners.size === 0) {
        this.disconnectTimer = setTimeout(() => {
          if (this.listeners.size === 0) this.disconnect();
        }, 1000);
      }
    };
  }

  async sendCommand(deviceId: string, command: Record<string, unknown>): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected to MQTT bridge");
    }
    const topic = (command._topic as string) ?? "plc/cmd";
    const rawPayload = command._rawPayload as Record<string, unknown> | undefined;
    if (rawPayload) {
      this.ws.send(JSON.stringify({ topic, payload: rawPayload }));
    } else {
      const { _topic, ...rest } = command;
      this.ws.send(JSON.stringify({ topic, payload: { deviceId, ...rest } }));
    }
  }

  async fetchCurrentState(): Promise<PLCState> {
    if (this.lastState) return this.lastState;
    return {
      params: plcParameters.map((p) => ({ ...p })),
      outputs: { ...DEFAULT_OUTPUTS },
    };
  }

  private connect() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log("[Mosquitto] Connected to bridge at", this.wsUrl);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { topic: string; payload: unknown };
        if (msg.topic !== "plc/data") return;

        // Always keep the latest raw payload — never drop a message
        this.pendingRaw = msg.payload as RawPLCPayload;

        // Flush on a 50ms timer so we batch rapid bursts but never lose state
        if (!this.flushTimer) {
          this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            if (!this.pendingRaw) return;
            const state = parsePLCPayload(this.pendingRaw, this.lastState);
            this.pendingRaw = null;
            this.lastState = state;
            this.listeners.forEach((cb) => cb(state));
          }, 50);
        }
      } catch (err) {
        console.error("[Mosquitto] Parse error:", err);
      }
    };

    this.ws.onclose = () => {
      console.log("[Mosquitto] Disconnected from bridge");
      if (this.listeners.size > 0) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = (err) => {
      console.error("[Mosquitto] WebSocket error:", err);
      this.ws?.close();
    };
  }

  private disconnect() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/* ── Factory ───────────────────────────────────────────── */

export function createPLCService(): PLCService {
  const mode = import.meta.env.VITE_PLC_MODE ?? "mock";

  if (mode === "iotcore") {
    const endpoint = import.meta.env.VITE_IOT_ENDPOINT;
    const identityPoolId = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;
    const region = import.meta.env.VITE_AWS_REGION ?? "us-east-1";
    const attachPolicyUrl = import.meta.env.VITE_ATTACH_POLICY_URL ?? "";
    if (!endpoint || !identityPoolId) {
      console.warn("[PLCService] IoT Core mode requested but config missing, falling back to mock");
      return new MockPLCService();
    }
    return new IoTCorePLCService(endpoint, identityPoolId, region, attachPolicyUrl);
  }

  if (mode === "mosquitto") {
    const bridgeUrl = import.meta.env.VITE_MQTT_BRIDGE_URL ?? `ws://${window.location.hostname}:9001`;
    return new MosquittoPLCService(bridgeUrl);
  }

  if (mode === "aws") {
    const apiUrl = import.meta.env.VITE_AWS_API_GATEWAY_URL;
    const wsUrl = import.meta.env.VITE_AWS_WS_URL;
    if (!apiUrl || !wsUrl) {
      console.warn("[PLCService] AWS mode requested but URLs not configured, falling back to mock");
      return new MockPLCService();
    }
    return new AWSPLCService(apiUrl, wsUrl);
  }

  return new MockPLCService();
}