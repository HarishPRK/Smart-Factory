import { useState, useEffect, useCallback } from "react";
import {
  isSiteWiseConfigured,
  fetchOEE,
  fetchOEETrend,
  type OEEResponse,
  type OEETrendPoint,
} from "../services/siteWiseService";
import { mockOEEMetrics, generateMockOEETrend } from "../data/mockData";
import type { OEETimeRange } from "../types";

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
  const [oee, setOee] = useState<OEEResponse | null>(null);
  const [trend, setTrend] = useState<OEETrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendTimeRange, setTrendTimeRange] = useState<OEETimeRange>("24h");
  const configured = isSiteWiseConfigured();

  // Poll OEE metrics
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      setLoading(true);
      try {
        if (configured) {
          const resp = await fetchOEE();
          if (!cancelled) setOee(resp);
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
  }, [configured, pollIntervalMs]);

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

  return { oee, trend, loading, configured, trendTimeRange, setTrendTimeRange };
}
