/** Preserve binary meter/data bytes across the shared JSON WebSocket bridge. */
export function createMeterFrame(topic, bytes, publishedAt = Date.now(), retained = false) {
  if (bytes.byteLength > 65_536) throw new Error('Meter packet exceeds the 64 KiB limit.');
  const buffer = Buffer.from(bytes);
  let payload;
  try {
    // Keep the original JSON firmware compatible during the protobuf rollout.
    payload = JSON.parse(buffer.toString('utf8'));
  } catch {
    return JSON.stringify({ topic, encoding: 'protobuf', payload: buffer.toString('base64'), publishedAt, retained });
  }
  return JSON.stringify({ topic, payload, publishedAt, retained });
}
