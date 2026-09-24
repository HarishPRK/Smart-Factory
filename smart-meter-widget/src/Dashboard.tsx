import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Box, Cable, Check, ChevronRight, CircleHelp, CircuitBoard, Download, Expand, FileText, Gauge, Layers3, Maximize2, Orbit, Pause, Play, Radio, RotateCcw, ShieldCheck, SlidersHorizontal, Sun, Thermometer, TriangleAlert, Waves, Wifi, X, Zap } from 'lucide-react'
import { useMeterStore } from './useMeterStore'
import { startMeterStream } from './meter/transport'
import type { CameraPreset, MeterFault } from './meter/types'

const MeterScene = lazy(() => import('./MeterScene'))
const number = (value: number, digits = 1) => value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const faultNames: Record<MeterFault, string> = { sag: 'Voltage sag', surge: 'Voltage surge', overcurrent: 'Overcurrent', reversePolarity: 'Reverse polarity', tamper: 'Tamper alarm' }
const cameras: { id: CameraPreset; label: string }[] = [{ id: 'front', label: 'Front register' }, { id: 'terminals', label: 'Terminal jaw base' }, { id: 'isometric', label: 'Isometric inspection' }]
type EventEntry = { time: number; text: string; severity: 'info' | 'warning' }

function TrendChart() {
  const history = useMeterStore(s => s.history)
  const svgRef = useRef<SVGSVGElement>(null)
  const [chartWidth, setChartWidth] = useState(750)
  useEffect(() => {
    const node = svgRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setChartWidth(Math.max(220, entry.contentRect.width)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const [metric, setMetric] = useState<'activePower' | 'voltage' | 'current'>('activePower')
  const [range, setRange] = useState(120)
  const unit = metric === 'activePower' ? 'kW' : metric === 'voltage' ? 'V' : 'A'
  const divisor = metric === 'activePower' ? 1000 : 1
  const end = history.at(-1)?.timestamp ?? 0
  const points = history.filter(point => point.timestamp >= end - range * 1000)
  const values = points.map(point => point[metric] / divisor)
  const lo = metric === 'voltage' ? Math.min(210, ...values) - 5 : Math.min(0, ...values) * 1.1
  const hi = metric === 'voltage' ? Math.max(255, ...values) + 5 : Math.max(metric === 'current' ? 60 : 12, ...values) * 1.1
  const y = (value: number) => 148 - (value - lo) / (hi - lo) * 116
  const plotWidth = chartWidth - 64
  const x = (time: number) => 44 + (time - end + range * 1000) / (range * 1000) * plotWidth
  const path = points.map((point, i) => `${i ? 'L' : 'M'}${x(point.timestamp).toFixed(2)},${y(point[metric] / divisor).toFixed(2)}`).join(' ')
  const last = points.at(-1)
  return <section className="surface trend-panel" aria-labelledby="trend-title">
    <div className="section-heading"><h2 id="trend-title"><Activity size={17} />Electrical trend</h2><div className="segment compact" aria-label="Chart time range">{[60, 120].map(value => <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value === 60 ? '1 min' : '2 min'}</button>)}</div></div>
    <div className="chart-series"><div className="series-buttons">{(['activePower', 'voltage', 'current'] as const).map(key => <button key={key} aria-pressed={metric === key} onClick={() => setMetric(key)}><i />{key === 'activePower' ? 'Active power' : key === 'voltage' ? 'Voltage' : 'Current'}</button>)}</div><span className="mono">{last ? number(last[metric] / divisor, 2) : '—'} {unit}</span></div>
    <svg ref={svgRef} viewBox={`0 0 ${chartWidth} 180`} role="img" aria-label={`${metric === 'activePower' ? 'Active power' : metric} over the past ${range} seconds; ${points.length} recorded samples`}>
      <defs><linearGradient id="meter-chart-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#008777" stopOpacity=".14"/><stop offset="100%" stopColor="#008777" stopOpacity="0"/></linearGradient></defs>
      {[0, 1, 2, 3].map(i => { const value = lo + (hi - lo) * i / 3; return <g key={i}><line x1="44" x2={chartWidth - 20} y1={y(value)} y2={y(value)} stroke="#dde5e8" strokeDasharray="3 5"/><text x="2" y={y(value) + 4}>{number(value, metric === 'activePower' ? 1 : 0)}</text></g> })}
      {points.length > 1 && <><path d={`${path} L${x(last!.timestamp)},${y(Math.max(lo, 0))} L${x(points[0].timestamp)},${y(Math.max(lo, 0))} Z`} fill="url(#meter-chart-area)"/><path d={path} fill="none" stroke="#008777" strokeWidth="2.2" strokeLinejoin="round"/><circle cx={x(last!.timestamp)} cy={y(last![metric] / divisor)} r="3.4" fill="#008777"/></>}
      {(chartWidth < 400 ? [0, 2, 4] : [0, 1, 2, 3, 4]).map(i => <text key={i} x={44 + i * plotWidth / 4} y="175" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{i === 4 ? 'Now' : `−${range - range * i / 4}s`}</text>)}
    </svg>
    <div className="chart-foot"><span><i className="status-dot" />{points.length < 2 ? 'Collecting the first samples…' : `${points.length} recorded samples`}</span><span>1 s history resolution · {unit}</span></div>
  </section>
}

function TelemetryPanel() {
  const t = useMeterStore(s => s.telemetry)
  const impPerKwh = useMeterStore(s => s.impPerKwh)
  const source = useMeterStore(s => s.source)
  const paused = useMeterStore(s => s.paused)
  const connection = useMeterStore(s => s.connection)
  const lastPacketAt = useMeterStore(s => s.lastPacketAt)
  const isFresh = source === 'simulation' ? !paused && connection === 'simulated' : connection === 'connected'
  const pulseHz = Math.abs(t.activePower) / 1000 * impPerKwh / 3600
  if (source !== 'simulation' && lastPacketAt === null) return <aside className="surface live-panel awaiting-panel" aria-label="Awaiting remote telemetry"><div className="section-heading"><h2><Radio size={17}/>Live telemetry</h2><span className="tag">AWAITING DATA</span></div><div><Wifi size={32}/><h3>Waiting for the meter</h3><p>No valid telemetry packet has arrived. Readings will appear when the gateway connects and sends data.</p><span className="mono">{source.toUpperCase()} · {connection}</span></div></aside>
  return <aside className="surface live-panel" aria-labelledby="live-title">
    <div className="section-heading"><h2 id="live-title"><Radio size={17}/>Live telemetry</h2><span className={`small-status ${isFresh ? '' : 'muted-status'}`}><i className="status-dot"/>{isFresh ? 'STREAMING' : paused ? 'PAUSED' : 'OFFLINE'}</span></div>
    <div className="power-reading"><div className="flex items-center justify-between"><span>Active power</span><span className={`flow-label ${t.reverseEnergy ? 'exporting' : ''}`}>{t.reverseEnergy ? <ArrowUpRight size={13}/> : <ArrowDownLeft size={13}/>} {t.reverseEnergy ? 'Exporting' : 'Importing'}</span></div><div><strong>{number(t.activePower / 1000, 2)}</strong><span>kW</span></div><div className="load-track"><i style={{ transform: `scaleX(${Math.min(1, Math.abs(t.activePower) / 48000)})` }}/></div><small>{number(t.current / 200 * 100, 1)}% of rated current <span>CL200</span></small></div>
    <div className="readings-grid">
      <div><span><Waves size={14}/>Line voltage</span><strong>{number(t.voltage, 1)}<small>V</small></strong><em>L1–L2 · 240 V nominal</em></div>
      <div><span><Zap size={14}/>Load current</span><strong>{number(t.current, 1)}<small>A</small></strong><em>200 A rated maximum</em></div>
      <div><span><Gauge size={14}/>Power factor</span><strong>{number(t.powerFactor, 2)}<small>PF</small></strong><em>{t.powerFactor < 0.999 ? 'Inductive · lagging' : 'Resistive · unity'}</em></div>
      <div><span><Activity size={14}/>Frequency</span><strong>{number(t.frequency, 2)}<small>Hz</small></strong><em>60 Hz nominal</em></div>
    </div>
    <div className="energy-register"><div><span><ArrowDownLeft size={14}/>Import energy</span><strong>{number(t.importKwh, 3)} <small>kWh</small></strong></div><div><span><ArrowUpRight size={14}/>Export energy</span><strong>{number(t.exportKwh, 3)} <small>kWh</small></strong></div></div>
    <div className="pulse-row"><div><span className="pulse-indicator"/><span>Calibration pulse</span></div><span className="mono">{number(pulseHz, 2)} Hz</span></div>
    <div className="pulse-note"><span>{impPerKwh.toLocaleString()} imp/kWh · simulation constant</span><span>{t.pulseCount.toLocaleString()} impulses</span></div>
    <div className={`health-line ${t.alarms.length ? 'has-alarm' : ''}`}>{t.alarms.length ? <TriangleAlert size={15}/> : <ShieldCheck size={15}/>}<span>{t.alarms.length ? `${t.alarms.length} active ${t.alarms.length === 1 ? 'alarm' : 'alarms'}` : 'Electrical conditions normal'}</span><span className="mono">{number(t.temperature, 1)} °C</span></div>
  </aside>
}

function SimulationControls() {
  const c = useMeterStore(s => s.controls)
  const source = useMeterStore(s => s.source)
  const paused = useMeterStore(s => s.paused)
  const setLoadAmps = useMeterStore(s => s.setLoadAmps)
  const setPowerFactor = useMeterStore(s => s.setPowerFactor)
  const setSolarExport = useMeterStore(s => s.setSolarExport)
  const toggleFault = useMeterStore(s => s.toggleFault)
  const clearFaults = useMeterStore(s => s.clearFaults)
  const disabled = source !== 'simulation'
  return <section className="surface simulation-panel" aria-labelledby="simulation-title"><div className="section-heading"><h2 id="simulation-title"><SlidersHorizontal size={17}/>Simulation lab</h2><span className="tag">{disabled ? 'READ ONLY' : paused ? 'PAUSED' : 'SANDBOX'}</span></div>
    <fieldset disabled={disabled}><legend className="sr-only">Virtual load and fault controls</legend><div className="range-heading"><label htmlFor="load">Virtual load</label><output htmlFor="load">{number(c.loadAmps, 0)} <small>A</small></output></div><input id="load" type="range" min="0" max="200" step="1" value={c.loadAmps} onChange={event => setLoadAmps(Number(event.target.value))}/><div className="range-scale"><span>0 A</span><span>100 A</span><span>200 A</span></div>
    <div className="range-heading pf-heading"><label htmlFor="pf">Power factor</label><output htmlFor="pf">{number(c.powerFactor, 2)}</output></div><input id="pf" type="range" min="0.85" max="1" step="0.01" value={c.powerFactor} onChange={event => setPowerFactor(Number(event.target.value))}/><div className="range-scale"><span>0.85 · inductive</span><span>1.00 · resistive</span></div>
    <label className="solar-control"><Sun size={19}/><span><strong>Solar backfeed</strong><small>Reverse the net energy flow</small></span><input className="switch" type="checkbox" checked={c.solarExport} onChange={event => setSolarExport(event.target.checked)}/></label>
    <div className="fault-heading"><h3>Fault injection</h3><button className="text-button" disabled={disabled || c.faults.length === 0} onClick={clearFaults}>Clear all</button></div><div className="fault-buttons">{(Object.keys(faultNames) as MeterFault[]).map(fault => <button key={fault} aria-pressed={c.faults.includes(fault)} onClick={() => toggleFault(fault)}>{c.faults.includes(fault) ? <Check size={13}/> : <Zap size={13}/>} {faultNames[fault]}{fault === 'overcurrent' && <span>225 A</span>}</button>)}</div></fieldset>
    <p className="lab-note">{disabled ? 'Simulation controls are unavailable while a remote source is selected.' : 'Virtual inputs affect this twin only. No commands are sent to a physical meter.'}</p>
  </section>
}

function DeviceProfile() {
  return <section className="surface profile-panel"><div className="section-heading"><h2><CircuitBoard size={18}/>Meter profile</h2><span className="tag">REFERENCE MODEL</span></div><div className="profile-content"><div><h3>Aituzero solid-state<br/>watt-hour smart meter</h3><p>A procedural engineering twin based on the supplied Form 2S device profile and photograph. Geometry represents the enclosure and assembly; dimensions are illustrative.</p><div className="profile-flow"><span>Meter</span><ArrowRight size={17}/><span>Edge gateway</span><ArrowRight size={17}/><span>Digital twin</span></div></div><dl>{[['Service form', 'ANSI Form 2S'], ['Service voltage', '120/240 V AC'], ['Current class', 'CL200 · 200 A'], ['Connection', 'Single phase · 3 wire'], ['Nominal frequency', '60 Hz'], ['Measurement model', 'Balanced split-phase load'], ['Pulse constant', '1,000 imp/kWh · simulated'], ['Optical interface', 'Infrared port · visual model'], ['Enclosure', 'Clear polycarbonate / black socket'], ['Thermal model', 'Estimated I² heating · not a sensor']].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div></section>
}

export default function Dashboard() {
  const [tab, setTab] = useState<'overview' | 'events' | 'profile'>('overview')
  const [connectionOpen, setConnectionOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [fullViewport, setFullViewport] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [events, setEvents] = useState<EventEntry[]>([])
  const source = useMeterStore(s => s.source)
  const connection = useMeterStore(s => s.connection)
  const error = useMeterStore(s => s.error)
  const lastPacketAt = useMeterStore(s => s.lastPacketAt)
  const awaitingRemote = source !== 'simulation' && lastPacketAt === null
  const paused = useMeterStore(s => s.paused)
  const exploded = useMeterStore(s => s.exploded)
  const thermal = useMeterStore(s => s.thermal)
  const cameraPreset = useMeterStore(s => s.cameraPreset)
  const annotations = useMeterStore(s => s.annotations)
  const alarms = useMeterStore(s => s.telemetry.alarms)
  const setPaused = useMeterStore(s => s.setPaused)
  const setExploded = useMeterStore(s => s.setExploded)
  const setThermal = useMeterStore(s => s.setThermal)
  const setCameraPreset = useMeterStore(s => s.setCameraPreset)
  const setAnnotations = useMeterStore(s => s.setAnnotations)
  const resetSimulation = useMeterStore(s => s.resetSimulation)
  const previousState = useRef('')
  const alarmKey = alarms.join(',')
  const downloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => startMeterStream(), [])
  useEffect(() => () => { if (downloadTimer.current) clearTimeout(downloadTimer.current) }, [])
  useEffect(() => {
    const state = `${source}:${connection}:${paused}:${alarmKey}`
    if (state === previousState.current) return
    previousState.current = state
    const timer = window.setTimeout(() => setEvents(entries => [{ time: Date.now(), text: alarms.length ? `Active: ${alarms.map(alarm => faultNames[alarm]).join(', ')}` : `${source === 'simulation' ? 'Simulation' : source === 'mqtt' ? 'MQTT' : 'WebSocket'} ${paused ? 'paused' : connection}. No active alarms.`, severity: alarms.length ? 'warning' as const : 'info' as const }, ...entries].slice(0, 100)), 0)
    return () => window.clearTimeout(timer)
  }, [source, connection, paused, alarmKey])
  useEffect(() => { if (!fullViewport) return; const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullViewport(false) }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey) }, [fullViewport])
  const download = () => {
    if (awaitingRemote) return
    const { telemetry, controls, history, impPerKwh } = useMeterStore.getState()
    const blob = new Blob([JSON.stringify({ device: 'Aituzero ANSI Form 2S', source, exportedAt: new Date().toISOString(), units: { activePower: 'W', voltage: 'V L-L', current: 'A', temperature: 'degC estimated', timestamp: 'epoch ms' }, impPerKwh, telemetry, controls, history }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `aituzero-meter-${Date.now()}.json`; link.click(); URL.revokeObjectURL(url)
    setDownloaded(true); if (downloadTimer.current) clearTimeout(downloadTimer.current); downloadTimer.current = setTimeout(() => setDownloaded(false), 2200)
  }
  const stateLabel = source === 'simulation' ? connection === 'error' ? 'Configuration error' : paused ? 'Simulation paused' : 'Simulation running' : connection === 'connected' ? 'Broker connected' : `Broker ${connection}`
  return <div className="meter-app">
    <a className="skip-link" href="#main-content">Skip to meter workspace</a>
    <aside className="navigation-rail" aria-label="Workspace navigation"><a className="brand-symbol" href="#main-content" aria-label="Aituzero Meter Studio"><Zap size={25}/></a><div className="rail-group"><button title="Meter overview" aria-label="Meter overview" aria-pressed={tab === 'overview'} onClick={() => setTab('overview')}><Box size={21}/></button><button title="Event log" aria-label="Event log" aria-pressed={tab === 'events'} onClick={() => setTab('events')}><Activity size={21}/></button><button title="Device profile" aria-label="Device profile" aria-pressed={tab === 'profile'} onClick={() => setTab('profile')}><CircuitBoard size={21}/></button></div><div className="rail-bottom"><button title="Connection details" aria-label="Connection details" aria-pressed={connectionOpen} onClick={() => setConnectionOpen(!connectionOpen)}><Cable size={20}/></button><button title="Inspection help" aria-label="Inspection help" aria-pressed={helpOpen} onClick={() => setHelpOpen(!helpOpen)}><CircleHelp size={20}/></button><span className="rail-avatar">AZ</span></div></aside>
    <div className="app-body"><header className="topbar"><div className="wordmark">AITUZERO<span>METER STUDIO</span></div><div className="breadcrumb"><span>Digital twins</span><ChevronRight size={14}/><strong>Smart meter</strong></div><button className="connection-pill" onClick={() => setConnectionOpen(!connectionOpen)} aria-expanded={connectionOpen}><i className={`status-dot ${paused || connection === 'error' || connection === 'disconnected' ? 'status-amber' : ''}`}/>{stateLabel}<ChevronRight size={13}/></button></header>
    <main id="main-content"><div className="page-heading"><div><h1>Smart meter <span>digital twin</span></h1><p><span className="device-code">AZ–2S–001</span><span className="separator">/</span>120/240 V<span className="separator">/</span>CL200<span className="separator">/</span>Single phase · 3 wire</p></div><button className="button secondary export-button" disabled={awaitingRemote} onClick={download}>{downloaded ? <Check size={15}/> : <Download size={15}/>} {downloaded ? 'Snapshot saved' : 'Export snapshot'}</button></div>
    {connectionOpen && <section className="info-banner"><Wifi size={18}/><div><strong>{source === 'simulation' ? 'Local simulation stream' : `${source.toUpperCase()} telemetry`}</strong><p>{source === 'simulation' ? 'A local 10 Hz stream feeds the meter. To connect hardware, configure VITE_METER_TRANSPORT, VITE_METER_URL and VITE_METER_TOPIC, then restart. See docs/SMART-METER-TELEMETRY.md.' : 'Read-only broker telemetry. Load and fault controls are disabled. Reconnection is automatic; the last known readings remain visible during interruptions.'}</p></div><button className="icon-button" aria-label="Close connection details" onClick={() => setConnectionOpen(false)}><X size={16}/></button></section>}
    {error && <div className="error-banner" role="alert"><TriangleAlert size={18}/><span>{error}</span></div>}
    {helpOpen && <section className="info-banner"><Orbit size={20}/><div><strong>Inspect the meter</strong><p>Drag to orbit. Scroll or pinch to zoom. Use the camera presets to inspect the register or four terminal blades. Exploded view separates the assembly. Thermal view shows estimated heating. Escape exits the expanded viewport.</p></div><button className="icon-button" aria-label="Close inspection help" onClick={() => setHelpOpen(false)}><X size={16}/></button></section>}
    <nav className="workspace-tabs" aria-label="Meter sections"><div>{([{ id: 'overview', label: 'Overview', icon: Box }, { id: 'events', label: 'Event log', icon: Activity }, { id: 'profile', label: 'Device profile', icon: FileText }] as const).map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}><item.icon size={16}/>{item.label}{item.id === 'events' && alarms.length > 0 && <span>{alarms.length}</span>}</button>)}</div><span className="workspace-note"><i className="status-dot"/> {source === 'simulation' ? 'SIMULATED DATA' : 'REMOTE DATA'}<span>·</span>ANSI FORM 2S</span></nav>
    {tab === 'overview' ? <div className="dashboard-grid"><section className={`surface viewport-panel ${fullViewport ? 'viewport-expanded' : ''}`} aria-label="Interactive 3D meter"><div className="section-heading viewport-heading"><h2><Box size={17}/>Meter inspection</h2><div className="viewport-actions"><button title="Toggle annotations" className="icon-button" aria-label="Toggle annotations" aria-pressed={annotations} onClick={() => setAnnotations(!annotations)}><Radio size={16}/></button><button className="icon-button" title={fullViewport ? 'Exit expanded view' : 'Expand viewport'} aria-label={fullViewport ? 'Exit expanded view' : 'Expand viewport'} onClick={() => setFullViewport(!fullViewport)}>{fullViewport ? <X size={17}/> : <Maximize2 size={17}/>}</button></div></div><div className="scene-container"><Suspense fallback={<div className="scene-loading"><Box size={28}/><span>Preparing meter geometry…</span></div>}><MeterScene/></Suspense><div className="scene-top-left"><span className="scene-chip"><i className="status-dot"/>{thermal ? 'THERMAL INSPECTION' : exploded ? 'ASSEMBLY INSPECTION' : 'LIVE DIGITAL TWIN'}</span><span className="scene-caption">Aituzero · Solid-state watt-hour meter</span></div><div className="scene-toggles"><button aria-label="Exploded view" title="Exploded view" aria-pressed={exploded} onClick={() => setExploded(!exploded)}><Layers3 size={16}/><span>Exploded view</span></button><button aria-label="Thermal view" title="Thermal view" aria-pressed={thermal} onClick={() => setThermal(!thermal)}><Thermometer size={16}/><span>Thermal view</span></button></div>{thermal && <div className="thermal-legend"><strong>Estimated temperature</strong><i/><span><b>24 °C</b><b>90 °C</b></span></div>}<div className="scene-bottom"><span><Orbit size={15}/>Drag to orbit · Scroll to zoom</span><span className="axis-mark"><b>Y</b><i/>Z <em>X</em></span></div></div><div className="camera-toolbar"><span><Expand size={14}/>Camera</span><div className="camera-presets">{cameras.map(camera => <button key={camera.id} aria-pressed={cameraPreset === camera.id} onClick={() => setCameraPreset(camera.id)}>{camera.label}</button>)}</div></div><div className="viewport-footer"><span><ShieldCheck size={13}/>Procedural Form 2S assembly</span><span>4 terminal blades · Optical IR port</span></div></section><TelemetryPanel/><TrendChart/><SimulationControls/></div> : tab === 'profile' ? <DeviceProfile/> : <section className="surface events-panel"><div className="section-heading"><h2><Activity size={17}/>Session event log</h2><span className="tag">{events.length} EVENTS</span></div><p>Connection changes, simulation state and fault transitions in this browser session. Most recent first.</p><div className="event-table" role="table" aria-label="Session events"><div className="event-table-heading" role="row"><span role="columnheader">Time</span><span role="columnheader">Status</span><span role="columnheader">Event</span></div>{events.map((event, i) => <div role="row" key={`${event.time}-${i}`}><time role="cell" dateTime={new Date(event.time).toISOString()}>{new Date(event.time).toLocaleTimeString()}</time><span role="cell" className={event.severity === 'warning' ? 'event-warning' : 'event-info'}>{event.severity === 'warning' ? <TriangleAlert size={14}/> : <Check size={14}/>} {event.severity}</span><span role="cell">{event.text}</span></div>)}</div></section>}
    <footer className="workspace-footer"><span><span className="footer-mark">AITUZERO</span>Connected energy. In view.</span><div>{source === 'simulation' && <><button className="text-button" onClick={() => setPaused(!paused)}>{paused ? <Play size={13}/> : <Pause size={13}/>} {paused ? 'Resume simulation' : 'Pause simulation'}</button><button className="text-button" onClick={resetSimulation}><RotateCcw size={13}/>Reset simulation</button></>}<span className="version-label">METER STUDIO / 1.0</span></div></footer>
    </main></div>
  </div>
}
