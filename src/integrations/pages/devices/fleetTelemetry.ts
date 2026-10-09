import type { DeviceView } from '../../ui/useDevices';
import { finite, withHistoryGaps, type DeviceHistory, type HistoryPoint } from './deviceMetrics';

const colors = ['#43d8f1', '#82b5f6', '#c7a4ed', '#e9bd70', '#6ed6a2', '#ef9eaa', '#56cbbb', '#a0d891', '#e5d476', '#edaa87'];
export function deviceTraceColor(mac: string) {
  let hash = 0;
  for (const char of mac.toUpperCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}

export interface TransferPoint { t: number; mb?: number }
/** Counter deltas only. A reset or missing counter breaks the series and rebases it. */
export function transferredData(points: HistoryPoint[]): TransferPoint[] {
  let previous: HistoryPoint | undefined;
  let total = 0;
  return points.map(point => {
    if (!finite(point.rxBytes) || !finite(point.txBytes) || point.rxBytes < 0 || point.txBytes < 0) {
      previous = undefined;
      return { t: point.t };
    }
    const prior = previous;
    previous = point;
    if (prior && finite(prior.rxBytes) && finite(prior.txBytes)) {
      if (point.rxBytes < prior.rxBytes || point.txBytes < prior.txBytes) return { t: point.t };
      total += point.rxBytes - prior.rxBytes + point.txBytes - prior.txBytes;
    }
    return { t: point.t, mb: total / 1_000_000 };
  });
}

export interface FleetTrace {
  key: string;
  device: DeviceView;
  color: string;
  signal: Array<{ t: number; value?: number }>;
  transfer: Array<{ t: number; value?: number }>;
}
export function fleetTraces(devices: DeviceView[], history: DeviceHistory): FleetTrace[] {
  return devices.map((device, index) => {
    const points = history[device.mac.toUpperCase()] ?? [];
    const transfer = new Map(transferredData(points).map(point => [point.t, point.mb]));
    const gaps = withHistoryGaps(points);
    return {
      key: `device${index}`, device, color: deviceTraceColor(device.mac),
      signal: device.conn === 'wifi' ? gaps.map(point => ({ t: point.t, value: point.rssiDbm })) : [],
      transfer: gaps.map(point => ({ t: point.t, value: transfer.get(point.t) })),
    };
  });
}

/** Shared time bins cap SVG work; each bin keeps its latest actual observation. */
export function fleetChartRows(traces: FleetTrace[], metric: 'signal' | 'transfer', maxBins = 180) {
  let start = Infinity, end = -Infinity;
  for (const trace of traces) for (const point of trace[metric]) {
    start = Math.min(start, point.t); end = Math.max(end, point.t);
  }
  if (!finite(start)) return [];
  const bucket = Math.max(1, Math.ceil((end - start + 1) / maxBins));
  const rows = new Map<number, { t: number; [key: string]: number | undefined }>();
  for (const trace of traces) {
    for (const point of trace[metric]) {
      const t = start + Math.floor((point.t - start) / bucket) * bucket;
      const row = rows.get(t) ?? { t };
      row[trace.key] = point.value;
      rows.set(t, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.t - b.t);
}
