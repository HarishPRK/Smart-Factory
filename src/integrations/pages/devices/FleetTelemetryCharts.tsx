import { useMemo, useState } from 'react';
import { Activity, ArrowDownUp, ChartNoAxesCombined, Wifi } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DeviceView } from '../../ui/useDevices';
import { finite, measurement, statusNames, transportNames, type DeviceHistory } from './deviceMetrics';
import { fleetChartRows, fleetTraces, type FleetTrace } from './fleetTelemetry';

const timeLabel = (time: number) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const tooltipStyle = { background: 'var(--panel-solid)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12, maxHeight: 260, overflowY: 'auto' as const };
const healthColors = { ok: '#6ed6a2', warn: '#e9bd70', err: '#f18b82', off: '#90aab7' };
const connectionColors = ['#43d8f1', '#82b5f6', '#c7a4ed', '#e9bd70'];

export function FleetTelemetryCharts({ devices, history, selectedId, onSelect, loading, error, refresh }: {
  devices: DeviceView[]; history: DeviceHistory; selectedId?: string; onSelect: (id: string) => void; loading: boolean; error: string; refresh: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const traces = useMemo(() => fleetTraces(devices, history), [devices, history]);
  const displayed = focused ? traces.filter(trace => trace.device.id === selectedId) : traces;
  const connectionMix = Object.entries(transportNames).map(([key, name], index) => ({ name, value: devices.filter(device => device.conn === key).length, color: connectionColors[index] })).filter(item => item.value > 0);
  const health = useMemo(() => {
    const groups = new Map<string, { name: string; ok: number; warn: number; err: number; off: number }>();
    for (const device of devices) {
      const name = device.kind.replaceAll('_', ' ');
      const row = groups.get(name) ?? { name, ok: 0, warn: 0, err: 0, off: 0 };
      row[device.status] += 1; groups.set(name, row);
    }
    return [...groups.values()];
  }, [devices]);
  return <section className="dw-fleet-telemetry" aria-label="Fleet telemetry charts">
    <div className="dw-fleet-chart-heading"><div><h3><ChartNoAxesCombined size={21} />Fleet telemetry</h3><p>Wi-Fi signal and data transferred across the current device inventory.</p></div><div className="dw-segment" aria-label="Chart device scope"><button type="button" aria-pressed={!focused} onClick={() => setFocused(false)}>All devices</button><button type="button" aria-pressed={focused} disabled={!selectedId} onClick={() => setFocused(true)}>Selected device</button></div></div>
    {error && <div className="dw-notice" role="status">History unavailable. Previously received samples remain visible.<button type="button" onClick={refresh}>Retry history</button></div>}
    <div className="dw-fleet-chart-grid">
      <FleetLineChart traces={displayed} metric="signal" selectedId={selectedId} loading={loading} />
      <section className="dw-fleet-profile" aria-label="Connection mix"><h4>Connection mix</h4><p>How devices reach the network</p><div className="dw-connection-chart">{connectionMix.length ? <><ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={connectionMix} dataKey="value" nameKey="name" innerRadius="65%" outerRadius="87%" stroke="none" paddingAngle={connectionMix.length > 1 ? 3 : 0} isAnimationActive={false}>{connectionMix.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer><div className="dw-donut-center"><strong>{devices.length}</strong><span>devices</span></div></> : <span className="dw-empty-chart">No devices received</span>}</div><ul className="dw-profile-legend">{connectionMix.map(item => <li key={item.name}><i style={{ background: item.color }} />{item.name}<strong>{item.value}</strong></li>)}</ul></section>
      <FleetLineChart traces={displayed} metric="transfer" selectedId={selectedId} loading={loading} />
      <section className="dw-fleet-profile" aria-label="Health by device type"><h4>Health by device type</h4><p>Reported status across equipment classes</p><div className="dw-type-chart" style={{ height: Math.max(210, health.length * 32 + 28) }}>{health.length ? <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={health} layout="vertical" margin={{ left: 0, right: 10, bottom: 8 }} accessibilityLayer><CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 5" /><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><YAxis type="category" dataKey="name" width={90} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--dw-raised)' }} />{Object.entries(healthColors).map(([key, color]) => <Bar key={key} dataKey={key} name={statusNames[key as keyof typeof statusNames]} stackId="health" fill={color} maxBarSize={20} isAnimationActive={false} />)}</BarChart></ResponsiveContainer> : <span className="dw-empty-chart">No device health received</span>}</div><ul className="dw-profile-legend dw-health-chart-legend">{Object.entries(healthColors).map(([key, color]) => <li key={key}><i style={{ background: color }} />{statusNames[key as keyof typeof statusNames]}</li>)}</ul></section>
    </div>
    <details className="dw-trace-legend" open><summary>Device traces <span>{traces.length}</span><small>Select a device to highlight it and update the inspector.</small></summary><div>{traces.map(trace => <button type="button" key={trace.key} aria-pressed={trace.device.id === selectedId} onClick={() => onSelect(trace.device.id)} title={`${trace.device.name} · ${trace.device.mac}`}><i style={{ background: trace.color }} /><span>{trace.device.name}</span></button>)}</div></details>
  </section>;
}

function FleetLineChart({ traces, metric, selectedId, loading }: { traces: FleetTrace[]; metric: 'signal' | 'transfer'; selectedId?: string; loading: boolean }) {
  const rows = useMemo(() => fleetChartRows(traces, metric), [traces, metric]);
  const measured = traces.filter(trace => trace[metric].some(point => finite(point.value)));
  const unit = metric === 'signal' ? 'dBm' : 'MB';
  const title = metric === 'signal' ? 'Wi-Fi RSSI' : 'Data transferred';
  const Icon = metric === 'signal' ? Wifi : ArrowDownUp;
  return <section className="dw-fleet-line" aria-label={`${title} fleet chart`}>
    <div className="dw-section-heading"><h4><Icon size={18} />{title}</h4><span>{measured.length} device traces</span></div><p>{metric === 'signal' ? 'Measured signal strength · dBm' : 'Cumulative receive + transmit · MB since each device’s first sample'}</p>
    {measured.length ? <><div className="dw-fleet-line-canvas" role="img" aria-label={`${title} for ${measured.length} devices, from ${timeLabel(rows[0].t)} to ${timeLabel(rows.at(-1)!.t)}.`}><ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={rows} margin={{ top: 20, right: 22, bottom: 5, left: 0 }} accessibilityLayer><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" /><XAxis type="number" dataKey="t" domain={['dataMin', 'dataMax']} tickFormatter={timeLabel} minTickGap={45} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis domain={metric === 'signal' ? ['auto', 'auto'] : [0, 'auto']} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} width={48} />{metric === 'signal' && <><ReferenceLine y={-60} stroke="#6ed6a2" strokeDasharray="4 5" ifOverflow="extendDomain" /><ReferenceLine y={-75} stroke="#e9bd70" strokeDasharray="4 5" ifOverflow="extendDomain" /></>}<Tooltip labelFormatter={value => timeLabel(Number(value))} formatter={(value, name) => [`${measurement(Number(value), 2)} ${unit}`, name]} contentStyle={tooltipStyle} />{measured.map(trace => <Line key={trace.key} name={trace.device.name} dataKey={trace.key} stroke={trace.color} strokeWidth={trace.device.id === selectedId ? 2.7 : 1.3} strokeOpacity={trace.device.id === selectedId ? 1 : .75} type="linear" dot={trace[metric].filter(point => finite(point.value)).length < 3 ? { r: 3 } : false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />)}</LineChart></ResponsiveContainer></div><div className="dw-fleet-chart-foot"><span>{metric === 'signal' ? 'Reference bands: −60 / −75 dBm' : 'Counter resets rebase the trace; unobserved bytes are excluded.'}</span><span>Latest sample per time bucket</span></div></> : <div className="dw-empty-chart"><Activity size={26} /><strong>{loading ? 'Loading fleet history' : `Waiting for ${title.toLowerCase()} readings`}</strong><span>Received device measurements will appear here automatically.</span></div>}
  </section>;
}
