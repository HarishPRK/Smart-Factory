/**
 * Frontend service for querying SiteWise historical data via the
 * sitewise-query Lambda behind API Gateway.
 *
 * Falls back to mock data when VITE_SITEWISE_API_URL is not configured.
 */

const API_URL = import.meta.env.VITE_SITEWISE_API_URL as string | undefined;

/* ── Types ───────────────────────────────────────────── */

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  quality?: string;
}

export interface AggregationBucket {
  timestamp: number;
  average?: number;
  maximum?: number;
  minimum?: number;
  count?: number;
}

export interface LatestValue {
  value: number | null;
  timestamp: number | null;
  quality?: string;
}

export type SiteWiseProperty =
  | "voltage" | "current" | "temperature" | "pH"
  | "photoE_sensor" | "metal_sensor" | "push_button" | "motor"
  | `relay_ch${number}`
  | `alert_${number}`;

/* ── API calls ───────────────────────────────────────── */

async function query<T>(params: Record<string, string>): Promise<T> {
  if (!API_URL) {
    throw new Error("VITE_SITEWISE_API_URL not configured — using mock data");
  }

  const url = new URL(API_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${resp.status}`);
  }
  return resp.json();
}

/**
 * Fetch raw time-series history for a property.
 */
export async function fetchHistory(
  property: SiteWiseProperty,
  startDate: Date,
  endDate: Date,
  maxResults = 500
): Promise<TimeSeriesPoint[]> {
  const resp = await query<{ points: TimeSeriesPoint[] }>({
    action: "history",
    property,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    maxResults: String(maxResults),
  });
  return resp.points;
}

/**
 * Fetch aggregated values (avg, max, min, count) for a property.
 */
export async function fetchAggregates(
  property: SiteWiseProperty,
  startDate: Date,
  endDate: Date,
  resolution = "1h"
): Promise<AggregationBucket[]> {
  const resp = await query<{ buckets: AggregationBucket[] }>({
    action: "aggregates",
    property,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    resolution,
  });
  return resp.buckets;
}

/**
 * Fetch the latest value for a single property.
 */
export async function fetchLatest(
  property: SiteWiseProperty
): Promise<LatestValue> {
  return query<LatestValue>({ action: "latest", property });
}

/**
 * Fetch latest values for multiple properties in one call.
 */
export async function fetchBatch(
  properties: SiteWiseProperty[]
): Promise<Record<string, LatestValue>> {
  const resp = await query<{ results: Record<string, LatestValue> }>({
    action: "batch",
    properties: properties.join(","),
  });
  return resp.results;
}

/**
 * Fetch SiteWise auto-computed metrics for a property.
 * Returns avg_1h, max_1h for analog sensors; toggle_count_1h for digital.
 */
export interface MetricsResult {
  avg_1h?: { value: number | null; timestamp: number | null };
  max_1h?: { value: number | null; timestamp: number | null };
  toggle_count_1h?: { value: number | null; timestamp: number | null };
}

export async function fetchMetrics(
  property: SiteWiseProperty
): Promise<MetricsResult> {
  const resp = await query<{ metrics: MetricsResult }>({
    action: "metrics",
    property,
  });
  return resp.metrics;
}

/**
 * Fetch SiteWise alarm states (threshold evaluations).
 */
export interface AlarmState {
  alarmId: string;
  label: string;
  property: string;
  state: "ACTIVE" | "NORMAL";
  severity: number;
  threshold: { operator: string; value: number };
  currentValue: number | null;
  timestamp: number | null;
}

export interface AlarmsResponse {
  alarms: AlarmState[];
  activeCount: number;
  total: number;
}

export async function fetchAlarms(): Promise<AlarmsResponse> {
  return query<AlarmsResponse>({ action: "alarms" });
}

/* ── OEE ────────────────────────────────────────────── */

export interface OEEResponse {
  machineId: string;
  availability: { value: number; percentage: string };
  performance: { value: number; percentage: string };
  quality: { value: number; percentage: string };
  oee: { value: number; percentage: string };
  totalCycles: number;
  goodCycles: number;
  rejectCycles: number;
  runTimeSec: number;
  plannedProductionTimeSec: number;
  shiftId: string;
  timestamp: number;
}

export interface OEETrendPoint {
  timestamp: number;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

/**
 * Fetch current-shift OEE metrics (Availability, Performance, Quality).
 */
export async function fetchOEE(): Promise<OEEResponse> {
  return query<OEEResponse>({ action: "oee" });
}

/**
 * Fetch OEE trend data over a time range.
 */
export async function fetchOEETrend(
  timeRange: string,
  resolution?: string
): Promise<OEETrendPoint[]> {
  const resp = await query<{ points: OEETrendPoint[] }>({
    action: "oee-trend",
    timeRange,
    resolution: resolution ?? "1h",
  });
  return resp.points;
}

/* ── Availability check ──────────────────────────────── */

/**
 * Returns true if the SiteWise API URL is configured.
 * Components use this to decide whether to show real data or mock fallback.
 */
export function isSiteWiseConfigured(): boolean {
  return Boolean(API_URL);
}
