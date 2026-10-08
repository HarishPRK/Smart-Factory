import { describe, expect, it } from "vitest";
import { chartDomain, distributionBins, summarizeDigital, summarizeSeries } from "./analyticsModel";

const series = (values: number[]) => values.map((value, index) => ({ timestamp: index * 1000, value }));

describe("received PLC analytics", () => {
  it("keeps missing data distinct from zero readings", () => {
    expect(summarizeSeries([], 5)).toEqual({
      count: 0, latest: null, average: null, minimum: null, maximum: null,
      standardDeviation: null, delta: null, outlierIndices: [], currentDeviation: null,
      averageDeviation: null, maxDeviation: null,
    });
    expect(summarizeSeries(series([0]), 5)).toMatchObject({ count: 1, latest: 0, average: 0, standardDeviation: 0, delta: 0, currentDeviation: 5 });
    expect(summarizeDigital([])).toMatchObject({ latest: null, onSamplePercent: null, totalSamples: 0 });
  });

  it("summarizes constant hardware readings without inventing anomalies or movement", () => {
    const summary = summarizeSeries(series([4.3, 4.3, 4.3, 4.3]), 5);
    expect(summary).toMatchObject({ count: 4, latest: 4.3, average: 4.3, minimum: 4.3, maximum: 4.3, standardDeviation: 0, delta: 0, outlierIndices: [] });
    expect(summary.currentDeviation).toBeCloseTo(0.7);
    expect(summary.averageDeviation).toBeCloseTo(0.7);
    expect(summary.maxDeviation).toBeCloseTo(0.7);
    expect(summarizeSeries(series(Array(79).fill(4.31)), 5)).toMatchObject({ average: 4.31, standardDeviation: 0, outlierIndices: [] });
  });

  it("computes population statistics and flags outliers at 1.8 standard deviations", () => {
    const summary = summarizeSeries(series([1, 1, 1, 1, 10]), 1);
    expect(summary.average).toBeCloseTo(2.8);
    expect(summary.standardDeviation).toBeCloseTo(3.6);
    expect(summary.outlierIndices).toEqual([4]);
    expect(summary).toMatchObject({ latest: 10, delta: 9, minimum: 1, maximum: 10, currentDeviation: 9, maxDeviation: 9 });
    expect(summary.averageDeviation).toBeCloseTo(1.8);
    expect(summarizeSeries(series([1, 100]), 5).outlierIndices).toEqual([]);
  });

  it("ignores corrupt readings and preserves original chart indices for outliers", () => {
    const readings = series([1, NaN, 1, 1, 1, 10, Infinity]);
    readings.push({ timestamp: NaN, value: 100 });
    expect(summarizeSeries(readings, 1)).toMatchObject({ count: 5, latest: 10, outlierIndices: [5] });
    expect(distributionBins(readings).reduce((sum, bin) => sum + bin.count, 0)).toBe(5);
  });

  it("uses event timestamps for latest readings and rising edges without mutating input", () => {
    const readings = [{ timestamp: 3000, value: 1 }, { timestamp: 1000, value: 0 }, { timestamp: 2000, value: 1 }];
    const copy = readings.map((reading) => ({ ...reading }));
    expect(summarizeSeries(readings, 0)).toMatchObject({ latest: 1, delta: 1 });
    expect(summarizeDigital(readings)).toMatchObject({ latest: 1, transitions: 1, activations: 1 });
    expect(readings).toEqual(copy);
  });

  it("counts transitions and rising edges separately and does not invent an initial activation", () => {
    expect(summarizeDigital(series([1, 1, 0, 0, 1, 0]))).toEqual({ latest: 0, transitions: 3, activations: 1, onSamples: 3, totalSamples: 6, onSamplePercent: 50 });
    expect(summarizeDigital(series([1]))).toMatchObject({ latest: 1, transitions: 0, activations: 0, onSamplePercent: 100 });
    expect(summarizeDigital(series([0, 0.49, 0.5, NaN]))).toMatchObject({ latest: 1, transitions: 1, activations: 1, onSamples: 1, totalSamples: 3 });
  });

  it("bins the full range inclusively and puts a flat signal in one meaningful center bin", () => {
    const bins = distributionBins(series([0, 0.5, 1, 1.5, 2]), 4);
    expect(bins.map((bin) => bin.count)).toEqual([1, 1, 1, 2]);
    expect(bins[0].low).toBe(0);
    expect(bins[3].high).toBe(2);
    const flat = distributionBins(series([4.3, 4.3, 4.3]));
    expect(flat).toHaveLength(12);
    expect(flat.map((bin) => bin.count)).toEqual([0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0]);
    expect(flat[6].high).toBeGreaterThan(flat[6].low);
    expect(flat[6].low).toBeLessThanOrEqual(4.3);
    expect(flat[6].high).toBeGreaterThan(4.3);
    expect(distributionBins([])).toEqual([]);
    expect(distributionBins(series([1]), 0)).toHaveLength(1);
  });

  it("keeps nominal visible with padded domains for empty, flat and negative signals", () => {
    expect(chartDomain([])).toEqual([0, 1]);
    for (const domain of [chartDomain([], 5), chartDomain(series([0])), chartDomain(series([-5])), chartDomain(series([4.3, 4.3]), 5), chartDomain(series([NaN]), NaN)]) {
      expect(domain.every(Number.isFinite)).toBe(true);
      expect(domain[1]).toBeGreaterThan(domain[0]);
    }
    const [low, high] = chartDomain(series([4.3, 4.3]), 5);
    expect(low).toBeLessThan(4.3);
    expect(high).toBeGreaterThan(5);
    const negative = chartDomain(series([-10, -5]), 0);
    expect(negative[0]).toBeLessThan(-10);
    expect(negative[1]).toBeGreaterThan(0);
  });
});
