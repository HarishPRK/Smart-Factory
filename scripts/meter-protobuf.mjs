/** Shared decoder for proto/meter.proto; doubles use little-endian wire type 1. */
export function decodeMeterData(bytes) {
  if (bytes.byteLength > 65_536) throw new Error('Meter packet exceeds the 64 KiB limit.')
  const result = { voltage: 0, frequency: 0, power_factor: 0, current: 0 }
  const fields = ['voltage', 'frequency', 'power_factor', 'current']
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0
  let knownFields = 0
  const requireBytes = (count) => {
    if (count > bytes.byteLength - offset) throw new Error('Truncated MeterData protobuf payload.')
  }
  const varint = () => {
    let value = 0n
    for (let i = 0; i < 10; i++) {
      requireBytes(1)
      const byte = bytes[offset++]
      if (i === 9 && byte > 1) throw new Error('Invalid protobuf varint.')
      value |= BigInt(byte & 0x7f) << BigInt(i * 7)
      if (!(byte & 0x80)) return value
    }
    throw new Error('Invalid protobuf varint.')
  }
  while (offset < bytes.byteLength) {
    const tagValue = varint()
    if (tagValue > 0xffffffffn) throw new Error('Invalid protobuf field tag.')
    const tag = Number(tagValue)
    const field = Math.floor(tag / 8)
    const wire = tag & 7
    if (field === 0) throw new Error('Invalid protobuf field number zero.')
    if (field <= 4) {
      if (wire !== 1) throw new Error(`MeterData field ${field} must be a double (wire type 1).`)
      requireBytes(8)
      const value = view.getFloat64(offset, true)
      if (!Number.isFinite(value)) throw new Error(`MeterData field ${field} must be finite.`)
      result[fields[field - 1]] = value
      offset += 8
      knownFields++
    } else {
      // Skip future fields; bound every read so a bad payload cannot hang the UI.
      let length
      switch (wire) {
        case 0: varint(); continue
        case 1: length = 8; break
        case 2: {
          const size = varint()
          if (size > BigInt(bytes.byteLength - offset)) throw new Error('Truncated protobuf field.')
          length = Number(size)
          break
        }
        case 5: length = 4; break
        default: throw new Error(`Unsupported protobuf wire type ${wire}.`)
      }
      requireBytes(length)
      offset += length
    }
  }
  // Empty is the valid proto3 all-zero message. Nonempty foreign schemas are not telemetry.
  if (bytes.byteLength && !knownFields) throw new Error('No MeterData fields in protobuf payload.')
  return result
}

