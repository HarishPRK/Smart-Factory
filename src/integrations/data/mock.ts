/**
 * Stub mock data for the Dynamic Path Selection page.
 *
 * The original Connected Enterprise repo had a larger mock module here;
 * the only export the DPS page consumes is `pathThresholds`. Replace these
 * defaults with real SLA values when the gateway publishes its own policy.
 */

export interface PathThreshold {
  metric: 'latency' | 'jitter' | 'loss';
  warn: number;
  fail: number;
  unit: string;
}

export const pathThresholds: PathThreshold[] = [
  { metric: 'latency', warn: 80, fail: 150, unit: 'ms' },
  { metric: 'jitter', warn: 30, fail: 60, unit: 'ms' },
  { metric: 'loss', warn: 1, fail: 3, unit: '%' },
];
