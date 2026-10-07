import type { Express } from 'express';
import { InfluxSource, InfluxSourceError } from './influxSource.js';

/** Same read-only InfluxDB contract as Connected Enterprise. */
export function registerHardwareMetricsRoutes(app: Express) {
let influxSource: InfluxSource | undefined;
let influxConfigurationError: InfluxSourceError | undefined;
const INFLUX_QUERY_CONCURRENCY_LIMIT = 4;
let influxQueriesInFlight = 0;
try {
  influxSource = InfluxSource.fromEnv();
} catch {
  influxConfigurationError = new InfluxSourceError(
    'configuration',
    'InfluxDB query access is not configured correctly on this server.',
  );
}
app.get('/api/hardware-metrics/anomalies', async (req, res) => {
  res.removeHeader('Access-Control-Allow-Origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  if (influxQueriesInFlight >= INFLUX_QUERY_CONCURRENCY_LIMIT) {
    res.setHeader('Retry-After', '2');
    res.status(429).json({
      error: 'The anomaly service is busy. Try again shortly.',
      code: 'INFLUX_BUSY',
    });
    return;
  }

  influxQueriesInFlight += 1;
  const clientController = new AbortController();
  const abortForDisconnect = () => clientController.abort();
  req.once('aborted', abortForDisconnect);
  res.once('close', abortForDisconnect);
  if (req.aborted || res.destroyed) clientController.abort();

  try {
    if (influxConfigurationError) throw influxConfigurationError;
    if (!influxSource) {
      throw new InfluxSourceError('configuration', 'InfluxDB query access is not configured.');
    }
    const result = await influxSource.queryAnomalies({
      start: req.query.start,
      stop: req.query.stop,
      window: req.query.window,
      flagAggregation: req.query.flagAggregation,
      valueAggregation: req.query.valueAggregation,
    }, { signal: clientController.signal });
    if (!res.destroyed && !res.writableEnded) res.json(result);
  } catch (error) {
    if (res.destroyed || res.writableEnded) return;
    if (error instanceof InfluxSourceError) {
      const status = error.kind === 'validation'
        ? 400
        : error.kind === 'configuration'
          ? 503
          : error.kind === 'cancelled'
            ? 499
            : error.kind === 'timeout'
              ? 504
              : 502;
      res.status(status).json({
        error: error.message,
        code: `INFLUX_${error.kind.toUpperCase()}`,
      });
      return;
    }
    // Do not log the error object: a third-party fetch implementation could
    // attach request headers, including the server-only query token.
    console.error('[influx] anomaly query failed with an unexpected error');
    res.status(502).json({
      error: 'The server could not complete the InfluxDB anomaly query.',
      code: 'INFLUX_UPSTREAM',
    });
  } finally {
    req.off('aborted', abortForDisconnect);
    res.off('close', abortForDisconnect);
    influxQueriesInFlight -= 1;
  }
});

}
