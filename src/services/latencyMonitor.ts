/**
 * Lightweight end-to-end latency monitor for the live PLC data path.
 *
 * Records (Date.now() - bridgeTimestamp) for each inbound plc/data message and
 * logs a rolling summary every few seconds. Used to compare the local
 * `mosquitto` path against the direct `iotcore` path on real traffic without
 * flooding the console.
 *
 * What it measures: transport latency from the moment the bridge sends a
 * message to the moment it reaches JavaScript in the browser (before React
 * render). React/rAF rendering is identical across modes, so this isolates the
 * transport difference — which is the whole question (local LAN hop vs AWS
 * round trip).
 *
 * Clock note: the bridge timestamp and the browser's Date.now() must share a
 * wall clock for the ABSOLUTE numbers to be meaningful — true when the browser
 * runs on the same machine as the bridge (the usual dev setup). Even with a
 * constant skew, the mosquitto-vs-iotcore DIFFERENCE stays valid because the
 * same skew applies to both. Negative samples (clock skew) are clamped to 0
 * and counted separately so they don't poison the average.
 */

interface ModeStats {
  samples: number[];
  lifetimeCount: number;
  lifetimeSum: number;
  lifetimeMin: number;
  lifetimeMax: number;
  skewWarnings: number;
  lastLogAt: number;
}

const LOG_INTERVAL_MS = 5000;

function newStats(): ModeStats {
  return {
    samples: [],
    lifetimeCount: 0,
    lifetimeSum: 0,
    lifetimeMin: Infinity,
    lifetimeMax: 0,
    skewWarnings: 0,
    lastLogAt: 0,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

class LatencyMonitor {
  private byMode = new Map<string, ModeStats>();

  /**
   * Record one sample. `bridgeTs` is the epoch-ms timestamp the bridge stamped
   * when it sent the message; `mode` labels the transport ("mosquitto" |
   * "iotcore"). Silently ignores messages with no timestamp so untimed
   * payloads (e.g. legacy bridges) don't break anything.
   */
  record(bridgeTs: number | undefined, mode: string): void {
    if (typeof bridgeTs !== "number" || !Number.isFinite(bridgeTs)) return;

    let stats = this.byMode.get(mode);
    if (!stats) {
      stats = newStats();
      this.byMode.set(mode, stats);
    }

    let latency = Date.now() - bridgeTs;
    if (latency < 0) {
      stats.skewWarnings++;
      latency = 0; // clock skew — clamp rather than discard the data point
    }

    stats.samples.push(latency);
    stats.lifetimeCount++;
    stats.lifetimeSum += latency;
    if (latency < stats.lifetimeMin) stats.lifetimeMin = latency;
    if (latency > stats.lifetimeMax) stats.lifetimeMax = latency;

    const now = Date.now();
    if (now - stats.lastLogAt >= LOG_INTERVAL_MS) {
      stats.lastLogAt = now;
      this.flush(mode, stats);
    }
  }

  private flush(mode: string, stats: ModeStats): void {
    if (stats.samples.length === 0) return;
    const sorted = [...stats.samples].sort((a, b) => a - b);
    const n = sorted.length;
    const avg = sorted.reduce((a, b) => a + b, 0) / n;
    const lifetimeAvg = stats.lifetimeSum / stats.lifetimeCount;
    const skew = stats.skewWarnings > 0 ? `  ⚠ skew x${stats.skewWarnings}` : "";
    // eslint-disable-next-line no-console
    console.log(
      `[latency:${mode}] window n=${n}  avg=${avg.toFixed(0)}ms  ` +
        `min=${sorted[0]}ms  p50=${percentile(sorted, 50)}ms  ` +
        `p95=${percentile(sorted, 95)}ms  max=${sorted[n - 1]}ms  ` +
        `│ lifetime n=${stats.lifetimeCount} avg=${lifetimeAvg.toFixed(0)}ms ` +
        `min=${stats.lifetimeMin}ms max=${stats.lifetimeMax}ms${skew}`,
    );
    stats.samples = [];
  }

  /** Snapshot of lifetime stats per mode — handy from the devtools console. */
  summary(): Record<string, { count: number; avgMs: number; minMs: number; maxMs: number }> {
    const out: Record<string, { count: number; avgMs: number; minMs: number; maxMs: number }> = {};
    for (const [mode, s] of this.byMode) {
      out[mode] = {
        count: s.lifetimeCount,
        avgMs: s.lifetimeCount ? s.lifetimeSum / s.lifetimeCount : 0,
        minMs: s.lifetimeMin === Infinity ? 0 : s.lifetimeMin,
        maxMs: s.lifetimeMax,
      };
    }
    return out;
  }
}

export const latencyMonitor = new LatencyMonitor();

// Expose for ad-hoc inspection in the browser devtools console:
//   __plcLatency.summary()
if (typeof window !== "undefined") {
  (window as unknown as { __plcLatency: LatencyMonitor }).__plcLatency = latencyMonitor;
}
