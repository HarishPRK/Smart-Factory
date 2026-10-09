import { describe, expect, it } from "vitest";
import { analyzeAllParameters, forecastParameter, linearRegression } from "./predictionEngine";

describe("received-sample regression", () => {
  it("uses real irregular receipt intervals for rates and horizons", () => {
    const times = [100_000, 101_000, 105_000, 106_000, 110_000];
    const values = times.map((time) => 4 + (time - times[0]) / 60_000 * .2);
    const { predictions } = analyzeAllParameters({ voltage: values }, { voltage: times });
    expect(predictions[0].rateOfChange).toBeCloseTo(.2);
    expect(predictions[0].predictions["5min"].value).toBeCloseTo(values.at(-1)! + 1);
    expect(predictions[0].history?.map((sample) => sample.timestamp)).toEqual(times);
    expect(predictions[0].sampleCount).toBe(5);
  });
  it("uses one fitted window for direction, crossing, and projected values", () => {
    const values = Array.from({ length: 80 }, (_, index) => 10 - index * .045)
      .concat(Array.from({ length: 20 }, (_, index) => 6.4 + index * .01));
    const { predictions } = analyzeAllParameters({ ph: values }, 5000);
    const ph = predictions[0];
    expect(ph.trendDirection).toBe("falling");
    expect(ph.thresholdCrossing?.direction).toBe("below");
    expect(ph.predictions["30min"].value).toBeLessThan(ph.predictions["5min"].value);
    const fittedNow = linearRegression(values, 5000).predict(0);
    expect(fittedNow + ph.rateOfChange * ph.thresholdCrossing!.minutesUntil!).toBeCloseTo(ph.thresholdCrossing!.threshold);
  });
  it("widens the model interval as noisy observations are extrapolated further", () => {
    const result = forecastParameter([4, 4.2, 4.1, 4.35, 4.15, 4.4, 4.3], 5000);
    const width = (horizon: "5min" | "30min") => result[horizon].confidenceHigh - result[horizon].confidenceLow;
    expect(width("30min")).toBeGreaterThan(width("5min"));
  });
  it("rejects invalid values and missing or out-of-order time coverage", () => {
    expect(analyzeAllParameters({ voltage: [4, NaN, 5] }, 500).predictions).toEqual([]);
    for (const times of [[1, 2], [1, 1, 1], [1, 4, 2], [1, NaN, 4]]) {
      expect(analyzeAllParameters({ voltage: [4, 4, 5] }, { voltage: times }).predictions).toEqual([]);
    }
  });
});
