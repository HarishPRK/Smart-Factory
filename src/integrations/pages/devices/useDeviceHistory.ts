import { useCallback, useEffect, useState } from 'react';
import { parseHistory, type DeviceHistory } from './deviceMetrics';

export function useDeviceHistory() {
  const [history, setHistory] = useState<DeviceHistory>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch('/api/devices/telemetry/history', { signal: controller.signal });
        if (!response.ok) throw new Error(`History unavailable (${response.status})`);
        const payload = await response.json();
        if (!controller.signal.aborted) { setHistory(parseHistory(payload.series)); setError(''); }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'History unavailable');
      } finally {
        if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(poll, 10_000); }
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [revision]);
  return { history, error, loading, refresh };
}
