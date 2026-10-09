import { describe, expect, it } from 'vitest';
import { fleetChartRows, fleetTraces, transferredData } from './fleetTelemetry';
import type { DeviceView } from '../../ui/useDevices';

const device = (id: string, mac: string): DeviceView => ({ id, name: 'Same device name', mac, kind: 'generic', domain: 'IT', autoDomain: 'IT', overridden: false, ip: '', conn: 'wifi', status: 'ok', connectedForHours: 1 });
describe('restored fleet telemetry', () => {
  it('derives cumulative transfer from real RX + TX counter deltas', () => {
    expect(transferredData([{ t: 1, rxBytes: 100, txBytes: 200 }, { t: 2, rxBytes: 1000100, txBytes: 2000200 }, { t: 3, rxBytes: 1000100, txBytes: 2000200 }])).toEqual([{ t: 1, mb: 0 }, { t: 2, mb: 3 }, { t: 3, mb: 3 }]);
  });
  it('breaks on resets and missing counters rather than inventing traffic', () => {
    const result = transferredData([{ t: 1, rxBytes: 100, txBytes: 200 }, { t: 2, rxBytes: 1000100, txBytes: 2000200 }, { t: 3, rxBytes: 10, txBytes: 20 }, { t: 4, rxBytes: 1000010, txBytes: 20 }, { t: 5, rxBytes: 5 }, { t: 6, rxBytes: 9000000, txBytes: 9000000 }]);
    expect(result).toEqual([{ t: 1, mb: 0 }, { t: 2, mb: 3 }, { t: 3 }, { t: 4, mb: 4 }, { t: 5 }, { t: 6, mb: 4 }]);
  });
  it('keeps equal-name devices separate and excludes unrelated MAC history', () => {
    const traces = fleetTraces([device('a', 'aa:bb'), device('b', 'cc:dd')], { 'AA:BB': [{ t: 1000, rssiDbm: -50 }], 'CC:DD': [{ t: 1000, rssiDbm: -80 }], 'EE:FF': [{ t: 1000, rssiDbm: -10 }] });
    expect(fleetChartRows(traces, 'signal')).toEqual([{ t: 1000, device0: -50, device1: -80 }]);
  });
  it('preserves zero traffic and leaves unavailable counters missing', () => {
    const traces = fleetTraces([device('a', 'AA')], { AA: [{ t: 1, rxBytes: 0, txBytes: 0 }, { t: 1000, rssiDbm: -50 }] });
    expect(fleetChartRows(traces, 'transfer').map(row => row.device0)).toEqual([0, undefined]);
  });
  it('limits plotted time buckets for a large fleet', () => {
    const traces = fleetTraces([device('a', 'AA')], { AA: Array.from({ length: 2000 }, (_, i) => ({ t: i + 1, rssiDbm: -60 })) });
    expect(fleetChartRows(traces, 'signal').length).toBeLessThanOrEqual(180);
  });
});
