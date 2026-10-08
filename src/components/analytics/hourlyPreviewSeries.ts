import type { SiteWiseProperty } from "../../services/siteWiseService";
import type { AnalyticsPoint } from "./analyticsModel";

const SAMPLE_MS = 15_000;
const HOUR_MS = 3_600_000;

type AnalogProperty = "voltage" | "current" | "pH" | "temperature";
interface Profile {
  center: number;
  amplitude: number;
  minimum: number;
  maximum: number;
  seed: number;
}

const PROFILES: Record<AnalogProperty, Profile> = {
  voltage: { center: 5.6, amplitude: 1.45, minimum: 3.8, maximum: 7.7, seed: 11 },
  current: { center: 6, amplitude: 1.6, minimum: 3.2, maximum: 8.6, seed: 29 },
  pH: { center: 7, amplitude: 0.65, minimum: 6.1, maximum: 8.15, seed: 47 },
  temperature: { center: 25, amplitude: 3, minimum: 21.5, maximum: 31.5, seed: 71 },
};

/** Stateless noise on an absolute sample grid, never Math.random() or poll time. */
function noise(tick: number, seed: number): number {
  let hash = Math.imul(tick | 0, 374761393) + Math.imul(seed, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0xffffffff * 2 - 1;
}

function previewValue(timestamp: number, profile: Profile): number {
  const seconds = timestamp / 1000;
  const tick = timestamp / SAMPLE_MS;
  const leftTick = Math.floor(tick);
  const fraction = tick - leftTick;
  const jagged = noise(leftTick, profile.seed) * (1 - fraction)
    + noise(leftTick + 1, profile.seed) * fraction;
  const phase = profile.seed * 0.39;
  const cycle = Math.sin(seconds / 73 + phase) * 0.46
    + Math.sin(seconds / 29 + phase * 1.7) * 0.28;
  const drift = Math.sin(seconds / 401 + phase * 0.7) * 0.22
    + Math.sin(seconds / 1301 + phase * 1.3) * 0.12;
  // Short excursions make occasional highs and lows between normal fluctuations.
  const high = Math.max(0, Math.sin(seconds / 61 + phase) - 0.93) / 0.07;
  const low = Math.max(0, Math.sin(seconds / 83 + phase * 1.9) - 0.94) / 0.06;
  const value = profile.center + profile.amplitude * (cycle + drift + jagged * 0.49 + high * 0.85 - low * 0.85);
  return Math.round(Math.max(profile.minimum, Math.min(profile.maximum, value)) * 1000) / 1000;
}

/**
 * Illustrative analytics points only. This pure function has no live telemetry,
 * control, store, or alarm connection. Callers must label its output as preview.
 * Epoch-aligned samples keep overlapping hour windows identical on refresh.
 */
export function createHourlyPreviewSeries(
  property: SiteWiseProperty,
  windowStart: number,
  windowEnd: number,
): AnalyticsPoint[] {
  if (property !== "voltage" && property !== "current" && property !== "pH" && property !== "temperature") return [];
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart || windowEnd - windowStart > HOUR_MS) return [];
  const profile = PROFILES[property];
  const points: AnalyticsPoint[] = [{ timestamp: windowStart, value: previewValue(windowStart, profile) }];
  for (let timestamp = (Math.floor(windowStart / SAMPLE_MS) + 1) * SAMPLE_MS; timestamp < windowEnd; timestamp += SAMPLE_MS) {
    points.push({ timestamp, value: previewValue(timestamp, profile) });
  }
  points.push({ timestamp: windowEnd, value: previewValue(windowEnd, profile) });
  return points;
}
