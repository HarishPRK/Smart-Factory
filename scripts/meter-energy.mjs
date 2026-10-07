import fs from 'node:fs';
import path from 'node:path';
import { decodeMeterData } from './meter-protobuf.mjs';

const MAX_GAP_MS = 15_000;
const numeric = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const empty = topic => ({ version: 1, topic, since: null, lastTimestamp: null, importWh: 0, exportWh: 0, apparentVAh: 0, observedMs: 0, peakW: 0, samples: 0, gaps: 0 });

function measurement(frame, now) {
  if (frame.retained) return null;
  let p = frame.encoding === 'protobuf' ? decodeMeterData(Buffer.from(frame.payload, 'base64')) : frame.payload;
  if (typeof p === 'string') p = JSON.parse(p);
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  for (const [a, b] of [['powerFactor', 'power_factor'], ['activePower', 'active_power'], ['reverseEnergy', 'reverse_energy']]) {
    if (p[a] !== undefined && p[b] !== undefined && p[a] !== p[b]) return null;
  }
  const voltage = p.voltage, current = p.current, pf = p.powerFactor ?? p.power_factor;
  for (const [value, max] of [[voltage, 400], [current, 1000], [pf, 1], [p.frequency, 100]]) {
    if (value != null && !numeric(value, 0, max)) return null;
  }
  const reverse = p.reverseEnergy ?? p.reverse_energy;
  if (reverse != null && typeof reverse !== 'boolean') return null;
  let watts = p.activePower ?? p.active_power;
  if (watts == null && numeric(voltage, 0, 400) && numeric(current, 0, 1000) && numeric(pf, 0, 1) && (p.power_model === undefined || p.power_model === 'single_phase')) {
    watts = voltage * current * pf * (reverse ? -1 : 1);
  }
  if (!numeric(watts, -400_000, 400_000) || (reverse != null && reverse !== (watts < 0))) return null;
  const timestamp = p.timestamp ?? frame.publishedAt;
  if (!Number.isSafeInteger(timestamp) || timestamp < now - MAX_GAP_MS || timestamp > now + 5000) return null;
  const va = numeric(voltage, 0, 400) && numeric(current, 0, 1000) ? voltage * current : null;
  return { timestamp, watts, va };
}

/** Trapezoidal integration, splitting a sign crossing into import/export triangles. */
export function integratePower(a, b, hours) {
  if (a >= 0 && b >= 0) return { importWh: (a + b) * hours / 2, exportWh: 0 };
  if (a <= 0 && b <= 0) return { importWh: 0, exportWh: -(a + b) * hours / 2 };
  const firstHours = hours * Math.abs(a) / (Math.abs(a) + Math.abs(b));
  const first = Math.abs(a) * firstHours / 2;
  const second = Math.abs(b) * (hours - firstHours) / 2;
  return a > 0 ? { importWh: first, exportWh: second } : { importWh: second, exportWh: first };
}

function validState(state, topic) {
  if (!state || state.version !== 1 || state.topic !== topic) return false;
  for (const key of ['importWh', 'exportWh', 'apparentVAh', 'observedMs', 'peakW', 'samples', 'gaps']) {
    if (!numeric(state[key], 0, Number.MAX_SAFE_INTEGER)) return false;
  }
  if (!['observedMs', 'samples', 'gaps'].every(key => Number.isSafeInteger(state[key]))) return false;
  return Number.isSafeInteger(state.since) && state.since >= 0 && Number.isSafeInteger(state.lastTimestamp) && state.lastTimestamp >= state.since && state.observedMs <= state.lastTimestamp - state.since;
}

export class MeterEnergyCounter {
  constructor({ file, topic = 'meter/data' }) {
    this.file = file;
    this.topic = topic;
    this.state = empty(topic);
    this.anchor = null;
    this.error = null;
    this.blocked = false;
    try {
      const restored = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!validState(restored, topic)) throw new Error('Invalid or mismatched saved counter');
      this.state = restored;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.blocked = true;
        this.error = 'Saved energy totals could not be loaded. Existing state was preserved.';
      }
    }
  }

  disconnect() { this.anchor = null; }

  summary() {
    if (this.state.since === null) return null;
    const { version: _version, topic: _topic, ...totals } = this.state;
    return { ...totals, persisted: !this.error };
  }

  accept(frame, now = Date.now()) {
    if (frame.topic !== this.topic) return null;
    if (this.blocked) return this.summary();
    let reading;
    try { reading = measurement(frame, now); } catch { reading = null; }
    if (!reading) { this.anchor = null; return null; }
    // Replayed/duplicate timestamps never contribute or invalidate a valid anchor.
    if (this.state.lastTimestamp !== null && reading.timestamp <= this.state.lastTimestamp) return null;
    const next = { ...this.state, since: this.state.since ?? reading.timestamp, lastTimestamp: reading.timestamp, samples: this.state.samples + 1, peakW: Math.max(this.state.peakW, reading.watts) };
    const elapsed = this.anchor ? reading.timestamp - this.anchor.timestamp : null;
    if (elapsed !== null && elapsed > 0 && elapsed <= MAX_GAP_MS) {
      const added = integratePower(this.anchor.watts, reading.watts, elapsed / 3_600_000);
      next.importWh += added.importWh;
      next.exportWh += added.exportWh;
      next.observedMs += elapsed;
      if (this.anchor.va !== null && reading.va !== null) next.apparentVAh += (this.anchor.va + reading.va) / 2 * elapsed / 3_600_000;
    } else if (this.state.lastTimestamp !== null) {
      next.gaps++;
    }
    const temporary = `${this.file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
      const fd = fs.openSync(temporary, 'w', 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(next) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(temporary, this.file);
      this.state = next;
      this.anchor = reading;
      this.error = null;
    } catch {
      this.anchor = null;
      this.error = 'Energy totals could not be saved. Showing the last saved total.';
    }
    return this.summary();
  }
}
