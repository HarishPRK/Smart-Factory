import { useState, useEffect } from "react";
import {
  isSiteWiseConfigured,
  fetchAlarms,
  type AlarmState,
} from "../services/siteWiseService";

export interface UseSiteWiseAlarmsResult {
  alarms: AlarmState[];
  activeCount: number;
  loading: boolean;
  configured: boolean;
}

export function useSiteWiseAlarms(pollIntervalMs = 10_000): UseSiteWiseAlarmsResult {
  const [alarms, setAlarms] = useState<AlarmState[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const configured = isSiteWiseConfigured();

  useEffect(() => {
    if (!configured) return;

    let cancelled = false;

    const poll = async () => {
      setLoading(true);
      try {
        const resp = await fetchAlarms();
        if (!cancelled) {
          setAlarms(resp.alarms);
          setActiveCount(resp.activeCount);
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

  return { alarms, activeCount, loading, configured };
}
