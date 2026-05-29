/**
 * One-shot diagnostic: connect to AWS IoT, capture the first IPsec metrics
 * message, dump the raw bytes (hex + base64) and the fully-decoded result,
 * then exit. Lets us confirm whether the protobuf decode is correct without
 * touching the running server.
 *
 *   npx tsx scripts/ipsec-decode-probe.ts
 */
import { config } from 'dotenv';
config({ override: true });

import { mqtt, iot, auth } from 'aws-iot-device-sdk-v2';
import { decodeIpsecMetrics } from '../server/ipsecProto.js';

const endpoint = process.env.IOT_ENDPOINT ?? 'alht1i2bx8tzt-ats.iot.us-east-1.amazonaws.com';
const region   = process.env.IOT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const topic    = process.env.IOT_IPSEC_TOPIC ?? 'ipsec/metrics';
const clientId = `ipsec-probe-${Math.random().toString(36).slice(2, 10)}`;

async function main() {
  console.log(`[probe] connecting to ${endpoint} (${region}) as ${clientId}`);
  console.log(`[probe] topic = "${topic}"`);

  const credentialsProvider = auth.AwsCredentialsProvider.newDefault();
  const builder = iot.AwsIotMqttConnectionConfigBuilder.new_with_websockets({
    region,
    credentials_provider: credentialsProvider,
  });
  builder.with_endpoint(endpoint);
  builder.with_client_id(clientId);
  builder.with_clean_session(true);
  builder.with_keep_alive_seconds(60);

  const client = new mqtt.MqttClient();
  const connection = client.new_connection(builder.build());

  await connection.connect();
  console.log('[probe] connected — waiting for one message…');

  let done = false;
  await connection.subscribe(topic, mqtt.QoS.AtMostOnce, (t, payload) => {
    if (done) return;
    done = true;
    const bytes = new Uint8Array(payload);
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const b64 = Buffer.from(bytes).toString('base64');

    console.log(`\n[probe] === RAW (${bytes.length} bytes) on "${t}" ===`);
    console.log('hex   :', hex);
    console.log('base64:', b64);

    try {
      const decoded = decodeIpsecMetrics(bytes);
      console.log('\n[probe] === DECODED ===');
      console.log(JSON.stringify(decoded, null, 2));
    } catch (err) {
      console.error('\n[probe] DECODE FAILED:', err);
    }

    setTimeout(() => process.exit(0), 100);
  });

  // Safety timeout — exit if nothing arrives in 30s.
  setTimeout(() => {
    if (!done) {
      console.error('[probe] no message received within 30s — giving up.');
      process.exit(2);
    }
  }, 30_000);
}

main().catch((err) => {
  console.error('[probe] fatal:', err);
  process.exit(1);
});
