import { describe, expect, it } from 'vitest';
import type { DeviceView, UseDevicesResult } from '../../ui/useDevices';
import { duration, measurement, parseHistory, scopeInventory, signalBand, withHistoryGaps } from './deviceMetrics';

function device(overrides: Partial<DeviceView> = {}): DeviceView {
  return { id: 'd1', name: 'Device', kind: 'generic', domain: 'IT', autoDomain: 'IT', overridden: false, ip: '10.0.0.1', mac: 'AA:BB', status: 'ok', conn: 'wifi', connectedForHours: 1, locationSource: 'prpl', inventorySource: 'prplhome', ...overrides };
}
function snapshot(overrides: Partial<UseDevicesResult> = {}): UseDevicesResult {
  return { devices: [], loaded: true, source: 'gateway', connected: true, inventorySourcesSeen: [], lastInventoryAtBySource: {}, ...overrides };
}
describe('device workspace data boundaries', () => {
  it('scopes an explicit feed before the shared gateway location', () => {
    const result = scopeInventory(snapshot({ devices: [device(), device({ id: 'wrong-feed', inventorySource: 'prpl' }), device({ id: 'other-site', inventorySource: 'rdk', locationSource: 'rdk' }), device({ id: 'ot', domain: 'OT' })] }), 'b-mck-03', 'IT');
    expect(result.devices.map(d => d.id)).toEqual(['d1']);
    expect(result.feed).toBe('prplhome');
  });
  it('keeps an empty received feed empty and rejects seeded inventories', () => {
    expect(scopeInventory(snapshot({ inventorySourcesSeen: ['prplhome'], lastInventoryAtBySource: { prplhome: 123 } }), 'b-mck-03', 'IT')).toMatchObject({ devices: [], received: true, timestamp: 123 });
    expect(scopeInventory(snapshot({ source: 'seed', devices: [device()] }), 'b-mck-03', 'IT')).toMatchObject({ devices: [], received: false });
  });
  it('supports the older location field without accepting explicit mismatches', () => {
    expect(scopeInventory(snapshot({ devices: [device({ inventorySource: undefined })] }), 'b-mck-03', 'IT').devices).toHaveLength(1);
    expect(scopeInventory(snapshot({ devices: [device({ inventorySource: 'prpl' })] }), 'b-mck-03', 'IT').devices).toHaveLength(0);
  });
  it('preserves measured zero values and leaves missing values unavailable', () => {
    expect(measurement(0)).toBe('0'); expect(measurement(undefined)).toBe('—');
    expect(duration(0)).toBe('0m'); expect(duration(NaN)).toBe('—');
    expect(signalBand(-60)).toBe('strong'); expect(signalBand(-75)).toBe('fair');
    expect(signalBand(-76)).toBe('weak'); expect(signalBand(undefined)).toBe('unknown');
  });
  it('normalizes MAC keys and keeps finite actual readings in timestamp order', () => {
    const data = parseHistory({ 'aa:bb': [{ t: 2000, rxMbps: 0, rssiDbm: -55 }, { t: 1000, apowerW: 0 }, { t: 2000, rxMbps: 0, rssiDbm: -56 }, { t: NaN, apowerW: 44 }, { t: 3000, txMbps: Infinity, rxMbps: '5' }] });
    expect(data['AA:BB']).toEqual([{ t: 1000, apowerW: 0 }, { t: 2000, rxMbps: 0, rssiDbm: -56 }, { t: 3000 }]);
  });
  it('adds a missing-data break across an outage without filling values', () => {
    const points = [{ t: 1000, rxMbps: 2 }, { t: 11000, rxMbps: 3 }, { t: 21000, rxMbps: 0 }, { t: 121000, rxMbps: 1 }];
    expect(withHistoryGaps(points)).toEqual([...points.slice(0, 3), { t: 21001 }, points[3]]);
  });
});
