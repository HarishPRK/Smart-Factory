import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePLCAnalyticsHistory, type AnalyticsTimeRange } from "./usePLCAnalyticsHistory";
import type { SiteWiseProperty } from "../services/siteWiseService";

const fixtures = vi.hoisted(() => ({
  configured: false,
  getHistory: vi.fn(),
  fetchHistory: vi.fn(),
}));
const buffer = { getHistory: fixtures.getHistory };

vi.mock("../context/PLCContext", () => ({ useMqttBufferContext: () => buffer }));
vi.mock("../services/siteWiseService", () => ({
  isSiteWiseConfigured: () => fixtures.configured,
  fetchHistory: fixtures.fetchHistory,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000_000);
  fixtures.configured = false;
  fixtures.getHistory.mockReset().mockReturnValue([]);
  fixtures.fetchHistory.mockReset().mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("received PLC analytics history", () => {
  it("shows empty short history without generating sample readings", () => {
    const { result } = renderHook(() => usePLCAnalyticsHistory("voltage", "1m"));
    expect(result.current).toMatchObject({ points: [], state: "empty", source: "unavailable", loading: false, lastUpdated: null });
    expect(fixtures.fetchHistory).not.toHaveBeenCalled();
  });

  it("preserves actual zero and measurement time while UI polls advance", () => {
    fixtures.getHistory.mockReturnValue([{ timestamp: 99_990_000, value: 0 }]);
    const { result } = renderHook(() => usePLCAnalyticsHistory("voltage", "1m"));
    expect(result.current).toMatchObject({ points: [{ timestamp: 99_990_000, value: 0 }], source: "mqtt", state: "ready", lastUpdated: 99_990_000 });
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.lastUpdated).toBe(99_990_000);
    expect(result.current.windowEnd).toBe(100_002_000);
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toMatchObject({ points: [], source: "unavailable", state: "empty", lastUpdated: null });
  });

  it("clears prior-channel readings when a selected channel is unavailable", () => {
    fixtures.getHistory.mockImplementation((property: string) => property === "voltage" ? [{ timestamp: 100_000_000, value: 4.3 }] : []);
    const { result, rerender } = renderHook(({ property }: { property: SiteWiseProperty }) => usePLCAnalyticsHistory(property, "1m"), { initialProps: { property: "voltage" as SiteWiseProperty } });
    expect(result.current.points[0].value).toBe(4.3);
    rerender({ property: "temperature" });
    expect(result.current).toMatchObject({ points: [], lastUpdated: null, state: "empty" });
  });

  it("does not substitute the MQTT tail or fake values for an unconfigured historian", () => {
    fixtures.getHistory.mockReturnValue([{ timestamp: 100_000_000, value: 4.3 }]);
    const { result, rerender } = renderHook(({ range, offset }: { range: AnalyticsTimeRange; offset: number }) => usePLCAnalyticsHistory("voltage", range, offset), { initialProps: { range: "30m" as AnalyticsTimeRange, offset: 0 } });
    expect(result.current).toMatchObject({ points: [], state: "unconfigured", source: "unavailable" });
    rerender({ range: "1m", offset: 86_400_000 });
    expect(result.current).toMatchObject({ points: [], state: "unconfigured", source: "unavailable" });
    expect(fixtures.fetchHistory).not.toHaveBeenCalled();
  });

  it("sorts historian timestamps, drops invalid and out-of-window samples, and keeps receipt freshness", async () => {
    fixtures.configured = true;
    fixtures.fetchHistory.mockResolvedValue([
      { timestamp: 99_999_000, value: 4.2 },
      { timestamp: 99_998_000, value: 4.1 },
      { timestamp: 99_999_000, value: 4.3 },
      { timestamp: 99_997_000, value: Number.NaN },
      { timestamp: 100_001_000, value: 99 },
      { timestamp: 1, value: 99 },
    ]);
    const { result } = renderHook(() => usePLCAnalyticsHistory("voltage", "1h"));
    await act(async () => {});
    expect(result.current).toMatchObject({
      points: [{ timestamp: 99_998_000, value: 4.1 }, { timestamp: 99_999_000, value: 4.3 }],
      state: "ready", source: "sitewise", loading: false, lastUpdated: 99_999_000,
    });
    expect(fixtures.fetchHistory).toHaveBeenCalledWith("voltage", new Date(96_400_000), new Date(100_000_000), 500);
  });

  it("merges the 30-minute receipt tail by timestamp without double-counting overlap", async () => {
    fixtures.configured = true;
    fixtures.fetchHistory.mockResolvedValue([
      { timestamp: 99_990_000, value: 4.1 }, { timestamp: 99_998_000, value: 4.2 },
    ]);
    fixtures.getHistory.mockReturnValue([
      { timestamp: 99_998_000, value: 4.3 }, { timestamp: 99_999_000, value: 4.4 },
    ]);
    const { result } = renderHook(() => usePLCAnalyticsHistory("voltage", "30m"));
    await act(async () => {});
    expect(result.current.points).toEqual([
      { timestamp: 99_990_000, value: 4.1 }, { timestamp: 99_998_000, value: 4.3 }, { timestamp: 99_999_000, value: 4.4 },
    ]);
    expect(result.current.source).toBe("mqtt+sitewise");
    expect(result.current.lastUpdated).toBe(99_999_000);
  });

  it("labels a 30-minute view supplied only by the real receipt tail as MQTT", async () => {
    fixtures.configured = true;
    fixtures.fetchHistory.mockResolvedValue([]);
    fixtures.getHistory.mockReturnValue([{ timestamp: 99_999_000, value: 4.4 }]);
    const { result } = renderHook(() => usePLCAnalyticsHistory("voltage", "30m"));
    await act(async () => {});
    expect(result.current).toMatchObject({
      points: [{ timestamp: 99_999_000, value: 4.4 }], source: "mqtt", state: "ready", lastUpdated: 99_999_000,
    });
  });

  it("does not claim a historian contribution when every historic point is replaced or out of the window", async () => {
    fixtures.configured = true;
    fixtures.fetchHistory.mockResolvedValue([
      { timestamp: 99_999_000, value: 4.2 }, { timestamp: 1, value: 99 },
    ]);
    fixtures.getHistory.mockReturnValue([{ timestamp: 99_999_000, value: 4.4 }]);
    const { result } = renderHook(() => usePLCAnalyticsHistory("voltage", "30m"));
    await act(async () => {});
    expect(result.current).toMatchObject({ points: [{ timestamp: 99_999_000, value: 4.4 }], source: "mqtt", state: "ready" });
  });

  it("surfaces historian failures as errors without fabricated fallback values", async () => {
    fixtures.configured = true;
    fixtures.fetchHistory.mockRejectedValue(new Error("History connection unavailable"));
    const { result } = renderHook(() => usePLCAnalyticsHistory("current", "24h"));
    await act(async () => {});
    expect(result.current).toMatchObject({ points: [], source: "unavailable", state: "error", loading: false, lastUpdated: null, error: "History connection unavailable" });
  });

  it("ignores late historian replies after parameter changes", async () => {
    fixtures.configured = true;
    let completeVoltage: (points: { timestamp: number; value: number }[]) => void = () => {};
    fixtures.fetchHistory.mockImplementation((property: SiteWiseProperty) => property === "voltage"
      ? new Promise((resolve) => { completeVoltage = resolve; })
      : Promise.resolve([{ timestamp: 100_000_000, value: 2.1 }]));
    const { result, rerender } = renderHook(({ property }: { property: SiteWiseProperty }) => usePLCAnalyticsHistory(property, "1h"), { initialProps: { property: "voltage" as SiteWiseProperty } });
    rerender({ property: "current" });
    await act(async () => {});
    await act(async () => completeVoltage([{ timestamp: 100_000_000, value: 99 }]));
    expect(result.current.points).toEqual([{ timestamp: 100_000_000, value: 2.1 }]);
  });

  it("queries genuine preceding windows for shift offsets", async () => {
    fixtures.configured = true;
    fixtures.fetchHistory.mockResolvedValue([{ timestamp: 13_599_000, value: 4.3 }]);
    const { result } = renderHook(() => usePLCAnalyticsHistory("voltage", "6h", 86_400_000));
    await act(async () => {});
    expect(fixtures.fetchHistory).toHaveBeenCalledWith("voltage", new Date(-8_000_000), new Date(13_600_000), 500);
    expect(result.current).toMatchObject({ windowStart: -8_000_000, windowEnd: 13_600_000, lastUpdated: 13_599_000 });
    expect(fixtures.getHistory).not.toHaveBeenCalled();
  });

  it("clears a previous dataset when the historian refresh returns no samples", async () => {
    fixtures.configured = true;
    fixtures.fetchHistory.mockResolvedValueOnce([{ timestamp: 100_000_000, value: 4.3 }]).mockResolvedValue([]);
    const { result } = renderHook(() => usePLCAnalyticsHistory("voltage", "1h"));
    await act(async () => {});
    expect(result.current.points).toHaveLength(1);
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(result.current).toMatchObject({ points: [], state: "empty", lastUpdated: null });
  });
});
