import type { Device, DeviceInventorySource, Status } from '../../types';
import type { UseDevicesResult } from '../../ui/useDevices';
import { BRANCH_TO_DEVICE_SOURCE, BRANCH_TO_IPSEC_SOURCE } from '../../data/mock';

export type DeviceBranch = 'b-mck-03' | 'b-pln-01';
export const statusNames: Record<Status, string> = { ok: 'Healthy', warn: 'Degraded', err: 'Offline', off: 'Inactive' };
export const transportNames: Record<Device['conn'], string> = { wifi: 'Wi-Fi', wired: 'Ethernet', poe: 'PoE', thread: 'Thread' };
export const statusOrder: Record<Status, number> = { err: 0, warn: 1, off: 2, ok: 3 };
export const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function scopeInventory(snapshot: UseDevicesResult, branch: DeviceBranch, domain: 'IT' | 'OT') {
  const feed: DeviceInventorySource = BRANCH_TO_DEVICE_SOURCE[branch];
  // Older backends expose location only. An explicit feed always wins over that fallback.
  const devices = snapshot.source === 'gateway' ? snapshot.devices.filter(device => device.domain === domain &&
    (device.inventorySource ? device.inventorySource === feed : device.locationSource === BRANCH_TO_IPSEC_SOURCE[branch])) : [];
  const received = snapshot.source === 'gateway' && (snapshot.inventorySourcesSeen.includes(feed) || devices.length > 0);
  return { devices, feed, received, timestamp: snapshot.lastInventoryAtBySource[feed] };
}

export function duration(hours: number | undefined) {
  if (!finite(hours) || hours < 0) return '—';
  if (hours < 1) return `${Math.floor(hours * 60)}m`;
  if (hours < 24) return `${Math.floor(hours)}h ${Math.floor(hours % 1 * 60)}m`;
  return `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h`;
}

export function measurement(value: number | undefined, digits = 1) {
  return finite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
}

export const signalBands = [
  { key: 'strong', label: 'Strong', range: '≥ −60 dBm', color: 'var(--ok)' },
  { key: 'fair', label: 'Fair', range: '−75 to −60', color: 'var(--accent)' },
  { key: 'weak', label: 'Weak', range: '< −75 dBm', color: 'var(--warn)' },
] as const;
export function signalBand(value: number | undefined) {
  if (!finite(value)) return 'unknown';
  return value >= -60 ? 'strong' : value >= -75 ? 'fair' : 'weak';
}

export interface HistoryPoint {
  t: number;
  rxMbps?: number;
  txMbps?: number;
  rssiDbm?: number;
  apowerW?: number;
  rxBytes?: number;
  txBytes?: number;
}
export type DeviceHistory = Record<string, HistoryPoint[]>;

export function parseHistory(value: unknown): DeviceHistory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([mac, rows]) => {
    const byTime = new Map<number, HistoryPoint>();
    if (Array.isArray(rows)) for (const row of rows) {
      if (!row || !finite(row.t) || row.t <= 0) continue;
      const point: HistoryPoint = { t: row.t };
      for (const key of ['rxMbps', 'txMbps', 'rssiDbm', 'apowerW', 'rxBytes', 'txBytes'] as const) {
        if (finite(row[key])) point[key] = row[key];
      }
      byTime.set(point.t, point);
    }
    return [mac.toUpperCase(), [...byTime.values()].sort((a, b) => a.t - b.t)];
  }));
}

/** Preserve outages rather than joining a straight line across missing samples. */
export function withHistoryGaps(points: HistoryPoint[]) {
  const deltas = points.slice(1).map((p, i) => p.t - points[i].t).filter(delta => delta > 0).sort((a, b) => a - b);
  const cadence = deltas.length ? deltas[Math.floor((deltas.length - 1) / 2)] : 10_000;
  const gap = Math.max(30_000, cadence * 3);
  return points.flatMap((point, i) => i && point.t - points[i - 1].t > gap ? [{ t: points[i - 1].t + 1 }, point] : [point]);
}
