import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteWiseProperty } from "../services/siteWiseService";
import { type AnalyticsTimeRange, type PLCAnalyticsHistory } from "./usePLCAnalyticsHistory";
import { usePLCTrendHistory } from "./usePLCTrendHistory";

const fixtures = vi.hoisted(() => ({ useHistory: vi.fn() }));

vi.mock("./usePLCAnalyticsHistory", () => ({ usePLCAnalyticsHistory: fixtures.useHistory }));

function unavailableHistory(overrides: Partial<PLCAnalyticsHistory> = {}): PLCAnalyticsHistory {
  return {
    points: [], loading: false, source: "unavailable", state: "unconfigured",
    lastUpdated: null, windowStart: 96_400_000, windowEnd: 100_000_000, error: null,
    ...overrides,
  };
}

beforeEach(() => { fixtures.useHistory.mockReset().mockReturnValue(unavailableHistory()); });
afterEach(cleanup);

describe("hourly analytics trend preview", () => {
  it("passes the selected property and range unchanged to received history", () => {
    renderHook(() => usePLCTrendHistory("temperature", "1h"));
    expect(fixtures.useHistory).toHaveBeenCalledWith("temperature", "1h");
  });

  it("preserves real readings by identity, including flat zero values", () => {
    const history = unavailableHistory({
      points: [{ timestamp: 99_999_000, value: 0 }, { timestamp: 100_000_000, value: 0 }],
      source: "sitewise", state: "ready", lastUpdated: 100_000_000,
    });
    fixtures.useHistory.mockReturnValue(history);
    const { result } = renderHook(() => usePLCTrendHistory("voltage", "1h"));
    expect(result.current).toBe(history);
    expect(result.current.points.map((point) => point.value)).toEqual([0, 0]);
  });

  it.each<AnalyticsTimeRange>(["1m", "5m", "30m", "6h", "24h", "7d"])(
    "keeps unavailable %s history unchanged",
    (range) => {
      const history = unavailableHistory();
      fixtures.useHistory.mockReturnValue(history);
      const { result } = renderHook(() => usePLCTrendHistory("voltage", range));
      expect(result.current).toBe(history);
    },
  );

  it("waits for the real historian request to finish", () => {
    const history = unavailableHistory({ loading: true, state: "empty" });
    fixtures.useHistory.mockReturnValue(history);
    const { result, rerender } = renderHook(() => usePLCTrendHistory("voltage", "1h"));
    expect(result.current).toBe(history);
    fixtures.useHistory.mockReturnValue({ ...history, loading: false });
    rerender();
    expect(result.current.source).toBe("hourly-preview");
    expect(result.current.points.length).toBeGreaterThan(1);
  });

  it.each<SiteWiseProperty>(["voltage", "current", "temperature", "pH"])(
    "provides a fluctuating hourly preview for unavailable %s",
    (property) => {
      const history = unavailableHistory({ state: "error", error: "History unavailable" });
      fixtures.useHistory.mockReturnValue(history);
      const { result } = renderHook(() => usePLCTrendHistory(property, "1h"));
      expect(result.current).toMatchObject({
        source: "hourly-preview", state: "ready", loading: false, lastUpdated: null, error: null,
        windowStart: 96_390_000, windowEnd: 99_990_000,
      });
      expect(result.current.points.length).toBeGreaterThan(1);
      expect(new Set(result.current.points.map((point) => point.value)).size).toBeGreaterThan(1);
      expect(result.current.points.every((point) => point.timestamp >= result.current.windowStart && point.timestamp <= result.current.windowEnd)).toBe(true);
      expect(history.points).toEqual([]);
      expect(history.error).toBe("History unavailable");
    },
  );

  it("synchronizes separate hourly queries within the same preview tick", () => {
    fixtures.useHistory
      .mockReturnValueOnce(unavailableHistory())
      .mockReturnValueOnce(unavailableHistory({ windowStart: 96_400_100, windowEnd: 100_000_100 }));
    const channel = renderHook(() => usePLCTrendHistory("voltage", "1h"));
    const main = renderHook(() => usePLCTrendHistory("voltage", "1h"));
    expect(channel.result.current).toMatchObject({ windowStart: 96_390_000, windowEnd: 99_990_000 });
    expect(main.result.current.windowStart).toBe(channel.result.current.windowStart);
    expect(main.result.current.windowEnd).toBe(channel.result.current.windowEnd);
    expect(main.result.current.points).toEqual(channel.result.current.points);
    expect(main.result.current.points.at(-1)).toEqual(channel.result.current.points.at(-1));
  });

  it.each<SiteWiseProperty>(["photoE_sensor", "metal_sensor", "push_button", "motor", "relay_ch1", "alert_1"])(
    "keeps unavailable hourly %s history unchanged",
    (property) => {
      const history = unavailableHistory();
      fixtures.useHistory.mockReturnValue(history);
      const { result } = renderHook(() => usePLCTrendHistory(property, "1h"));
      expect(result.current).toBe(history);
    },
  );

  it("replaces preview immediately when real history recovers", () => {
    const { result, rerender } = renderHook(() => usePLCTrendHistory("current", "1h"));
    expect(result.current.source).toBe("hourly-preview");
    const history = unavailableHistory({
      points: [{ timestamp: 100_000_000, value: 2.4 }],
      source: "sitewise", state: "ready", lastUpdated: 100_000_000,
    });
    fixtures.useHistory.mockReturnValue(history);
    rerender();
    expect(result.current).toBe(history);
  });

  it("removes hourly preview immediately when the range changes", () => {
    const history = unavailableHistory();
    fixtures.useHistory.mockReturnValue(history);
    const { result, rerender } = renderHook(
      ({ range }: { range: AnalyticsTimeRange }) => usePLCTrendHistory("voltage", range),
      { initialProps: { range: "1h" as AnalyticsTimeRange } },
    );
    expect(result.current.source).toBe("hourly-preview");
    rerender({ range: "5m" });
    expect(result.current).toBe(history);
  });
});
