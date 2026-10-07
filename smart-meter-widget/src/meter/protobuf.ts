import { decodeMeterData } from '../../../scripts/meter-protobuf.mjs'
export { decodeMeterData }
export type { MeterData } from '../../../scripts/meter-protobuf.mjs'

/** Older JSON firmware remains supported. Never interpret protobuf bytes as UTF-8. */
export function decodeMeterBytes(bytes: Uint8Array): unknown {
  const first = bytes.find(byte => ![9, 10, 13, 32].includes(byte))
  if (first === 123 || first === 91) {
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { /* May be binary double bytes that resemble JSON. */ }
  }
  // This feed now supplies matching voltage/current for its single-phase measurement.
  return { ...decodeMeterData(bytes), power_model: 'single_phase' }
}

export function decodeMeterBase64(payload: unknown): ReturnType<typeof decodeMeterBytes> {
  if (typeof payload !== 'string' || payload.length > 87_384 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)) {
    throw new Error('Invalid base64 MeterData payload.')
  }
  const raw = atob(payload)
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0))
  return { ...decodeMeterData(bytes), power_model: 'single_phase' }
}
