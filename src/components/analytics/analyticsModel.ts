export interface AnalyticsPoint {
  timestamp: number;
  value: number;
}

export interface SeriesSummary {
  count: number;
  latest: number | null;
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  standardDeviation: number | null;
  delta: number | null;
  outlierIndices: number[];
  currentDeviation: number | null;
  averageDeviation: number | null;
  maxDeviation: number | null;
}

export interface DistributionBin {
  low: number;
  high: number;
  count: number;
}

export interface DigitalSummary {
  latest: 0 | 1 | null;
  transitions: number;
  activations: number;
  onSamples: number;
  totalSamples: number;
  onSamplePercent: number | null;
}

function receivedPoints(points: readonly AnalyticsPoint[]) {
  return points
    .map((point, index) => ({ ...point, index }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** Statistical outliers are descriptive; they are not equipment safety alarms. */
export function summarizeSeries(points: readonly AnalyticsPoint[], nominal: number): SeriesSummary {
  const received = receivedPoints(points);
  if (received.length === 0) {
    return {
      count: 0, latest: null, average: null, minimum: null, maximum: null,
      standardDeviation: null, delta: null, outlierIndices: [], currentDeviation: null,
      averageDeviation: null, maxDeviation: null,
    };
  }

  const count = received.length;
  const minimum = received.reduce((min, point) => Math.min(min, point.value), Infinity);
  const maximum = received.reduce((max, point) => Math.max(max, point.value), -Infinity);
  const average = minimum === maximum ? minimum : received.reduce((sum, point) => sum + point.value / count, 0);
  const standardDeviation = minimum === maximum ? 0 : Math.sqrt(received.reduce((sum, point) => sum + (point.value - average) ** 2 / count, 0));
  const latest = received[count - 1].value;
  const outlierIndices = count >= 3 && standardDeviation > 0
    ? received.filter((point) => Math.abs(point.value - average) > standardDeviation * 1.8).map((point) => point.index).sort((a, b) => a - b)
    : [];
  const deviations = Number.isFinite(nominal) ? received.map((point) => Math.abs(point.value - nominal)) : [];

  return {
    count,
    latest,
    average,
    minimum,
    maximum,
    standardDeviation,
    delta: latest - received[0].value,
    outlierIndices,
    currentDeviation: Number.isFinite(nominal) ? Math.abs(latest - nominal) : null,
    averageDeviation: deviations.length ? deviations.reduce((sum, value) => sum + value / count, 0) : null,
    maxDeviation: deviations.length ? deviations.reduce((max, value) => Math.max(max, value), 0) : null,
  };
}

/** Counts actual readings, without generating variation for a constant signal. */
export function distributionBins(points: readonly AnalyticsPoint[], binCount = 12): DistributionBin[] {
  const received = receivedPoints(points);
  if (!received.length) return [];
  const count = Number.isFinite(binCount) ? Math.max(1, Math.min(128, Math.floor(binCount))) : 12;
  const minimum = received.reduce((min, point) => Math.min(min, point.value), Infinity);
  const maximum = received.reduce((max, point) => Math.max(max, point.value), -Infinity);
  const flat = minimum === maximum;
  const padding = flat ? Math.max(Math.abs(minimum) * 0.05, 0.05) : 0;
  const low = minimum - padding;
  const high = maximum + padding;
  const width = (high - low) / count;
  const bins = Array.from({ length: count }, (_, index) => ({
    low: low + index * width,
    high: index === count - 1 ? high : low + (index + 1) * width,
    count: 0,
  }));
  for (const point of received) {
    const index = flat ? Math.floor(count / 2) : Math.min(count - 1, Math.floor((point.value - low) / width));
    bins[index].count += 1;
  }
  return bins;
}

/** ON percentage describes received samples, not an inferred time duration. */
export function summarizeDigital(points: readonly AnalyticsPoint[]): DigitalSummary {
  const readings = receivedPoints(points).map((point): 0 | 1 => point.value >= 0.5 ? 1 : 0);
  let transitions = 0;
  let activations = 0;
  for (let index = 1; index < readings.length; index += 1) {
    if (readings[index] !== readings[index - 1]) transitions += 1;
    if (readings[index] === 1 && readings[index - 1] === 0) activations += 1;
  }
  const onSamples = readings.reduce<number>((sum, reading) => sum + reading, 0);
  return {
    latest: readings.length ? readings[readings.length - 1] : null,
    transitions,
    activations,
    onSamples,
    totalSamples: readings.length,
    onSamplePercent: readings.length ? onSamples / readings.length * 100 : null,
  };
}

/** Keep the setpoint visible and leave headroom even for a single flat reading. */
export function chartDomain(points: readonly AnalyticsPoint[], nominal?: number): [number, number] {
  const values = receivedPoints(points).map((point) => point.value);
  if (nominal !== undefined && Number.isFinite(nominal)) values.push(nominal);
  if (!values.length) return [0, 1];
  const minimum = values.reduce((min, value) => Math.min(min, value), Infinity);
  const maximum = values.reduce((max, value) => Math.max(max, value), -Infinity);
  const range = maximum - minimum;
  const padding = Math.max(range * 0.12, Math.max(Math.abs(minimum), Math.abs(maximum)) * 0.025, 0.1);
  return [minimum - padding, maximum + padding];
}
