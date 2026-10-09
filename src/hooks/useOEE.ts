import { useState, useEffect, useRef } from "react";
import { isSiteWiseConfigured, fetchOEE, fetchOEETrend, type OEEResponse, type OEETrendPoint } from "../services/siteWiseService";
import { subscribeRawPLCPayload } from "../services/plcService";
import type { OEETimeRange } from "../types";

const LIVE_POINT_INTERVAL_MS = 5_000;
const MAX_LIVE_POINTS = 240;
const TREND_HOURS: Record<OEETimeRange, number> = { shift: 8, "24h": 24, "7d": 168, "30d": 720 };
const pct = (value: number) => ({ value, percentage: `${(value * 100).toFixed(1)}%` });

/** Only complete rollups are measurements. A legitimate zero is still data. */
export function payloadToOEE(raw: Record<string, unknown> | null | undefined): OEEResponse | null {
  if (!raw) return null;
  const factors = [raw.availability, raw.performance, raw.quality];
  if (!factors.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1)) return null;
  const [availability, performance, quality] = factors as number[];
  const overall = raw.OEE === undefined ? availability * performance * quality : raw.OEE;
  if (typeof overall !== "number" || !Number.isFinite(overall) || overall < 0 || overall > 1) return null;
  const nonnegative = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
  const totalCycles = nonnegative(raw.total_units_produced);
  const goodCycles = Math.round(totalCycles * quality);
  const uptime = nonnegative(raw.uptime_in_minutes);
  const downtime = nonnegative(raw.downtime_in_minutes);
  return {
    machineId: "plant-live", timestamp: Date.now(),
    availability: pct(availability), performance: pct(performance), quality: pct(quality), oee: pct(overall),
    totalCycles, goodCycles, rejectCycles: Math.max(0, totalCycles - goodCycles),
    runTimeSec: uptime * 60, plannedProductionTimeSec: (uptime + downtime) * 60,
    shiftId: typeof raw.shiftId === "string" ? raw.shiftId : "Not reported",
  };
}

export interface UseOEEResult {
  oee: OEEResponse | null;
  trend: OEETrendPoint[];
  loading: boolean;
  configured: boolean;
  source: "plc" | "historian" | "waiting";
  trendSource: "historian" | "session" | "waiting";
  trendLoading: boolean;
  trendTimeRange: OEETimeRange;
  setTrendTimeRange: (range: OEETimeRange) => void;
}

export function useOEE(pollIntervalMs = 15_000): UseOEEResult {
  const configured = isSiteWiseConfigured();
  const [oee, setOee] = useState<OEEResponse | null>(null);
  const [source, setSource] = useState<UseOEEResult["source"]>("waiting");
  const [history, setHistory] = useState<OEETrendPoint[]>([]);
  const [liveTrend, setLiveTrend] = useState<OEETrendPoint[]>([]);
  const [loading, setLoading] = useState(configured);
  const [trendLoading, setTrendLoading] = useState(configured);
  const [trendTimeRange, setTrendTimeRange] = useState<OEETimeRange>("24h");
  const lastLivePoint = useRef<number | null>(null);
  const liveActive = useRef(false);

  useEffect(() => subscribeRawPLCPayload((payload) => {
    const live = payloadToOEE(payload as Record<string, unknown>);
    if (!live) return;
    liveActive.current = true;
    setOee(live); setSource("plc"); setLoading(false);
    const now = live.timestamp;
    if (lastLivePoint.current === null || now - lastLivePoint.current >= LIVE_POINT_INTERVAL_MS) {
      lastLivePoint.current = now;
      setLiveTrend((previous) => [...previous, {
        timestamp: now, oee: live.oee.value, availability: live.availability.value,
        performance: live.performance.value, quality: live.quality.value,
      }].slice(-MAX_LIVE_POINTS));
    }
  }), []);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const poll = async () => {
      if (liveActive.current) return;
      try {
        const response = await fetchOEE();
        if (!cancelled && !liveActive.current) { setOee(response); setSource("historian"); }
      } catch { /* Keep the last received snapshot; never substitute generated readings. */ }
      finally { if (!cancelled) setLoading(false); }
    };
    void poll();
    const timer = setInterval(poll, pollIntervalMs);
    return () => { cancelled = true; clearInterval(timer); };
  }, [configured, pollIntervalMs]);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    setHistory([]); setTrendLoading(true);
    const load = async () => {
      try {
        const points = await fetchOEETrend(trendTimeRange, trendTimeRange === "shift" ? "5m" : "1h");
        if (!cancelled) setHistory(points);
      } catch { /* Live history remains available if the historian cannot be reached. */ }
      finally { if (!cancelled) setTrendLoading(false); }
    };
    void load();
    const timer = setInterval(load, pollIntervalMs);
    return () => { cancelled = true; clearInterval(timer); };
  }, [configured, trendTimeRange, pollIntervalMs]);

  const cutoff = Date.now() - TREND_HOURS[trendTimeRange] * 3_600_000;
  const points = new Map<number, OEETrendPoint>();
  for (const point of [...history, ...liveTrend]) {
    if (point.timestamp >= cutoff && Number.isFinite(point.timestamp)
      && [point.oee, point.availability, point.performance, point.quality].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) points.set(point.timestamp, point);
  }
  return {
    oee, trend: [...points.values()].sort((a, b) => a.timestamp - b.timestamp), loading, configured, source,
    trendSource: history.length ? "historian" : liveTrend.length ? "session" : "waiting",
    trendLoading, trendTimeRange, setTrendTimeRange,
  };
}
