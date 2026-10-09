import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { finite, measurement, withHistoryGaps, type HistoryPoint } from './deviceMetrics';

const modes = {
  signal: { label: 'Signal', unit: 'dBm', keys: ['rssiDbm'] },
  traffic: { label: 'Traffic', unit: 'Mbps', keys: ['rxMbps', 'txMbps'] },
  power: { label: 'Power', unit: 'W', keys: ['apowerW'] },
} as const;
const names = { rssiDbm: 'Signal', rxMbps: 'Receive', txMbps: 'Transmit', apowerW: 'Power' };
const timeLabel = (time: number) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function DeviceHistoryChart({ points, power, loading, error, refresh }: {
  points: HistoryPoint[]; power: boolean; loading: boolean; error: string; refresh: () => void;
}) {
  const [mode, setMode] = useState<keyof typeof modes>(power ? 'power' : 'signal');
  const config = modes[mode];
  const rows = useMemo(() => withHistoryGaps(points), [points]);
  const measured = points.filter(point => config.keys.some(key => finite(point[key])));
  const latest = measured.at(-1);
  const allValues = measured.flatMap(point => config.keys.map(key => point[key]).filter(finite));
  return <section className="dw-history" aria-label="Selected device history">
    <div className="dw-section-heading"><h4>Measured history</h4><span>{measured.length} samples</span></div>
    <div className="dw-segment" aria-label="History metric">{Object.entries(modes).map(([key, value]) => <button type="button" key={key} aria-pressed={key === mode} onClick={() => setMode(key as keyof typeof modes)}>{value.label}</button>)}</div>
    {error && <p className="dw-notice" role="status">{error}. Previous samples retained. <button type="button" onClick={refresh}>Retry</button></p>}
    {measured.length ? <>
      <div className="dw-history-legend">{config.keys.map((key, index) => <span key={key}><i style={{ background: index ? 'var(--warn)' : 'var(--accent)' }} />{names[key]} <strong>{measurement(latest?.[key], 2)}</strong> {config.unit}</span>)}</div>
      <div className="dw-chart" role="img" aria-label={`${config.label} history: ${measured.length} received samples. Minimum ${measurement(Math.min(...allValues), 2)}, maximum ${measurement(Math.max(...allValues), 2)} ${config.unit}.`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 8, left: -18 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={timeLabel} minTickGap={45} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={mode === 'signal' ? ['auto', 'auto'] : [0, 'auto']} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={58} />
            <Tooltip labelFormatter={value => timeLabel(Number(value))} formatter={(value, name) => [`${measurement(Number(value), 3)} ${config.unit}`, name]} contentStyle={{ background: 'var(--panel-solid)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} />
            {config.keys.map((key, index) => <Line key={key} name={names[key]} dataKey={key} type="linear" stroke={index ? 'var(--warn)' : 'var(--accent)'} strokeWidth={2} dot={measured.length < 3 ? { r: 3 } : false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="dw-chart-caption">Last sample {latest ? timeLabel(latest.t) : '—'} · Gateway session history</p>
    </> : <div className="dw-empty-chart"><Activity size={28} /><strong>{loading ? 'Loading device history' : `No ${config.label.toLowerCase()} samples yet`}</strong><span>Readings appear here when this device reports them.</span></div>}
  </section>;
}
