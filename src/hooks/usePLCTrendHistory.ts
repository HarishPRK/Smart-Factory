import { createHourlyPreviewSeries } from "../components/analytics/hourlyPreviewSeries";
import type { SiteWiseProperty } from "../services/siteWiseService";
import { usePLCAnalyticsHistory, type AnalyticsTimeRange, type PLCAnalyticsHistory } from "./usePLCAnalyticsHistory";

export type PLCTrendHistory = Omit<PLCAnalyticsHistory, "source"> & {
  source: PLCAnalyticsHistory["source"] | "hourly-preview";
};

/** Preview readings are confined to the empty hourly analytics trend. */
export function usePLCTrendHistory(property: SiteWiseProperty, range: AnalyticsTimeRange): PLCTrendHistory {
  const history = usePLCAnalyticsHistory(property, range);
  if (range !== "1h" || history.loading || history.points.length > 0) return history;

  // Independently mounted trends share the same preview samples during a tick.
  const windowEnd = Math.floor(history.windowEnd / 15_000) * 15_000;
  const windowStart = windowEnd - 3_600_000;
  const points = createHourlyPreviewSeries(property, windowStart, windowEnd);
  if (points.length === 0) return history;

  return { ...history, points, windowStart, windowEnd, source: "hourly-preview", state: "ready", lastUpdated: null, error: null };
}
