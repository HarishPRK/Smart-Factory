import { describe, expect, it } from "vitest";
import type { SiteWiseProperty } from "../../services/siteWiseService";
import { createHourlyPreviewSeries } from "./hourlyPreviewSeries";

const HOUR = 3_600_000;
const END = Date.parse("2026-10-08T18:00:00Z");

describe("illustrative one-hour analog analytics", () => {
  it("covers the full hour with ordered, finite samples and exact bounds", () => {
    for (const offset of [0, 5143]) {
      const end = END + offset;
      const points = createHourlyPreviewSeries("voltage", end - HOUR, end);
      expect(points.length).toBeGreaterThanOrEqual(241);
      expect(points.length).toBeLessThanOrEqual(242);
      expect(points[0].timestamp).toBe(end - HOUR);
      expect(points.at(-1)?.timestamp).toBe(end);
      expect(points.every((point, index) => Number.isFinite(point.value)
        && point.timestamp >= end - HOUR && point.timestamp <= end
        && (index === 0 || point.timestamp > points[index - 1].timestamp))).toBe(true);
      expect(points.slice(1, -1).every((point) => point.timestamp % 15_000 === 0)).toBe(true);
    }
  });

  it.each([
    ["voltage", 3.8, 7.7], ["current", 3.2, 8.6], ["pH", 6.1, 8.15], ["temperature", 21.5, 31.5],
  ] as const)("keeps %s bounded with repeated rises and falls", (property, minimum, maximum) => {
    const points = createHourlyPreviewSeries(property, END - HOUR, END);
    expect(points.every(({ value }) => value >= minimum && value <= maximum)).toBe(true);
    expect(new Set(points.map(({ value }) => value)).size).toBeGreaterThan(150);
    const differences = points.slice(1).map((point, index) => point.value - points[index].value);
    expect(differences.filter((difference) => difference > 0).length).toBeGreaterThan(70);
    expect(differences.filter((difference) => difference < 0).length).toBeGreaterThan(70);
  });

  it("gives voltage a typical midrange value and occasional large excursions", () => {
    const values = createHourlyPreviewSeries("voltage", END - HOUR, END).map(({ value }) => value);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(average).toBeGreaterThan(5.2);
    expect(average).toBeLessThan(6);
    expect(Math.min(...values)).toBeLessThan(4.5);
    expect(Math.max(...values)).toBeGreaterThan(6.9);
  });

  it("preserves identical values and sample times throughout refresh overlap", () => {
    const initial = createHourlyPreviewSeries("voltage", END - HOUR, END);
    expect(createHourlyPreviewSeries("voltage", END - HOUR, END)).toEqual(initial);
    const refreshed = createHourlyPreviewSeries("voltage", END - HOUR + 5000, END + 5000);
    const refreshedByTime = new Map(refreshed.map((point) => [point.timestamp, point.value]));
    const overlapping = initial.filter((point) => refreshedByTime.has(point.timestamp));
    expect(overlapping.length).toBeGreaterThanOrEqual(240);
    expect(overlapping.every((point) => refreshedByTime.get(point.timestamp) === point.value)).toBe(true);
  });

  it("gives each analog channel a distinct deterministic trace", () => {
    const traces = (["voltage", "current", "pH", "temperature"] as const)
      .map((property) => createHourlyPreviewSeries(property, END - HOUR, END).map(({ value }) => value));
    expect(new Set(traces.map((trace) => JSON.stringify(trace))).size).toBe(4);
  });

  it.each(["photoE_sensor", "metal_sensor", "push_button", "motor", "relay_ch0", "relay_ch7", "alert_0", "alert_3"] as SiteWiseProperty[])(
    "does not illustrate digital or alert property %s", (property) => {
      expect(createHourlyPreviewSeries(property, END - HOUR, END)).toEqual([]);
    },
  );

  it("rejects invalid, reversed and longer windows", () => {
    for (const [start, end] of [[NaN, END], [END - HOUR, Infinity], [END, END], [END, END - HOUR], [END - HOUR - 1, END]]) {
      expect(createHourlyPreviewSeries("voltage", start, end)).toEqual([]);
    }
  });
});
