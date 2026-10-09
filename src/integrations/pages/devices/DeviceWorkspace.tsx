import { useMemo, useState, type CSSProperties } from 'react';
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, ChevronRight, Clock3, Cpu, Download, EthernetPort, Flame, LayoutGrid, List, LockKeyhole, Monitor, Plug, Power, Radio, RefreshCw, Search, ShieldCheck, Signal, SlidersHorizontal, Wifi, X } from 'lucide-react';
import { AiInsightCard } from '../../components/widgets/AiInsightCard';
import { classifyDevice, controlMatterDevice, controlShellyDevice, refreshMatterDevices, useDevices, type DeviceView } from '../../ui/useDevices';
import type { Device, Status } from '../../types';
import { DeviceHistoryChart } from './DeviceHistoryChart';
import { useDeviceHistory } from './useDeviceHistory';
import { duration, finite, measurement, scopeInventory, signalBand, signalBands, statusNames, statusOrder, transportNames, type DeviceBranch, type DeviceHistory } from './deviceMetrics';

const statuses: Status[] = ['ok', 'warn', 'err', 'off'];
const transports: Device['conn'][] = ['wifi', 'wired', 'poe', 'thread'];
const statusColor = (status: Status) => `var(--${status === 'ok' ? 'ok' : status === 'warn' ? 'warn' : status === 'err' ? 'err' : 'text-muted'})`;
const timestampLabel = (value?: number) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Not received';
const kindLabel = (kind: string) => kind.replaceAll('_', ' ');
function DeviceIcon({ device, size = 20 }: { device: Device; size?: number }) {
  const Icon = device.kind === 'door_lock' ? LockKeyhole : device.kind === 'fire_sensor' || device.kind === 'smoke_sensor' ? Flame : device.kind === 'matter' || device.kind === 'shelly' ? Plug : device.domain === 'OT' ? Cpu : Monitor;
  return <Icon size={size} aria-hidden="true" />;
}
function StatusLabel({ status }: { status: Status }) {
  return <span className="dw-status" style={{ color: statusColor(status) }}><i />{statusNames[status]}</span>;
}

export function DeviceWorkspace({ domain, branchId }: { domain: 'IT' | 'OT'; branchId: DeviceBranch }) {
  const snapshot = useDevices();
  const { history, loading, error, refresh } = useDeviceHistory();
  const { devices, feed, received, timestamp } = useMemo(() => scopeInventory(snapshot, branchId, domain), [snapshot, branchId, domain]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [transport, setTransport] = useState<Device['conn'] | 'all'>('all');
  const [band, setBand] = useState('all');
  const [view, setView] = useState<'matrix' | 'list'>('matrix');
  const [sort, setSort] = useState<'attention' | 'name' | 'signal'>('attention');
  const [selectedId, setSelectedId] = useState<string>();
  const [pending, setPending] = useState('');
  const [notice, setNotice] = useState<{ text: string; error: boolean }>();
  const counts = Object.fromEntries(statuses.map(key => [key, devices.filter(d => d.status === key).length])) as Record<Status, number>;
  const wifiDevices = devices.filter(device => device.conn === 'wifi');
  const signals = wifiDevices.map(device => device.telemetry?.rssiDbm).filter(finite);
  const avgSignal = signals.length ? signals.reduce((a, b) => a + b, 0) / signals.length : undefined;
  const measuredPower = devices.map(device => device.telemetry?.apowerW).filter(finite);
  const list = devices.filter(device => (status === 'all' || device.status === status) && (transport === 'all' || device.conn === transport) && (band === 'all' || (device.conn === 'wifi' && signalBand(device.telemetry?.rssiDbm) === band)) && [device.name, device.ip, device.mac, device.kind].some(value => value.toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a, b) => (sort === 'attention' ? statusOrder[a.status] - statusOrder[b.status] : sort === 'signal' ? (a.telemetry?.rssiDbm ?? Infinity) - (b.telemetry?.rssiDbm ?? Infinity) : 0) || a.name.localeCompare(b.name));
  const selected = list.find(device => device.id === selectedId) ?? list[0];
  const filtered = query !== '' || status !== 'all' || transport !== 'all' || band !== 'all';
  const reset = () => { setQuery(''); setStatus('all'); setTransport('all'); setBand('all'); };
  const sourceState = !snapshot.loaded ? 'Connecting to inventory' : !received ? 'Awaiting gateway feed' : snapshot.connected ? 'Gateway connected' : 'Last known inventory';

  async function runAction(key: string, action: () => Promise<void>, success: string) {
    setPending(key); setNotice(undefined);
    try { await action(); setNotice({ text: success, error: false }); }
    catch (reason) { setNotice({ text: reason instanceof Error ? reason.message : 'Request failed. Please try again.', error: true }); }
    finally { setPending(''); }
  }
  function exportInventory() {
    const blob = new Blob([JSON.stringify({ domain, feed, inventoryReceivedAt: timestamp ?? null, exportedAt: new Date().toISOString(), filters: { query, status, transport, band }, devices: list }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${domain.toLowerCase()}-devices-${feed}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="device-workspace" data-domain={domain}>
    <header className="dw-header">
      <div><h2>{domain === 'IT' ? 'IT device intelligence' : 'OT device intelligence'}</h2><p>{domain === 'IT' ? 'Explore every endpoint. Isolate the signal that matters.' : 'Inspect connected equipment, reported states and energy use.'}</p></div>
      <div className="dw-header-actions"><span className="dw-source"><i className={received && snapshot.connected ? 'connected' : ''} />{sourceState}</span><button type="button" onClick={refresh} title="Reload measured history"><RefreshCw size={15} />Refresh history</button><button type="button" onClick={exportInventory} disabled={!list.length}><Download size={15} />Export</button></div>
    </header>
    <div className="dw-feed-line"><span><Radio size={13} /><code>{feed}/ipsec/metrics</code></span><span><Clock3 size={13} />Inventory {timestampLabel(timestamp)}</span></div>
    {notice && <div className={`dw-notice${notice.error ? ' is-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.error ? <Activity size={17} /> : <Check size={17} />}<span>{notice.text}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice(undefined)}><X size={15} /></button></div>}

    <section className="dw-overview" aria-label="Fleet overview">
      <div className="dw-fleet-total"><strong>{received ? devices.length : '—'}</strong><div><h3>{domain === 'IT' ? 'Endpoints' : 'Connected equipment'}</h3><p>{branchId === 'b-mck-03' ? 'McKinney' : 'Plano'} · {domain} inventory</p></div></div>
      <div className="dw-fleet-health"><div className="dw-health-track" aria-label="Reported device health">{statuses.filter(key => counts[key]).map(key => <span key={key} style={{ flex: counts[key], background: statusColor(key) }} title={`${counts[key]} ${statusNames[key]}`} />)}</div><div className="dw-health-legend">{statuses.map(key => <button type="button" key={key} aria-pressed={status === key} onClick={() => setStatus(status === key ? 'all' : key)}><i style={{ background: statusColor(key) }} /><b>{counts[key]}</b>{statusNames[key]}</button>)}</div></div>
      <div className="dw-overview-reading">{domain === 'IT' ? <Wifi size={22} /> : <Power size={22} />}<div><span>{domain === 'IT' ? 'Average Wi-Fi signal' : 'Reported power total'}</span><strong>{domain === 'IT' ? measurement(avgSignal, 0) : measurement(measuredPower.length ? measuredPower.reduce((a, b) => a + b, 0) : undefined)} <small>{domain === 'IT' ? 'dBm' : 'W'}</small></strong><small>{domain === 'IT' ? `${signals.length} / ${wifiDevices.length} Wi-Fi readings` : `${measuredPower.length} / ${devices.length} devices reporting`}</small></div></div>
    </section>

    <div className="dw-workbench">
      <section className="dw-fleet" aria-label="Fleet exploration">
        <div className="dw-fleet-heading"><div><h3>Explore the fleet</h3><p>Select a device to inspect its telemetry.</p></div><div className="dw-segment" aria-label="Inventory presentation"><button type="button" aria-label="Device matrix" aria-pressed={view === 'matrix'} onClick={() => setView('matrix')}><LayoutGrid size={16} />Matrix</button><button type="button" aria-label="Device list" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={16} />List</button></div></div>
        <div className="dw-filters"><label className="dw-search"><Search size={17} /><input aria-label="Search devices" placeholder="Search device, IP or MAC…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}</label><label className="dw-sort"><SlidersHorizontal size={15} /><select aria-label="Sort devices" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="attention">Attention first</option><option value="name">Device name</option><option value="signal">Weakest signal</option></select></label></div>
        <div className="dw-transports"><button type="button" aria-pressed={transport === 'all'} onClick={() => { setTransport('all'); setBand('all'); }}>All connections <b>{devices.length}</b></button>{transports.filter(key => devices.some(device => device.conn === key)).map(key => <button type="button" key={key} aria-pressed={transport === key} onClick={() => { setTransport(transport === key ? 'all' : key); setBand('all'); }}>{key === 'wifi' ? <Wifi size={13} /> : key === 'thread' ? <Radio size={13} /> : <EthernetPort size={13} />}{transportNames[key]}<b>{devices.filter(device => device.conn === key).length}</b></button>)}</div>
        <div className="dw-results"><span>{list.length} of {devices.length} devices{status !== 'all' ? ` · ${statusNames[status]}` : ''}{band !== 'all' ? ` · ${band} signal` : ''}</span>{filtered && <button type="button" onClick={reset}><X size={12} />Clear filters</button>}</div>
        {!list.length ? <div className="dw-empty"><Radio size={34} /><h4>{filtered ? 'No matching devices' : received ? `No ${domain} devices in this feed` : 'Waiting for gateway inventory'}</h4><p>{filtered ? 'Try another search or clear the filters.' : received ? 'Devices will appear as the gateway discovers and classifies them.' : `Connect the ${feed} feed to explore reported devices.`}</p>{filtered && <button type="button" onClick={reset}>Show all devices</button>}</div> : view === 'matrix' ? <div className="dw-device-matrix" aria-label="Device matrix">{list.map(device => <button type="button" key={device.id} className="dw-device-tile" aria-pressed={selected?.id === device.id} aria-label={`Inspect ${device.name}, ${statusNames[device.status]}`} onClick={() => setSelectedId(device.id)} style={{ '--device-color': statusColor(device.status) } as CSSProperties}>
          <div className="dw-tile-top"><DeviceIcon device={device} /><StatusLabel status={device.status} /></div><strong title={device.name}>{device.name}</strong><span className="dw-tile-address">{device.ip || device.mac || 'Address not reported'}</span><div className="dw-tile-bottom"><span>{transportNames[device.conn]}</span>{domain === 'OT' && finite(device.telemetry?.apowerW) ? <b>{measurement(device.telemetry?.apowerW)} W</b> : <span className="dw-mini-signal" title={finite(device.telemetry?.rssiDbm) ? `${device.telemetry?.rssiDbm} dBm` : 'Signal not reported'}>{[0, 1, 2, 3, 4].map(index => <i key={index} style={{ height: 4 + index * 2.5, opacity: finite(device.telemetry?.rssiDbm) && device.telemetry.rssiDbm >= -90 + index * 10 ? 1 : 0.22 }} />)}</span>}</div>
        </button>)}</div> : <div className="dw-inventory-list"><table><thead><tr><th>Device / address</th><th>Connection</th><th>Health</th><th>Signal</th></tr></thead><tbody>{list.map(device => <tr key={device.id} className={selected?.id === device.id ? 'is-selected' : ''}><td><button type="button" aria-pressed={selected?.id === device.id} onClick={() => setSelectedId(device.id)}><DeviceIcon device={device} size={17} /><span><strong>{device.name}</strong><small>{device.ip || device.mac || '—'}</small></span><ChevronRight size={14} /></button></td><td>{transportNames[device.conn]}</td><td><StatusLabel status={device.status} /></td><td>{measurement(device.telemetry?.rssiDbm, 0)} <small>dBm</small></td></tr>)}</tbody></table></div>}

        <section className="dw-distribution" aria-label="Fleet Wi-Fi signal distribution"><div className="dw-section-heading"><h4><Signal size={17} />Signal distribution</h4><span>{signals.length} Wi-Fi readings</span></div><p>Signal strength across the fleet · select a band to filter</p><div className="dw-signal-bands">{signalBands.map(group => { const count = wifiDevices.filter(device => signalBand(device.telemetry?.rssiDbm) === group.key).length; return <button type="button" key={group.key} aria-pressed={band === group.key} onClick={() => { setTransport('wifi'); setBand(band === group.key ? 'all' : group.key); }} style={{ '--band-color': group.color } as CSSProperties}><span>{group.label}<b>{count}</b></span><div className="dw-band-track"><i style={{ width: `${signals.length ? count / signals.length * 100 : 0}%` }} /></div><small>{group.range}</small></button>; })}</div><small>{wifiDevices.length - signals.length} Wi-Fi devices without signal readings. Bands describe signal strength, not device health.</small></section>
      </section>
      <aside className="dw-inspector" aria-label="Device inspector">{selected ? <DeviceInspector key={selected.id} device={selected} history={history} loading={loading} historyError={error} refresh={refresh} pending={pending} connected={snapshot.connected} runAction={runAction} /> : <div className="dw-empty"><Cpu size={32} /><h3>Device inspector</h3><p>Select a reported device to explore its connection and measured history.</p></div>}</aside>
    </div>
    {received && devices.length > 0 && <details className="dw-ai"><summary><ShieldCheck size={19} /><span>Fleet analysis<small>Ask AI to interpret this inventory and prioritize attention.</small></span><ChevronRight size={18} /></summary><AiInsightCard key={`${domain}:${feed}`} topic={domain === 'IT' ? 'it-devices' : 'ot-devices'} title={`${domain} fleet analysis`} subtitle="Analyze the current filtered device inventory" sourceLabel={snapshot.connected ? 'received gateway inventory' : 'last known gateway inventory'} sourceTimestamp={timestamp} data={{ domain, feed, counts, filters: { query, status, transport, band }, devices: list }} /></details>}
  </div>;
}

function DeviceInspector({ device, history, loading, historyError, refresh, pending, connected, runAction }: {
  device: DeviceView; history: DeviceHistory; loading: boolean; historyError: string; refresh: () => void; pending: string; connected: boolean;
  runAction: (key: string, action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const telemetry = device.telemetry;
  const controllable = device.kind === 'shelly' || device.kind === 'matter';
  const power = finite(telemetry?.apowerW);
  const nodeId = Number(device.id.replace(/^matter-/, ''));
  const controlAvailable = connected && device.status !== 'err' && (device.kind === 'shelly' || (Number.isInteger(nodeId) && nodeId > 0));
  const sendPower = (action: 'On' | 'Off') => runAction(`${device.id}:${action}`, () => device.kind === 'shelly' ? controlShellyDevice(device.id, action) : controlMatterDevice(nodeId, action), `${device.name}: ${action.toLowerCase()} command acknowledged. Waiting for the next reported state.`);
  return <>
    <div className="dw-inspector-heading"><span>Device inspector</span><StatusLabel status={device.status} /></div>
    <div className="dw-device-identity"><div className="dw-device-emblem"><DeviceIcon device={device} size={32} /></div><div><h3>{device.name}</h3><p>{kindLabel(device.kind)} · {transportNames[device.conn]}</p></div></div>
    <dl className="dw-identity-facts"><div><dt>IP address</dt><dd>{device.ip || 'Not reported'}</dd></div><div><dt>MAC address</dt><dd>{device.mac || 'Not reported'}</dd></div><div><dt>Connected for</dt><dd>{duration(device.connectedForHours)}</dd></div><div><dt>Classification</dt><dd>{device.domain} · {device.overridden ? 'Manual' : 'Automatic'}</dd></div></dl>
    <div className="dw-device-measurements"><div><span><ArrowDownLeft size={15} />Receive</span><strong>{measurement(telemetry?.rxMbps, 2)}<small>Mbps</small></strong></div><div><span><ArrowUpRight size={15} />Transmit</span><strong>{measurement(telemetry?.txMbps, 2)}<small>Mbps</small></strong></div><div><span>{power ? <Power size={15} /> : <Wifi size={15} />}{power ? 'Active power' : 'Wi-Fi signal'}</span><strong>{measurement(power ? telemetry?.apowerW : telemetry?.rssiDbm, power ? 1 : 0)}<small>{power ? 'W' : 'dBm'}</small></strong></div></div>
    <DeviceHistoryChart points={history[device.mac.toUpperCase()] ?? []} power={power} loading={loading} error={historyError} refresh={refresh} />
    <details className="dw-extra-readings"><summary>More device readings<ChevronRight size={15} /></summary><dl>{([
      ['Voltage', measurement(telemetry?.voltageV), 'V'], ['Current', measurement(telemetry?.currentA, 3), 'A'], ['Energy counter', measurement(telemetry?.energyWhTotal), 'Wh'], ['Device temperature', measurement(telemetry?.tempC), '°C'], ['Signal / noise', measurement(telemetry?.snrDb), 'dB'], ['Link receive rate', measurement(telemetry?.linkDownMbps), 'Mbps'], ['Link transmit rate', measurement(telemetry?.linkUpMbps), 'Mbps'], ['Wi-Fi standard', telemetry?.wifiStandard || '—', ''], ['Gateway link verdict', telemetry?.wifiHealth || '—', ''],
    ]).map(([label, value, unit]) => <div key={label}><dt>{label}</dt><dd>{value} <small>{unit}</small></dd></div>)}</dl></details>
    <section className="dw-device-actions"><h4>Device actions</h4>{controllable && <><div className="dw-reported-power"><Power size={15} /><span>Reported power</span><strong>{device.power == null ? 'Unknown' : device.power ? 'On' : 'Off'}</strong></div><div className="dw-control-row"><button type="button" disabled={!!pending || !controlAvailable} onClick={() => void sendPower('On')}><Power size={14} />{pending === `${device.id}:On` ? 'Sending…' : 'Turn on'}</button><button type="button" disabled={!!pending || !controlAvailable} onClick={() => void sendPower('Off')}>{pending === `${device.id}:Off` ? 'Sending…' : 'Turn off'}</button></div></>}
      {device.kind === 'matter' && <button type="button" disabled={!!pending || !connected} onClick={() => void runAction('refresh-matter', refreshMatterDevices, 'Matter inventory refresh requested. New readings arrive through the gateway feed.')}><RefreshCw size={14} />{pending === 'refresh-matter' ? 'Requesting…' : 'Refresh Matter inventory'}</button>}
      <button type="button" disabled={!!pending || !connected} onClick={() => void runAction('classify', () => classifyDevice(device.mac, device.domain === 'IT' ? 'OT' : 'IT'), `${device.name}: classification change accepted. Inventory will update automatically.`)}><ArrowLeftRight size={14} />{pending === 'classify' ? 'Updating…' : `Move to ${device.domain === 'IT' ? 'OT' : 'IT'} inventory`}</button>
      {device.kind === 'door_lock' && <p>Remote unlock is not connected for this device.</p>}
      {!connected && <p>Commands are unavailable while the gateway is disconnected.</p>}
    </section>
  </>;
}
