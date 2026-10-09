import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceWorkspace } from './DeviceWorkspace';
import type { DeviceView, UseDevicesResult } from '../../ui/useDevices';
import { cloneElement, type ReactElement } from 'react';
import type { DeviceHistory } from './deviceMetrics';

const api = vi.hoisted(() => ({ snapshot: {} as UseDevicesResult, history: {} as DeviceHistory, classify: vi.fn(), matter: vi.fn(), shelly: vi.fn(), refresh: vi.fn() }));
vi.mock('../../ui/useDevices', () => ({ useDevices: () => api.snapshot, classifyDevice: api.classify, controlMatterDevice: api.matter, controlShellyDevice: api.shelly, refreshMatterDevices: api.refresh }));
vi.mock('./useDeviceHistory', () => ({ useDeviceHistory: () => ({ history: api.history, loading: false, error: '', refresh: vi.fn() }) }));
// JSDOM has no layout. Give charts deterministic dimensions for interaction checks.
vi.mock('recharts', async importOriginal => ({ ...await importOriginal<typeof import('recharts')>(), ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) => cloneElement(children, { width: 640, height: 300 }) }));
vi.mock('../../components/widgets/AiInsightCard', () => ({ AiInsightCard: () => <div>AI analysis</div> }));
const makeDevice = (overrides: Partial<DeviceView> = {}): DeviceView => ({ id: 'a', name: 'Endpoint Alpha', kind: 'generic', domain: 'IT', autoDomain: 'IT', overridden: false, ip: '10.0.0.1', mac: 'AA:BB', status: 'ok', conn: 'wifi', connectedForHours: 0, inventorySource: 'prplhome', telemetry: { rxMbps: 0, rssiDbm: -54 }, ...overrides });
beforeEach(() => {
  vi.clearAllMocks();
  api.history = {};
  api.snapshot = { devices: [makeDevice(), makeDevice({ id: 'b', name: 'Endpoint Beta', mac: 'CC:DD', status: 'err', telemetry: { rssiDbm: -80 } })], loaded: true, connected: true, source: 'gateway', inventorySourcesSeen: ['prplhome'], lastInventoryAtBySource: { prplhome: 1700000000000 } };
  api.classify.mockResolvedValue(undefined); api.matter.mockResolvedValue(undefined); api.shelly.mockResolvedValue(undefined);
});
afterEach(cleanup);
const inspector = () => within(screen.getByRole('complementary', { name: 'Device inspector' }));

describe('modern IT / OT device workspace', () => {
  it('keeps all four fleet graphs visible and switches between all and selected traces', () => {
    api.history = { 'AA:BB': [{ t: 1000, rssiDbm: -54, rxBytes: 0, txBytes: 0 }, { t: 11000, rssiDbm: -56, rxBytes: 100, txBytes: 10 }], 'CC:DD': [{ t: 1000, rssiDbm: -80, rxBytes: 0, txBytes: 0 }, { t: 11000, rssiDbm: -78, rxBytes: 200, txBytes: 20 }] };
    render(<DeviceWorkspace domain="IT" branchId="b-mck-03" />);
    for (const name of ['Wi-Fi RSSI', 'Data transferred', 'Connection mix', 'Health by device type']) expect(screen.getByRole('heading', { name })).toBeTruthy();
    const signal = within(screen.getByRole('region', { name: 'Wi-Fi RSSI fleet chart' }));
    expect(signal.getByText('2 device traces')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Selected device' }));
    expect(signal.getByText('1 device traces')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'All devices' }));
    expect(signal.getByText('2 device traces')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Endpoint Alpha' }));
    expect(inspector().getByRole('heading', { name: 'Endpoint Alpha' })).toBeTruthy();
  });
  it('prioritizes attention, selects a device, and keeps its details tied to current inventory', () => {
    const { rerender } = render(<DeviceWorkspace domain="IT" branchId="b-mck-03" />);
    expect(inspector().getByRole('heading', { name: 'Endpoint Beta' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Endpoint Alpha, Healthy' }));
    expect(inspector().getByRole('heading', { name: 'Endpoint Alpha' })).toBeTruthy();
    expect(inspector().getByText('0m')).toBeTruthy();
    api.snapshot = { ...api.snapshot, devices: [makeDevice({ name: 'Endpoint renamed' })] };
    rerender(<DeviceWorkspace domain="IT" branchId="b-mck-03" />);
    expect(inspector().getByRole('heading', { name: 'Endpoint renamed' })).toBeTruthy();
  });
  it('filters by signal band, searches MAC, and clears filters', () => {
    render(<DeviceWorkspace domain="IT" branchId="b-mck-03" />);
    fireEvent.click(screen.getByRole('button', { name: /Weak.*1/ }));
    expect(screen.queryByRole('button', { name: 'Inspect Endpoint Alpha, Healthy' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search devices' }), { target: { value: 'AA:BB' } });
    expect(screen.getByText('No matching devices')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('button', { name: 'Inspect Endpoint Alpha, Healthy' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Device list' }));
    expect(screen.getByRole('table')).toBeTruthy();
  });
  it('never substitutes example devices for an empty or seeded feed', () => {
    api.snapshot = { ...api.snapshot, devices: [], source: 'seed' };
    render(<DeviceWorkspace domain="OT" branchId="b-mck-03" />);
    expect(screen.getByText('Waiting for gateway inventory')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export' }).hasAttribute('disabled')).toBe(true);
  });
  it('sends an explicit OT power command without inventing the reported state', async () => {
    api.snapshot.devices = [makeDevice({ id: 'shelly-a', name: 'Pump', domain: 'OT', kind: 'shelly', power: undefined })];
    render(<DeviceWorkspace domain="OT" branchId="b-mck-03" />);
    expect(api.shelly).not.toHaveBeenCalled();
    fireEvent.click(inspector().getByRole('button', { name: 'Turn on' }));
    await waitFor(() => expect(api.shelly).toHaveBeenCalledWith('shelly-a', 'On'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('command acknowledged'));
    expect(inspector().getByText('Unknown')).toBeTruthy();
  });
  it('surfaces a failed command and keeps the reported power state', async () => {
    api.snapshot.devices = [makeDevice({ id: 'matter-12', domain: 'OT', kind: 'matter', power: false })];
    api.matter.mockRejectedValueOnce(new Error('Gateway timeout'));
    render(<DeviceWorkspace domain="OT" branchId="b-mck-03" />);
    fireEvent.click(inspector().getByRole('button', { name: 'Turn on' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Gateway timeout'));
    expect(api.matter).toHaveBeenCalledWith(12, 'On');
    expect(inspector().getByText('Off')).toBeTruthy();
  });
  it('disables controls on disconnection and has no fake unlock action', () => {
    api.snapshot = { ...api.snapshot, connected: false, devices: [makeDevice({ kind: 'door_lock', domain: 'OT' })] };
    render(<DeviceWorkspace domain="OT" branchId="b-mck-03" />);
    expect(inspector().getByRole('button', { name: 'Move to IT inventory' }).hasAttribute('disabled')).toBe(true);
    expect(inspector().queryByRole('button', { name: /Unlock/i })).toBeNull();
    expect(api.classify).not.toHaveBeenCalled();
  });
  it('reclassifies only the inspected device after a deliberate action', async () => {
    render(<DeviceWorkspace domain="IT" branchId="b-mck-03" />);
    fireEvent.click(inspector().getByRole('button', { name: 'Move to OT inventory' }));
    await waitFor(() => expect(api.classify).toHaveBeenCalledWith('CC:DD', 'OT'));
  });
});
