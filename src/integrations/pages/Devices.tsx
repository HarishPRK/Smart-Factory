import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight, DoorClosed, Download, Flame,
  HelpCircle, Laptop, Lock, Monitor, PhoneCall, Plug, Power, Printer,
  RefreshCw, Search, Server, ShieldAlert, Smartphone, Tablet, Wind,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { AiInsightCard } from '../components/widgets/AiInsightCard';
import { DevicesDashboard } from '../components/widgets/DevicesDashboard';
import { Modal } from '../ui/Modal';
import {
  classifyDevice, controlMatterDevice, controlShellyDevice, refreshMatterDevices,
  useDevices, type DeviceView,
} from '../ui/useDevices';
import type { Device, Status } from '../types';
import { BRANCH_TO_IPSEC_SOURCE } from '../data/mock';

const fallback: Record<'b-mck-03' | 'b-pln-01', Device[]> = {
  'b-mck-03': [
    { id: 'mck-d1', name: 'Lap-Carlos', kind: 'laptop', domain: 'IT', ip: '10.30.1.12', mac: 'CC:22:33:44:55:01', status: 'ok', connectedForHours: 48, conn: 'wifi' },
    { id: 'mck-d2', name: 'Lap-Sarah', kind: 'laptop', domain: 'IT', ip: '10.30.1.13', mac: 'CC:22:33:44:55:02', status: 'ok', connectedForHours: 12, conn: 'wifi' },
    { id: 'mck-d3', name: 'Desk-FrontDesk', kind: 'desktop', domain: 'IT', ip: '10.30.1.20', mac: 'CC:22:33:44:55:03', status: 'ok', connectedForHours: 320, conn: 'wired' },
    { id: 'mck-d4', name: 'Canon-Printer', kind: 'printer', domain: 'IT', ip: '10.30.1.30', mac: 'CC:22:33:44:55:04', status: 'ok', connectedForHours: 510, conn: 'wired' },
    { id: 'mck-d5', name: 'POS-MCK-01', kind: 'payment', domain: 'IT', ip: '10.30.1.41', mac: 'CC:22:33:44:55:05', status: 'ok', connectedForHours: 88, conn: 'wifi' },
    { id: 'mck-d6', name: 'Srv-MCK', kind: 'server', domain: 'IT', ip: '10.30.1.50', mac: 'CC:22:33:44:55:06', status: 'ok', connectedForHours: 845, conn: 'wired' },
    { id: 'mck-o1', name: 'Fire-MCK-01', kind: 'fire_sensor', domain: 'OT', ip: '10.40.1.11', mac: 'DD:22:33:44:55:01', status: 'ok', connectedForHours: 1800, conn: 'wifi' },
    { id: 'mck-o3', name: 'Smoke-MCK-01', kind: 'smoke_sensor', domain: 'OT', ip: '10.40.1.21', mac: 'DD:22:33:44:55:03', status: 'ok', connectedForHours: 1800, conn: 'wifi' },
    { id: 'mck-o5', name: 'DL-MCK-Entry', kind: 'door_lock', domain: 'OT', ip: '10.40.1.31', mac: 'DD:22:33:44:55:05', status: 'ok', connectedForHours: 1200, conn: 'wifi' },
    { id: 'mck-o6', name: 'DL-MCK-Warehouse', kind: 'door_lock', domain: 'OT', ip: '10.40.1.32', mac: 'DD:22:33:44:55:06', status: 'ok', connectedForHours: 1200, conn: 'wifi' },
  ],
  'b-pln-01': [
    { id: 'd1', name: 'Lap-John', kind: 'laptop', domain: 'IT', ip: '10.10.1.12', mac: 'AA:11:22:33:44:55', status: 'ok', connectedForHours: 32, conn: 'wifi' },
    { id: 'd3', name: 'Desk-Recep', kind: 'desktop', domain: 'IT', ip: '10.10.1.20', mac: 'AA:11:22:33:44:57', status: 'ok', connectedForHours: 214, conn: 'wired' },
    { id: 'd4', name: 'HP-Printer', kind: 'printer', domain: 'IT', ip: '10.10.1.30', mac: 'AA:11:22:33:44:58', status: 'ok', connectedForHours: 680, conn: 'wired' },
    { id: 'd6', name: 'POS-02', kind: 'payment', domain: 'IT', ip: '10.10.1.42', mac: 'AA:11:22:33:44:5A', status: 'warn', connectedForHours: 1, conn: 'wifi' },
    { id: 'd7', name: 'Srv-Local', kind: 'server', domain: 'IT', ip: '10.10.1.50', mac: 'AA:11:22:33:44:5B', status: 'ok', connectedForHours: 1022, conn: 'wired' },
    { id: 'o1', name: 'Fire-01', kind: 'fire_sensor', domain: 'OT', ip: '10.20.1.11', mac: 'BB:11:22:33:44:01', status: 'ok', connectedForHours: 2100, conn: 'wifi' },
    { id: 'o3', name: 'Smoke-01', kind: 'smoke_sensor', domain: 'OT', ip: '10.20.1.21', mac: 'BB:11:22:33:44:03', status: 'ok', connectedForHours: 2100, conn: 'wifi' },
    { id: 'o5', name: 'DL-1-MainGate', kind: 'door_lock', domain: 'OT', ip: '10.20.1.31', mac: 'BB:11:22:33:44:05', status: 'ok', connectedForHours: 1500, conn: 'wifi' },
    { id: 'o6', name: 'DL-2-Server', kind: 'door_lock', domain: 'OT', ip: '10.20.1.32', mac: 'BB:11:22:33:44:06', status: 'err', connectedForHours: 0, conn: 'wifi' },
  ],
};

const iconFor: Record<Device['kind'], React.ComponentType<{ size?: number }>> = {
  laptop: Laptop, desktop: Monitor, printer: Printer, payment: ShieldAlert, server: Server,
  confphone: PhoneCall, fire_sensor: Flame, smoke_sensor: Wind, door_lock: DoorClosed,
  phone: Smartphone, tablet: Tablet, matter: Plug, shelly: Plug, generic: HelpCircle,
};
const labelFor: Record<Status, string> = { ok: 'Healthy', warn: 'Degraded', err: 'Offline', off: 'Inactive' };
const colorFor: Record<Status, string> = { ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)', off: 'var(--text-muted)' };

function connectedFor(hours: number) {
  if (hours <= 0) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.floor(hours)}h ${Math.floor((hours % 1) * 60)}m`;
  return `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h`;
}

function health(d: Device) {
  const t = d.telemetry;
  if (t?.apowerW != null) return `Live metering · ${t.apowerW.toFixed(1)} W${t.rssiDbm != null ? ` · RSSI ${t.rssiDbm} dBm` : ''}`;
  if (d.status === 'err') return 'Heartbeat lost — gateway cannot reach this device.';
  if (d.status === 'warn') return 'Link quality is below the healthy operating threshold.';
  return 'Heartbeat and connection quality are within operating thresholds.';
}

export function DevicesPage({ domain, branchId }: { domain: 'IT' | 'OT'; branchId: 'b-mck-03' | 'b-pln-01' }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'ok' | 'warn' | 'err'>('all');
  const [selected, setSelected] = useState<DeviceView | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<DeviceView | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [powerOverrides, setPowerOverrides] = useState<Record<string, boolean>>({});
  const [fallbackDomains, setFallbackDomains] = useState<Record<string, 'IT' | 'OT'>>({});
  const { devices: liveDevices, loaded, source, connected } = useDevices();
  const branchSource = BRANCH_TO_IPSEC_SOURCE[branchId];

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const allDevices = useMemo(() => {
    const scoped = liveDevices.filter((d) => d.locationSource === branchSource);
    const inventory = loaded && scoped.length
      ? scoped
      : fallback[branchId].map((d) => ({
        ...d,
        domain: fallbackDomains[d.mac] ?? d.domain,
        autoDomain: d.domain,
        overridden: fallbackDomains[d.mac] != null && fallbackDomains[d.mac] !== d.domain,
      }));
    return inventory as DeviceView[];
  }, [branchId, branchSource, fallbackDomains, liveDevices, loaded]);
  const counts = useMemo(() => ({
    all: allDevices.filter((d) => d.domain === domain).length,
    ok: allDevices.filter((d) => d.domain === domain && d.status === 'ok').length,
    warn: allDevices.filter((d) => d.domain === domain && d.status === 'warn').length,
    err: allDevices.filter((d) => d.domain === domain && d.status === 'err').length,
  }), [allDevices, domain]);
  const list = useMemo(() => allDevices.filter((d) => d.domain === domain)
    .filter((d) => filter === 'all' || d.status === filter)
    .filter((d) => !query || [d.name, d.ip, d.mac, d.kind].some((v) => v.toLowerCase().includes(query.toLowerCase()))), [allDevices, domain, filter, query]);

  async function refresh() {
    setRefreshing(true);
    try { await refreshMatterDevices(); setMessage('Refresh requested — the gateway is re-fetching its Matter inventory.'); }
    catch (error) { setMessage(`Refresh failed: ${error instanceof Error ? error.message : String(error)}`); }
    finally { window.setTimeout(() => setRefreshing(false), 1500); }
  }
  async function reclassify(d: DeviceView) {
    const next = d.domain === 'IT' ? 'OT' : 'IT';
    try {
      await classifyDevice(d.mac, next);
      setFallbackDomains((current) => ({ ...current, [d.mac]: next }));
      setMessage(`${d.name} moved to ${next}. The live inventory will update automatically.`);
    }
    catch (error) { setMessage(`Could not reclassify ${d.name}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  async function togglePower(d: DeviceView) {
    const isOn = powerOverrides[d.id] ?? d.power ?? false;
    const action = isOn ? 'Off' : 'On';
    setPowerOverrides((state) => ({ ...state, [d.id]: !isOn }));
    try {
      if (d.kind === 'shelly') await controlShellyDevice(d.id, action);
      else {
        const nodeId = Number(d.id.replace(/^matter-/, ''));
        if (!Number.isInteger(nodeId) || nodeId <= 0) throw new Error('The gateway did not provide a Matter node ID.');
        await controlMatterDevice(nodeId, action);
      }
      setMessage(`${d.name} turned ${action.toLowerCase()}.`);
    } catch (error) {
      setPowerOverrides((state) => ({ ...state, [d.id]: isOn }));
      setMessage(`${action} failed for ${d.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  function confirmUnlock() {
    if (!unlockTarget) return;
    setMessage(`${unlockTarget.name} unlocked. Reason logged: ${reason || 'Emergency unlock'}.`);
    setUnlockTarget(null); setReason('');
  }
  const title = domain === 'IT' ? 'IT Devices' : 'OT Devices';
  const subtitle = domain === 'IT' ? 'Laptops, endpoints, printers, POS and local infrastructure' : 'Fire and smoke sensors, locks and controllable IoT devices';
  const sourceLabel = source === 'gateway' ? (connected ? 'Live gateway inventory' : 'Gateway offline · last known') : 'Demo inventory · waiting for gateway';

  return (
    <div className="devices-page">
      {message && <div className="device-toast" role="status">{message}</div>}
      <PageHeader title={title} subtitle={`${subtitle} · ${branchSource}/ipsec/metrics`} right={<div className="toolbar"><span className="badge"><span className={`dot ${connected ? 'ok' : 'warn'}`} />{sourceLabel}</span><button type="button" onClick={refresh} disabled={refreshing}><RefreshCw size={14} className={refreshing ? 'spin' : undefined} />{refreshing ? 'Refreshing…' : 'Refresh'}</button><button type="button"><Download size={14} />Export</button></div>} />
      <div className="toolbar"><div style={{ position: 'relative' }}><Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} /><input aria-label="Search devices" placeholder="Search name, IP, MAC, or type" value={query} onChange={(event) => setQuery(event.target.value)} style={{ minWidth: 280, paddingLeft: 31 }} /></div>{(['all', 'ok', 'warn', 'err'] as const).map((status) => <button key={status} type="button" onClick={() => setFilter(status)} className={filter === status ? 'primary' : undefined}>{status === 'all' ? 'All' : labelFor[status]} <span className="dim">{counts[status]}</span></button>)}</div>
      <DevicesDashboard devices={list} />
      <AiInsightCard
        topic={domain === 'IT' ? 'it-devices' : 'ot-devices'}
        subtitle={`Bedrock analysis of the current ${domain} inventory`}
        data={{
          domain,
          total: list.length,
          counts,
          devices: list.map((d) => ({
            id: d.id, name: d.name, kind: d.kind, status: d.status, ip: d.ip,
            mac: d.mac, conn: d.conn, connectedForHours: d.connectedForHours,
          })),
        }}
      />
      <Card title="Live device inventory" sub={`Strictly scoped to ${branchSource}/ipsec/metrics; IT and OT classifications update across the shared stream.`}>
        <div className="device-table-wrap"><table><thead><tr><th>Device</th><th>Type</th><th>IP / MAC</th><th>Connection</th><th>Connected</th><th>Status · justification</th><th>Actions</th></tr></thead><tbody>{list.map((device) => {
          const Icon = iconFor[device.kind]; const isControllable = device.kind === 'matter' || device.kind === 'shelly'; const isOn = powerOverrides[device.id] ?? device.power ?? false;
          return <tr key={device.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(device)}><td><div className="device-name"><span className="device-kind"><Icon size={15} /></span><span>{device.name}{device.overridden && <small className="dim" style={{ marginLeft: 6 }}>manual</small>}</span></div></td><td style={{ textTransform: 'capitalize' }}>{device.kind.replace('_', ' ')}</td><td><div className="mono">{device.ip}</div><div className="mono dim">{device.mac}</div></td><td style={{ textTransform: 'uppercase', fontSize: 11 }}>{device.conn}</td><td>{connectedFor(device.connectedForHours)}</td><td><div className="device-inline-status"><span className={`dot ${device.status}`} /><span style={{ color: colorFor[device.status] }}>{labelFor[device.status]}</span></div><div className="device-health">{health(device)}</div></td><td onClick={(event) => event.stopPropagation()}><div className="device-actions">{!isControllable && <button type="button" title={`Move to ${device.domain === 'IT' ? 'OT' : 'IT'}`} onClick={() => reclassify(device)}><ArrowLeftRight size={13} />To {device.domain === 'IT' ? 'OT' : 'IT'}</button>}{device.kind === 'door_lock' && <button className="danger" type="button" onClick={() => setUnlockTarget(device)}><Lock size={13} />Unlock</button>}{isControllable && <button type="button" className={`power-toggle${isOn ? ' on' : ''}`} title={`Turn ${isOn ? 'off' : 'on'}`} onClick={() => togglePower(device)}><Power size={15} /></button>}</div></td></tr>;
        })}{list.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 34, color: 'var(--text-muted)' }}>No devices match the current filters.</td></tr>}</tbody></table></div>
      </Card>
      <Modal open={selected != null} onClose={() => setSelected(null)} title={selected?.name ?? 'Device details'} footer={<button type="button" onClick={() => setSelected(null)}>Close</button>}><div className="device-detail-grid">{selected && <><Detail label="IP address" value={selected.ip} /><Detail label="MAC address" value={selected.mac} /><Detail label="Classification" value={selected.domain} /><Detail label="Connection" value={selected.conn.toUpperCase()} /><Detail label="Connected for" value={connectedFor(selected.connectedForHours)} /><Detail label="Health" value={health(selected)} /></>}</div></Modal>
      <Modal open={unlockTarget != null} onClose={() => { setUnlockTarget(null); setReason(''); }} title={`Emergency unlock — ${unlockTarget?.name ?? ''}`} footer={<><button type="button" onClick={() => { setUnlockTarget(null); setReason(''); }}>Cancel</button><button className="danger" type="button" onClick={confirmUnlock}><Lock size={13} />Confirm unlock</button></>}><p>This will immediately unlock the door from the cloud. The action is logged with the reason below.</p><label style={{ display: 'block', marginTop: 12 }}><span className="dim">Reason</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Fire drill at 16:00" style={{ width: '100%', marginTop: 6 }} /></label></Modal>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
