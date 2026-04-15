/**
 * Ring buffer that accumulates live MQTT/PLC data in browser memory.
 *
 * Used by the analytics panel for short time ranges (1m, 5m) to avoid
 * hitting the SiteWise Lambda. For longer ranges, SiteWise is used.
 *
 * Buffer holds up to 600 entries (~10 minutes at 1 msg/sec).
 */

import { useRef, useCallback, useMemo } from "react";
import type { PLCParameter } from "../types";
import type { PLCOutputs } from "../services/plcService";

export interface BufferEntry {
  timestamp: number;
  values: Record<string, number>;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

const MAX_BUFFER_SIZE = 600; // ~10 minutes at 1 msg/sec

/** Extract numeric values from PLC params + outputs into a flat record */
function extractValues(params: PLCParameter[], outputs: PLCOutputs): Record<string, number> {
  const values: Record<string, number> = {};

  for (const p of params) {
    if (p.kind === "analog" && p.value !== undefined) {
      values[p.id] = p.value;
      if (p.id === "ph") values.pH = p.value;
    } else if (p.kind === "digital" && p.active !== undefined) {
      values[p.id] = p.active ? 1 : 0;
    }
  }

  // Relays
  for (let i = 0; i < outputs.relay.length; i++) {
    values[`relay_ch${i}`] = outputs.relay[i] ? 1 : 0;
  }

  // Alerts
  for (let i = 0; i < outputs.alerts.length; i++) {
    values[`alert_${i}`] = outputs.alerts[i] ? 1 : 0;
  }

  // Motor & emergency
  values.motor = outputs.motorFanOn ? 1 : 0;
  values.photoE_sensor = outputs.photoESensor ? 1 : 0;
  values.metal_sensor = outputs.metalSensor ? 1 : 0;
  values.push_button = outputs.pushButton ? 1 : 0;

  return values;
}

/**
 * Hook that maintains a ring buffer of PLC data.
 * Call `push()` on every PLC update, query with `getHistory()`.
 */
export function useMqttBuffer() {
  const bufferRef = useRef<BufferEntry[]>([]);

  const push = useCallback((params: PLCParameter[], outputs: PLCOutputs) => {
    const entry: BufferEntry = {
      timestamp: Date.now(),
      values: extractValues(params, outputs),
    };

    const buf = bufferRef.current;
    buf.push(entry);

    // Trim to max size
    if (buf.length > MAX_BUFFER_SIZE) {
      bufferRef.current = buf.slice(buf.length - MAX_BUFFER_SIZE);
    }
  }, []);

  const getHistory = useCallback(
    (property: string, durationMs: number): TimeSeriesPoint[] => {
      const now = Date.now();
      const cutoff = now - durationMs;
      const points: TimeSeriesPoint[] = [];

      for (const entry of bufferRef.current) {
        if (entry.timestamp >= cutoff && entry.values[property] !== undefined) {
          points.push({
            timestamp: entry.timestamp,
            value: entry.values[property],
          });
        }
      }

      return points;
    },
    []
  );

  const getBufferSize = useCallback(() => bufferRef.current.length, []);

  return useMemo(
    () => ({ push, getHistory, getBufferSize }),
    [push, getHistory, getBufferSize],
  );
}

export type MqttBuffer = ReturnType<typeof useMqttBuffer>;
