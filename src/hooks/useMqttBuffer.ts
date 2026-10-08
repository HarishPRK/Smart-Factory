/**
 * Ring buffer that accumulates live MQTT/PLC data in browser memory.
 *
 * Used by the analytics panel for short time ranges (1m, 5m) to avoid
 * hitting the SiteWise Lambda. For longer ranges, SiteWise is used.
 *
 * Each physical channel keeps up to 600 genuine receipts. Unrelated board
 * messages must not turn cached readings into new measurements.
 */

import { useRef, useCallback, useMemo } from "react";
import type { PLCParameter } from "../types";
import type { PLCOutputs } from "../services/plcService";
import { isReceivedParameter } from "../services/receivedTelemetry";

export interface BufferEntry {
  timestamp: number;
  values: Record<string, number>;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

const MAX_BUFFER_SIZE = 600; // ~10 minutes at 1 msg/sec

/** Extract received values together with the originating channel receipt. */
function extractValues(params: PLCParameter[], outputs: PLCOutputs, frameReceivedAt: number): Record<string, TimeSeriesPoint> {
  const values: Record<string, TimeSeriesPoint> = {};
  const putReceipt = (id: string, value: number, timestamp: number) => {
    if (Number.isFinite(timestamp) && Number.isFinite(value)) values[id] = { timestamp, value };
  };
  const put = (id: string, value: number, param: PLCParameter) => {
    const timestamp = param.receivedAt ?? frameReceivedAt;
    putReceipt(id, value, timestamp);
  };

  for (const p of params) {
    if (!isReceivedParameter(p)) continue;
    if (p.kind === "analog" && p.value !== undefined) {
      put(p.id, p.value, p);
      if (p.id === "ph") put("pH", p.value, p);
    } else if (p.kind === "digital" && p.active !== undefined) {
      put(p.id, p.active ? 1 : 0, p);
    }
  }

  // Relay/alert arrays include default false bits. Record only per-bit physical
  // receipts; aggregate relay availability cannot establish every channel.
  for (const [id, bit] of Object.entries(outputs.receivedBits ?? {})) {
    if (typeof bit.value === "boolean") putReceipt(id, bit.value ? 1 : 0, bit.receivedAt);
  }

  const known = (id: string) => params.find((p) => p.id === id && isReceivedParameter(p));
  // Motor & emergency
  const photoE = known("photoE");
  const metal = known("metal");
  if (photoE) put("photoE_sensor", outputs.photoESensor ? 1 : 0, photoE);
  if (metal) put("metal_sensor", outputs.metalSensor ? 1 : 0, metal);

  return values;
}

/**
 * Hook that maintains a ring buffer of PLC data.
 * Call `push()` on every PLC update, query with `getHistory()`.
 */
export function useMqttBuffer() {
  const bufferRef = useRef<Record<string, TimeSeriesPoint[]>>({});
  const receiptCountRef = useRef(0);

  const push = useCallback((params: PLCParameter[], outputs: PLCOutputs, receivedAt = Date.now()) => {
    const values = extractValues(params, outputs, receivedAt);
    let received = false;
    for (const [property, point] of Object.entries(values)) {
      const history = bufferRef.current[property] ?? [];
      const latest = history[history.length - 1];
      // Partial payloads retain each channel's receipt timestamp. An older or
      // repeated receipt is not a fresh sample, even when other channels arrive.
      if (latest && point.timestamp < latest.timestamp) continue;
      if (latest && point.timestamp === latest.timestamp) {
        if (point.value !== latest.value) history[history.length - 1] = point;
        continue;
      }
      bufferRef.current[property] = [...history, point].slice(-MAX_BUFFER_SIZE);
      received = true;
    }
    if (received) receiptCountRef.current = Math.min(MAX_BUFFER_SIZE, receiptCountRef.current + 1);
  }, []);

  const getHistory = useCallback(
    (property: string, durationMs: number): TimeSeriesPoint[] => {
      const now = Date.now();
      const cutoff = now - durationMs;
      return (bufferRef.current[property] ?? [])
        .filter((point) => point.timestamp >= cutoff && point.timestamp <= now)
        .map((point) => ({ ...point }));
    },
    []
  );

  const getBufferSize = useCallback(() => receiptCountRef.current, []);

  return useMemo(
    () => ({ push, getHistory, getBufferSize }),
    [push, getHistory, getBufferSize],
  );
}

export type MqttBuffer = ReturnType<typeof useMqttBuffer>;
