/**
 * Prediction Engine — pure mathematical functions.
 * No React, no store dependencies. Takes arrays, returns results.
 */

import type { ParameterPrediction, RULEstimate, HealthScore, ForecastPoint, PredictionHorizon, ThresholdCrossing } from "../types/predictions";

/* ── Linear Regression ────────────────────────────────── */

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  standardError: number;
  predict: (futureMs: number) => number;
}

export function linearRegression(data: number[], sampleRateMs: number): RegressionResult {
  const n = data.length;
  if (n < 3) return { slope: 0, intercept: data[n - 1] ?? 0, r2: 0, standardError: 0, predict: () => data[n - 1] ?? 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const x = i * sampleRateMs;
    const y = data[i];
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; sumY2 += y * y;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return { slope: 0, intercept: sumY / n, r2: 0, standardError: 0, predict: () => sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const yMean = sumY / n;
  const ssTot = sumY2 - n * yMean * yMean;
  const ssRes = data.reduce((s, y, i) => {
    const pred = intercept + slope * i * sampleRateMs;
    return s + (y - pred) ** 2;
  }, 0);
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  const standardError = Math.sqrt(ssRes / Math.max(1, n - 2));
  const lastX = (n - 1) * sampleRateMs;

  return {
    slope,
    intercept,
    r2,
    standardError,
    predict: (futureMs: number) => intercept + slope * (lastX + futureMs),
  };
}

/* ── Forecast Parameter ───────────────────────────────── */

const HORIZONS: { key: PredictionHorizon; ms: number }[] = [
  { key: "5min", ms: 300_000 },
  { key: "15min", ms: 900_000 },
  { key: "30min", ms: 1_800_000 },
];

export function forecastParameter(data: number[], sampleRateMs: number): Record<PredictionHorizon, ForecastPoint> {
  const reg = linearRegression(data, sampleRateMs);
  const tCritical = 2.0; // approximation for n > 30

  const result = {} as Record<PredictionHorizon, ForecastPoint>;
  for (const h of HORIZONS) {
    const value = reg.predict(h.ms);
    const margin = tCritical * reg.standardError * Math.sqrt(1 + 1 / data.length);
    result[h.key] = {
      value,
      confidenceLow: value - margin,
      confidenceHigh: value + margin,
    };
  }
  return result;
}

/* ── Exponential Moving Average ───────────────────────── */

export function exponentialMovingAverage(data: number[], window = 20): number[] {
  if (data.length === 0) return [];
  const alpha = 2 / (window + 1);
  const ema: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(alpha * data[i] + (1 - alpha) * ema[i - 1]);
  }
  return ema;
}

/* ── EMA Anomaly Detection ────────────────────────────── */

export function detectEMAAnomaly(data: number[], ema: number[], sigmaThreshold = 2.0): number[] {
  const residuals = data.map((v, i) => v - ema[i]);
  const mean = residuals.reduce((s, v) => s + v, 0) / residuals.length;
  const variance = residuals.reduce((s, v) => s + (v - mean) ** 2, 0) / residuals.length;
  const sigma = Math.sqrt(variance);
  if (sigma < 1e-10) return [];

  return residuals.reduce<number[]>((acc, r, i) => {
    if (Math.abs(r - mean) > sigmaThreshold * sigma) acc.push(i);
    return acc;
  }, []);
}

/* ── Rate of Change ───────────────────────────────────── */

export function rateOfChange(data: number[], sampleRateMs: number): number {
  const window = Math.min(20, data.length);
  if (window < 3) return 0;
  const recent = data.slice(-window);
  const reg = linearRegression(recent, sampleRateMs);
  // Convert from per-ms to per-minute
  return reg.slope * 60_000;
}

/* ── Threshold Crossing Prediction ────────────────────── */

export function predictThresholdCrossing(
  currentValue: number,
  slopePerMinute: number,
  thresholds: { upper: number; lower: number },
): ThresholdCrossing | null {
  // Check upper threshold
  if (slopePerMinute > 0.001) {
    const minutesUntil = (thresholds.upper - currentValue) / slopePerMinute;
    if (minutesUntil > 0 && minutesUntil < 60) {
      return { willCross: true, threshold: thresholds.upper, minutesUntil, direction: "above" };
    }
  }
  // Check lower threshold
  if (slopePerMinute < -0.001) {
    const minutesUntil = (currentValue - thresholds.lower) / Math.abs(slopePerMinute);
    if (minutesUntil > 0 && minutesUntil < 60) {
      return { willCross: true, threshold: thresholds.lower, minutesUntil, direction: "below" };
    }
  }
  return null;
}

/* ── Remaining Useful Life ────────────────────────────── */

export function estimateRUL(
  data: number[],
  sampleRateMs: number,
  failureThreshold: number,
  direction: "above" | "below",
): RULEstimate {
  const reg = linearRegression(data, sampleRateMs);
  const current = data[data.length - 1] ?? 0;
  const slopePerMin = reg.slope * 60_000;

  let estimatedMinutes: number | null = null;
  let trend: "degrading" | "stable" | "improving" = "stable";

  if (direction === "above" && slopePerMin > 0.01) {
    estimatedMinutes = (failureThreshold - current) / slopePerMin;
    trend = "degrading";
  } else if (direction === "below" && slopePerMin < -0.01) {
    estimatedMinutes = (current - failureThreshold) / Math.abs(slopePerMin);
    trend = "degrading";
  } else if (Math.abs(slopePerMin) > 0.01) {
    trend = "improving";
  }

  if (estimatedMinutes !== null && estimatedMinutes < 0) estimatedMinutes = null;

  // Degradation: how close to failure (0 = nominal, 1 = at threshold)
  const nominal = direction === "above" ? 0 : failureThreshold * 2;
  const range = Math.abs(failureThreshold - nominal);
  const degradation = range > 0 ? Math.min(1, Math.abs(current - nominal) / range) : 0;

  return {
    parameterId: "",
    label: "",
    failureThreshold,
    currentDegradation: degradation,
    estimatedMinutesRemaining: estimatedMinutes,
    confidence: reg.r2,
    trend,
  };
}

/* ── Health Score ──────────────────────────────────────── */

const PARAM_WEIGHTS: Record<string, number> = {
  voltage: 0.3,
  current: 0.3,
  temperature: 0.25,
  ph: 0.15,
};

export function computeHealthScore(
  predictions: ParameterPrediction[],
  rulEstimates: RULEstimate[],
): HealthScore {
  const components: Record<string, number> = {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const pred of predictions) {
    const weight = PARAM_WEIGHTS[pred.parameterId] ?? 0.2;
    const range = pred.max - pred.min;
    if (range <= 0) continue;

    // How far from nominal center (0 = center, 1 = at edge)
    const center = (pred.max + pred.min) / 2;
    const deviation = Math.abs(pred.currentValue - center) / (range / 2);
    const score = Math.max(0, Math.min(100, (1 - deviation) * 100));

    components[pred.parameterId] = Math.round(score);
    weightedSum += score * weight;
    totalWeight += weight;
  }

  let overall = totalWeight > 0 ? weightedSum / totalWeight : 100;

  // Penalize if any RUL is short
  for (const rul of rulEstimates) {
    if (rul.estimatedMinutesRemaining !== null && rul.estimatedMinutesRemaining < 30) {
      overall -= 20;
    } else if (rul.estimatedMinutesRemaining !== null && rul.estimatedMinutesRemaining < 60) {
      overall -= 10;
    }
  }

  return {
    overall: Math.max(0, Math.min(100, Math.round(overall))),
    components,
    lastUpdated: Date.now(),
  };
}

/* ── Full Parameter Analysis ──────────────────────────── */

interface ParameterConfig {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  upperThreshold: number;
  lowerThreshold: number;
  failureThreshold: number;
  failureDirection: "above" | "below";
}

const PARAM_CONFIGS: ParameterConfig[] = [
  { id: "voltage", label: "Voltage", unit: "V", min: 0, max: 12, upperThreshold: 10, lowerThreshold: 2, failureThreshold: 10, failureDirection: "above" },
  { id: "current", label: "Current", unit: "A", min: 0, max: 10, upperThreshold: 9, lowerThreshold: 0.5, failureThreshold: 9, failureDirection: "above" },
  { id: "ph", label: "pH", unit: "pH", min: 0, max: 14, upperThreshold: 8.5, lowerThreshold: 5.5, failureThreshold: 8.5, failureDirection: "above" },
  { id: "temperature", label: "Temperature", unit: "°C", min: 0, max: 100, upperThreshold: 80, lowerThreshold: 5, failureThreshold: 80, failureDirection: "above" },
];

export function analyzeAllParameters(
  histories: Record<string, number[]>,
  sampleRateMs: number,
): { predictions: ParameterPrediction[]; rulEstimates: RULEstimate[] } {
  const predictions: ParameterPrediction[] = [];
  const rulEstimates: RULEstimate[] = [];

  for (const cfg of PARAM_CONFIGS) {
    const data = histories[cfg.id];
    if (!data || data.length < 3) continue;

    const currentValue = data[data.length - 1];
    const forecasts = forecastParameter(data, sampleRateMs);
    const roc = rateOfChange(data, sampleRateMs);
    const reg = linearRegression(data, sampleRateMs);

    const trendDirection: "rising" | "falling" | "stable" =
      roc > 0.05 ? "rising" : roc < -0.05 ? "falling" : "stable";

    const crossing = predictThresholdCrossing(currentValue, roc, {
      upper: cfg.upperThreshold,
      lower: cfg.lowerThreshold,
    });

    predictions.push({
      parameterId: cfg.id,
      label: cfg.label,
      unit: cfg.unit,
      currentValue,
      min: cfg.min,
      max: cfg.max,
      predictions: forecasts,
      trendDirection,
      rateOfChange: roc,
      rateOfChangeUnit: `${cfg.unit}/min`,
      thresholdCrossing: crossing,
      confidence: reg.r2,
    });

    const rul = estimateRUL(data, sampleRateMs, cfg.failureThreshold, cfg.failureDirection);
    rul.parameterId = cfg.id;
    rul.label = cfg.label;
    rulEstimates.push(rul);
  }

  return { predictions, rulEstimates };
}
