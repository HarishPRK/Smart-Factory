import { useEffect, useState } from "react";
import { useMqttBufferContext } from "../context/PLCContext";
import { fetchHistory, isSiteWiseConfigured, type SiteWiseProperty } from "../services/siteWiseService";
import type { TimeSeriesPoint } from "./useMqttBuffer";

export type AnalyticsTimeRange = "1m" | "5m" | "30m" | "1h" | "6h" | "24h" | "7d";

export const ANALYTICS_RANGES: AnalyticsTimeRange[] = ["1m", "5m", "30m", "1h", "6h", "24h", "7d"];

export const ANALYTICS_RANGE_CONFIGS: Record<AnalyticsTimeRange, { durationMs: number; label: string; maxPoints: number }> = {
  "1m": { durationMs: 60_000, label: "Last minute", maxPoints: 600 },
  "5m": { durationMs: 300_000, label: "Last 5 minutes", maxPoints: 600 },
  "30m": { durationMs: 1_800_000, label: "Last 30 minutes", maxPoints: 500 },
  "1h": { durationMs: 3_600_000, label: "Last hour", maxPoints: 500 },
  "6h": { durationMs: 21_600_000, label: "Last 6 hours", maxPoints: 500 },
  "24h": { durationMs: 86_400_000, label: "Last 24 hours", maxPoints: 500 },
  "7d": { durationMs: 604_800_000, label: "Last 7 days", maxPoints: 500 },
};

export interface PLCAnalyticsHistory {
  points: TimeSeriesPoint[];
  loading: boolean;
  source: "mqtt" | "sitewise" | "mqtt+sitewise" | "unavailable";
  state: "ready" | "empty" | "unconfigured" | "error";
  /** Timestamp of the last measurement, never the time of a UI poll. */
  lastUpdated: number | null;
  windowStart: number;
  windowEnd: number;
  error: string | null;
}

interface HistorySnapshot extends PLCAnalyticsHistory {
  queryKey: string;
}

/** Merge actual measurement times; the latter source wins a shared timestamp. */
function mergePoints(sources: TimeSeriesPoint[][], start: number, end: number): TimeSeriesPoint[] {
  const byTimestamp = new Map<number, TimeSeriesPoint>();
  for (const points of sources) {
    for (const point of points) {
      if (!Number.isFinite(point.timestamp) || !Number.isFinite(point.value)) continue;
      if (point.timestamp < start || point.timestamp > end) continue;
      byTimestamp.set(point.timestamp, { timestamp: point.timestamp, value: point.value });
    }
  }
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
}

const REFRESH_MS: Record<AnalyticsTimeRange, number> = {
  "1m": 1000, "5m": 1000, "30m": 5000, "1h": 5000,
  "6h": 30_000, "24h": 60_000, "7d": 60_000,
};

/** Real PLC histories only. Missing hardware/history is an explicit empty state. */
export function usePLCAnalyticsHistory(
  property: SiteWiseProperty,
  range: AnalyticsTimeRange,
  offsetMs = 0,
): PLCAnalyticsHistory {
  const buffer = useMqttBufferContext();
  const config = ANALYTICS_RANGE_CONFIGS[range];
  const offset = Number.isFinite(offsetMs) ? Math.max(0, offsetMs) : 0;
  const queryKey = `${property}:${range}:${offset}`;
  const useMqtt = offset === 0 && (range === "1m" || range === "5m");
  const configured = isSiteWiseConfigured();
  const [snapshot, setSnapshot] = useState<HistorySnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const getWindow = () => {
      const windowEnd = Date.now() - offset;
      return { windowStart: windowEnd - config.durationMs, windowEnd };
    };
    const publish = (value: PLCAnalyticsHistory) => {
      if (!cancelled) setSnapshot({ ...value, queryKey });
    };

    if (useMqtt) {
      const poll = () => {
        const bounds = getWindow();
        const points = mergePoints([buffer.getHistory(property, config.durationMs)], bounds.windowStart, bounds.windowEnd);
        publish({
          ...bounds, points, loading: false,
          source: points.length ? "mqtt" : "unavailable",
          state: points.length ? "ready" : "empty",
          lastUpdated: points.at(-1)?.timestamp ?? null, error: null,
        });
      };
      poll();
      const interval = setInterval(poll, REFRESH_MS[range]);
      return () => { cancelled = true; clearInterval(interval); };
    }

    if (!configured) {
      publish({ ...getWindow(), points: [], loading: false, source: "unavailable", state: "unconfigured", lastUpdated: null, error: null });
      return () => { cancelled = true; };
    }

    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      const bounds = getWindow();
      setSnapshot((previous) => previous?.queryKey === queryKey
        ? { ...previous, loading: true }
        : { ...bounds, queryKey, points: [], loading: true, source: "unavailable", state: "empty", lastUpdated: null, error: null });
      try {
        const history = await fetchHistory(property, new Date(bounds.windowStart), new Date(bounds.windowEnd), config.maxPoints);
        if (cancelled) return;
        const tail = range === "30m" && offset === 0 ? buffer.getHistory(property, 300_000) : [];
        const historicalPoints = mergePoints([history], bounds.windowStart, bounds.windowEnd);
        const tailPoints = mergePoints([tail], bounds.windowStart, bounds.windowEnd);
        const tailTimes = new Set(tailPoints.map((point) => point.timestamp));
        const historicalContribution = historicalPoints.some((point) => !tailTimes.has(point.timestamp));
        const points = mergePoints([historicalPoints, tailPoints], bounds.windowStart, bounds.windowEnd);
        const source = tailPoints.length
          ? historicalContribution ? "mqtt+sitewise" : "mqtt"
          : historicalContribution ? "sitewise" : "unavailable";
        publish({
          ...bounds, points, loading: false,
          source,
          state: points.length ? "ready" : "empty",
          lastUpdated: points.at(-1)?.timestamp ?? null, error: null,
        });
      } catch (reason) {
        publish({
          ...bounds, points: [], loading: false, source: "unavailable", state: "error", lastUpdated: null,
          error: reason instanceof Error ? reason.message : "Historical readings could not be retrieved.",
        });
      } finally {
        inFlight = false;
      }
    };
    void load();
    const interval = setInterval(() => { void load(); }, REFRESH_MS[range]);
    return () => { cancelled = true; clearInterval(interval); };
  }, [buffer, config.durationMs, config.maxPoints, configured, offset, property, queryKey, range, useMqtt]);

  // Render a changed parameter/range immediately without exposing the prior
  // query's measurements while the new effect is scheduled.
  if (!snapshot || snapshot.queryKey !== queryKey) {
    const windowEnd = Date.now() - offset;
    return {
      points: [], loading: !useMqtt && configured, source: "unavailable",
      state: !useMqtt && !configured ? "unconfigured" : "empty",
      lastUpdated: null, windowStart: windowEnd - config.durationMs, windowEnd, error: null,
    };
  }
  return {
    points: snapshot.points, loading: snapshot.loading, source: snapshot.source,
    state: snapshot.state, lastUpdated: snapshot.lastUpdated,
    windowStart: snapshot.windowStart, windowEnd: snapshot.windowEnd, error: snapshot.error,
  };
}
