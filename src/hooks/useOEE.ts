import { useState, useEffect, useCallback, useRef } from "react";
import {
  isSiteWiseConfigured,
  fetchOEE,
  fetchOEETrend,
  type OEEResponse,
  type OEETrendPoint,
} from "../services/siteWiseService";
import { mockOEEMetrics, generateMockOEETrend } from "../data/mockData";
import { subscribeRawPLCPayload } from "../services/plcService";
import type { OEETimeRange } from "../types";

// Rolling buffer of live OEE samples. plc/data updates arrive at ~1–10 Hz;
// we sample at most one point per LIVE_POINT_INTERVAL_MS so the chart spans
// real time rather than the last few seconds of frames. MAX_LIVE_POINTS at
// the chosen interval gives a ~20-minute live window.
const LIVE_POINT_INTERVAL_MS = 5_000;
const MAX_LIVE_POINTS = 240;

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Build an OEEResponse from a raw MQTT payload shaped like the shift-rollup
 *  message the physical broker publishes on the PLC data topic:
 *    { OEE, availability, performance, quality,
 *      total_units_produced, uptime_in_minutes, downtime_in_minutes }
 *  Returns null when none of the OEE-shaped fields are present. */
function payloadToOEE(
  raw: Record<string, unknown> | null | undefined,
): OEEResponse | null {
  if (!raw) return null;
  const hasAny =
    typeof raw.OEE === "number" ||
    typeof raw.availability === "number" ||
    typeof raw.performance === "number" ||
    typeof raw.quality === "number";
  if (!hasAny) return null;

  const availability = typeof raw.availability === "number" ? raw.availability : 0;
  const performance  = typeof raw.performance  === "number" ? raw.performance  : 0;
  const quality      = typeof raw.quality      === "number" ? raw.quality      : 0;
  const oeeRaw       = typeof raw.OEE          === "number" ? raw.OEE
    : availability * performance * quality;

  // The bridge can publish incomplete/zero placeholders while the PLC has not
  // completed its first production roll-up. Do not let those placeholders
  // replace the seeded demo values (or flatten the trend to 0%) on startup.
  const totalUnits = typeof raw.total_units_produced === "number" ? raw.total_units_produced : 0;
  const uptimeMin = typeof raw.uptime_in_minutes === "number" ? raw.uptime_in_minutes : 0;
  const downtimeMin = typeof raw.downtime_in_minutes === "number" ? raw.downtime_in_minutes : 0;
  // A payload is only usable when every OEE pillar is a finite, positive
  // roll-up value. Partial PLC startup payloads must not overwrite the demo
  // values shown until the first complete roll-up arrives.
  const pillars = [oeeRaw, availability, performance, quality];
  if (pillars.some((value) => !Number.isFinite(value) || value <= 0)) return null;

  const totalCycles  = totalUnits;
  const goodCycles   = Math.round(totalCycles * quality);
  const rejectCycles = Math.max(0, totalCycles - goodCycles);

  const runTimeSec   = uptimeMin * 60;
  const plannedSec   = (uptimeMin + downtimeMin) * 60;

  return {
    machineId: "plant-live",
    timestamp: Date.now(),
    availability: { value: availability, percentage: pct(availability) },
    performance:  { value: performance,  percentage: pct(performance)  },
    quality:      { value: quality,      percentage: pct(quality)      },
    oee:          { value: oeeRaw,       percentage: pct(oeeRaw)       },
    totalCycles,
    goodCycles,
    rejectCycles,
    runTimeSec,
    plannedProductionTimeSec: plannedSec,
    shiftId: mockOEEMetrics.shiftId,
  };
}

export interface UseOEEResult {
  oee: OEEResponse | null;
  trend: OEETrendPoint[];
  loading: boolean;
  configured: boolean;
  trendTimeRange: OEETimeRange;
  setTrendTimeRange: (range: OEETimeRange) => void;
}

const TREND_HOURS: Record<OEETimeRange, number> = {
  shift: 8,
  "24h": 24,
  "7d": 168,
  "30d": 720,
};

export function useOEE(pollIntervalMs = 15_000): UseOEEResult {
  // Start with the seeded production snapshot so the dashboard never renders
  // an empty/zero frame while the first poll or MQTT message is settling.
  const [oee, setOee] = useState<OEEResponse | null>(() => ({
    machineId: mockOEEMetrics.machineId,
    timestamp: mockOEEMetrics.timestamp,
    availability: mockOEEMetrics.availability,
    performance: mockOEEMetrics.performance,
    quality: mockOEEMetrics.quality,
    oee: mockOEEMetrics.oee,
    totalCycles: mockOEEMetrics.totalCycles,
    goodCycles: mockOEEMetrics.goodCycles,
    rejectCycles: mockOEEMetrics.rejectCycles,
    runTimeSec: mockOEEMetrics.runTimeSec,
    plannedProductionTimeSec: mockOEEMetrics.plannedProductionTimeSec,
    shiftId: mockOEEMetrics.shiftId,
  }));
  const [trend, setTrend] = useState<OEETrendPoint[]>(() => generateMockOEETrend(24));
  const [liveTrend, setLiveTrend] = useState<OEETrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendTimeRange, setTrendTimeRange] = useState<OEETimeRange>("24h");
  const [liveActive, setLiveActive] = useState(false);
  const lastLivePointAtRef = useRef(0);
  const configured = isSiteWiseConfigured();

  // Subscribe to the raw MQTT payload from the Mosquitto bridge. Whenever the
  // broker publishes OEE-shaped fields on plc/data, they take precedence over
  // the polled/mock source below AND a sample is pushed into the live trend
  // buffer (rate-limited so the chart spans real time, not a 10-Hz blur).
  useEffect(() => {
    const unsubscribe = subscribeRawPLCPayload((payload) => {
      const live = payloadToOEE(payload as Record<string, unknown>);
      if (!live) return;
      setOee(live);
      setLiveActive(true);
      setLoading(false);

      const now = Date.now();
      if (now - lastLivePointAtRef.current >= LIVE_POINT_INTERVAL_MS) {
        lastLivePointAtRef.current = now;
        setLiveTrend((prev) => {
          const next = [
            ...prev,
            {
              timestamp: now,
              oee: live.oee.value,
              availability: live.availability.value,
              performance: live.performance.value,
              quality: live.quality.value,
            },
          ];
          return next.length > MAX_LIVE_POINTS
            ? next.slice(next.length - MAX_LIVE_POINTS)
            : next;
        });
      }
    });
    return unsubscribe;
  }, []);

  // Poll OEE metrics
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      // Live MQTT feed wins — don't clobber it with the polled/mock source.
      if (liveActive) return;
      setLoading(true);
      try {
        if (configured) {
          const resp = await fetchOEE();
          if (!cancelled && !liveActive) setOee(resp);
        } else {
          // Mock fallback
          if (!cancelled) {
            setOee({
              machineId: mockOEEMetrics.machineId,
              timestamp: Date.now(),
              availability: mockOEEMetrics.availability,
              performance: mockOEEMetrics.performance,
              quality: mockOEEMetrics.quality,
              oee: mockOEEMetrics.oee,
              totalCycles: mockOEEMetrics.totalCycles,
              goodCycles: mockOEEMetrics.goodCycles,
              rejectCycles: mockOEEMetrics.rejectCycles,
              runTimeSec: mockOEEMetrics.runTimeSec,
              plannedProductionTimeSec: mockOEEMetrics.plannedProductionTimeSec,
              shiftId: mockOEEMetrics.shiftId,
            });
          }
        }
      } catch {
        // Silent fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, pollIntervalMs);
    return () => { cancelled = true; clearInterval(interval); };
  }, [configured, pollIntervalMs, liveActive]);

  // Fetch trend when time range changes
  const loadTrend = useCallback(async () => {
    try {
      if (configured) {
        const points = await fetchOEETrend(trendTimeRange, "1h");
        setTrend(points);
      } else {
        setTrend(generateMockOEETrend(TREND_HOURS[trendTimeRange]));
      }
    } catch {
      setTrend(generateMockOEETrend(TREND_HOURS[trendTimeRange]));
    }
  }, [configured, trendTimeRange]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  // When live MQTT data is flowing, prefer the rolling live buffer over the
  // polled/mock trend. Fall back to the polled/mock trend before the first
  // live sample arrives, so the chart isn't empty on initial mount.
  const effectiveTrend =
    liveActive && liveTrend.length >= 2 ? liveTrend : trend;

  return {
    oee,
    trend: effectiveTrend,
    loading,
    configured,
    trendTimeRange,
    setTrendTimeRange,
  };
}
