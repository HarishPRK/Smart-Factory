import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { payloadToOEE, useOEE } from "./useOEE";

const feed = vi.hoisted(() => ({ listener: null as ((payload: Record<string, unknown>) => void) | null, configured: false, snapshot: vi.fn(), history: vi.fn() }));
vi.mock("../services/plcService", () => ({ subscribeRawPLCPayload: (listener: typeof feed.listener) => { feed.listener = listener; return () => { feed.listener = null; }; } }));
vi.mock("../services/siteWiseService", () => ({ isSiteWiseConfigured: () => feed.configured, fetchOEE: feed.snapshot, fetchOEETrend: feed.history }));
const rollup = { availability: .94, performance: .88, quality: .985, total_units_produced: 100, uptime_in_minutes: 10, downtime_in_minutes: 2 };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-09T12:00:00Z")); feed.configured = false; feed.snapshot.mockReset(); feed.history.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("received OEE measurements", () => {
  it("accepts a genuine zero without substituting sample production", () => {
    const stopped = payloadToOEE({ ...rollup, OEE: 0, availability: 0 });
    expect(stopped?.oee.value).toBe(0);
    expect(stopped?.availability.value).toBe(0);
    expect(stopped?.shiftId).toBe("Not reported");
    expect(payloadToOEE({ OEE: .8 })).toBeNull();
    expect(payloadToOEE({ ...rollup, performance: NaN })).toBeNull();
    expect(payloadToOEE({ ...rollup, quality: 98.5 })).toBeNull();
  });
  it("starts empty, collects real samples and preserves their limited coverage on range changes", () => {
    const { result } = renderHook(() => useOEE());
    expect(result.current.oee).toBeNull();
    expect(result.current.trend).toEqual([]);
    act(() => feed.listener?.(rollup));
    expect(result.current.source).toBe("plc");
    expect(result.current.trend).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(5000); feed.listener?.({ ...rollup, performance: .5 }); });
    expect(result.current.trend.map((point) => point.performance)).toEqual([.88, .5]);
    act(() => result.current.setTrendTimeRange("30d"));
    expect(result.current.trend).toHaveLength(2);
    expect(result.current.trendSource).toBe("session");
  });
  it("does not overwrite incoming PLC data with an older in-flight historian response", async () => {
    feed.configured = true;
    let resolveSnapshot: (value: unknown) => void = () => {};
    feed.snapshot.mockImplementation(() => new Promise((resolve) => { resolveSnapshot = resolve; }));
    feed.history.mockRejectedValue(new Error("Historian unavailable"));
    const { result } = renderHook(() => useOEE());
    await act(async () => { feed.listener?.({ ...rollup, performance: 0 }); });
    await act(async () => { resolveSnapshot(payloadToOEE(rollup)); });
    expect(result.current.oee?.performance.value).toBe(0);
    expect(result.current.source).toBe("plc");
    expect(result.current.trend).toHaveLength(1);
    expect(result.current.trendSource).toBe("session");
  });
});
