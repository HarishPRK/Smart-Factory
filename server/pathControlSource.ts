/**
 * SD-WAN path-control publisher.
 *
 * The DPS "Auto / Force Fiber / Force 5G" buttons drive the gateway's active
 * underlay through the `com.rdk.pathcontrol` Greengrass component running on
 * the edge device. That component listens on the device's LOCAL MQTT broker
 * for `rdk/path/control` commands and applies them to the gateway's local
 * path-selection API (http://127.0.0.1:8090/api/path), then publishes an ack
 * on `rdk/path/control/result`.
 *
 * We never reach the gateway directly. Instead we publish the command to AWS
 * IoT Core on `rdk/path/control`; the gateway's `clientdevices.mqtt.Bridge`
 * relays cloud→local (and local→cloud for the result) — the exact same path
 * the IPsec metrics ride, just in the command direction. This is why no
 * direct LAN reachability to 192.168.x is required.
 *
 * Connects to AWS IoT Core over MQTT-WebSocket with SigV4 auth (same creds /
 * endpoint as `ipsecSource`). Publishes a command and correlates the
 * component's ack back to the caller by a per-command `id`.
 */

import { mqtt, iot, auth } from 'aws-iot-device-sdk-v2';
import { EventEmitter } from 'node:events';

// Read lazily (at call time, not module-load) so values always reflect the
// loaded .env regardless of ESM import ordering — mirrors ipsecSource.
const endpoint = () => process.env.IOT_ENDPOINT ?? 'alht1i2bx8tzt-ats.iot.us-east-1.amazonaws.com';
const region   = () => process.env.IOT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
// Command topic the com.rdk.pathcontrol component subscribes to (via the
// bridge). The component publishes its ack on `${controlTopic}/result`.
const controlTopic = () => process.env.IOT_PATH_CONTROL_TOPIC ?? 'rdk/path/control';
const resultTopic  = () => process.env.IOT_PATH_RESULT_TOPIC  ?? `${controlTopic()}/result`;
const CLIENT_ID    = process.env.IOT_PATHCTL_CLIENT_ID ?? `ce-pathctl-${Math.random().toString(36).slice(2, 10)}`;

// How long to wait for the component's ack before giving up. The component
// applies the mode locally and publishes synchronously, so this is generous.
const ACK_TIMEOUT_MS = Number(process.env.IOT_PATH_ACK_TIMEOUT_MS ?? 10_000);

export type PathMode = 'auto' | 'fiber' | '5g';

/** Ack shape published by com.rdk.pathcontrol on the result topic. */
export interface PathControlResult {
  id?: string;
  ok: boolean;
  mode?: string;
  httpStatus?: number | null;
  error?: string;
  got?: unknown;
  ts?: number;
}

interface Pending {
  resolve: (r: PathControlResult) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

class PathControlSource extends EventEmitter {
  private connection?: mqtt.MqttClientConnection;
  private connecting?: Promise<void>;
  private connected = false;
  private lastError?: string;
  /** In-flight commands awaiting their ack, keyed by command id. */
  private pending = new Map<string, Pending>();

  /** True if AWS creds appear present (same gate ipsecSource uses). */
  hasCredentials(): boolean {
    return !!(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE);
  }

  /** Idempotent connect + subscribe to the result topic. Safe to call repeatedly. */
  async start(): Promise<void> {
    if (this.connected) return;
    if (this.connecting) return this.connecting;

    if (!this.hasCredentials()) {
      this.lastError = 'no-aws-credentials';
      // eslint-disable-next-line no-console
      console.warn('[pathctl] No AWS credentials in env (AWS_ACCESS_KEY_ID / AWS_PROFILE) — path-control publish will fail until creds are set.');
      throw new Error('no AWS credentials configured for path-control publish');
    }

    this.connecting = (async () => {
      try {
        const credentialsProvider = auth.AwsCredentialsProvider.newDefault();
        const builder = iot.AwsIotMqttConnectionConfigBuilder
          .new_with_websockets({ region: region(), credentials_provider: credentialsProvider });

        builder.with_endpoint(endpoint());
        builder.with_client_id(CLIENT_ID);
        builder.with_clean_session(true);
        builder.with_keep_alive_seconds(60);

        const client = new mqtt.MqttClient();
        this.connection = client.new_connection(builder.build());

        this.connection.on('connect', () => {
          this.connected = true;
          this.lastError = undefined;
          // eslint-disable-next-line no-console
          console.log(`[pathctl] connected to ${endpoint()} as ${CLIENT_ID}; publishing on "${controlTopic()}", listening for acks on "${resultTopic()}"`);
        });
        this.connection.on('interrupt', (err) => {
          this.connected = false;
          this.lastError = (err as { error?: string })?.error ?? String(err);
          // eslint-disable-next-line no-console
          console.warn('[pathctl] connection interrupted:', this.lastError);
        });
        this.connection.on('resume', () => {
          this.connected = true;
          this.lastError = undefined;
          // eslint-disable-next-line no-console
          console.log('[pathctl] connection resumed');
        });
        this.connection.on('disconnect', () => {
          this.connected = false;
          // eslint-disable-next-line no-console
          console.log('[pathctl] disconnected');
        });
        this.connection.on('error', (err) => {
          // eslint-disable-next-line no-console
          console.error('[pathctl] mqtt error:', err);
        });

        await this.connection.connect();
        await this.connection.subscribe(
          resultTopic(),
          mqtt.QoS.AtLeastOnce,
          (topic, payload) => this.handleResult(topic, payload),
        );
      } catch (err) {
        this.connected = false;
        this.lastError = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error('[pathctl] failed to connect/subscribe:', err);
        throw err;
      } finally {
        this.connecting = undefined;
      }
    })();

    return this.connecting;
  }

  private handleResult(topic: string, payload: ArrayBuffer): void {
    let result: PathControlResult;
    try {
      const text = new TextDecoder().decode(new Uint8Array(payload));
      result = JSON.parse(text) as PathControlResult;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[pathctl] unparseable ack on "${topic}":`, err);
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`[pathctl] ack on "${topic}":`, JSON.stringify(result));

    const id = result.id;
    if (!id) return; // unsolicited / un-correlatable ack — ignore
    const waiter = this.pending.get(id);
    if (!waiter) return; // ack for a command we're no longer waiting on
    clearTimeout(waiter.timer);
    this.pending.delete(id);
    waiter.resolve(result);
  }

  /**
   * Publish a path-control command to the component and resolve with its ack.
   * Rejects on connect/publish failure or if no ack arrives within the timeout
   * (a timeout does NOT guarantee the command wasn't applied — we just never
   * heard back).
   */
  async setMode(mode: PathMode): Promise<PathControlResult> {
    await this.start();
    if (!this.connection) throw new Error('path-control MQTT connection unavailable');

    const id = `dps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = JSON.stringify({ mode, id, ts: Date.now() });

    const ack = new Promise<PathControlResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timed out after ${ACK_TIMEOUT_MS}ms waiting for the gateway to acknowledge mode "${mode}"`));
      }, ACK_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
    });

    try {
      await this.connection.publish(controlTopic(), payload, mqtt.QoS.AtLeastOnce);
      // eslint-disable-next-line no-console
      console.log(`[pathctl] published to "${controlTopic()}": ${payload}`);
    } catch (err) {
      const waiter = this.pending.get(id);
      if (waiter) { clearTimeout(waiter.timer); this.pending.delete(id); }
      throw err instanceof Error ? err : new Error(String(err));
    }

    return ack;
  }

  status() {
    return {
      connected: this.connected,
      lastError: this.lastError,
      controlTopic: controlTopic(),
      resultTopic: resultTopic(),
      endpoint: endpoint(),
    };
  }

  isConnected() {
    return this.connected;
  }
}

export const pathControlSource = new PathControlSource();
