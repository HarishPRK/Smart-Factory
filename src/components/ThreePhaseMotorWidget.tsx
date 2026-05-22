import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { subscribeRawPLCPayload, type RawPLCPayload } from "../services/plcService";
import { useTweenedNumber } from "../hooks/useTweenedNumber";

/* ── Live snapshot of the Shelly proEM 3-phase meter ──────
 * The proEM publishes per-phase (a/b/c) voltage / current / active power /
 * apparent power / power factor on plc/data, plus neutral current and
 * pre-summed totals. Widget mirrors that shape and shows "—" for any
 * channel publishing the firmware sentinel (-1) or no data yet.
 */
interface PhaseReading {
  voltage: number | null;
  current: number | null;
  actPower: number | null;
  aprtPower: number | null;
  pf: number | null;
}

interface MeterReading {
  a: PhaseReading;
  b: PhaseReading;
  c: PhaseReading;
  neutralCurrent: number | null;
  totalActPower: number | null;
  totalAprtPower: number | null;
  totalCurrent: number | null;
  hasAny: boolean;
}

const EMPTY_PHASE: PhaseReading = {
  voltage: null,
  current: null,
  actPower: null,
  aprtPower: null,
  pf: null,
};

const EMPTY_READING: MeterReading = {
  a: EMPTY_PHASE,
  b: EMPTY_PHASE,
  c: EMPTY_PHASE,
  neutralCurrent: null,
  totalActPower: null,
  totalAprtPower: null,
  totalCurrent: null,
  hasAny: false,
};

/** -1 is the firmware "no data" sentinel — fold it to null so the UI shows
 *  a dash instead of a misleading -1.0. */
function pickReal(raw: RawPLCPayload, key: string): number | null {
  const v = raw[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v === -1) return null;
  return v;
}

function readPhase(raw: RawPLCPayload, leg: "a" | "b" | "c"): PhaseReading {
  return {
    voltage:   pickReal(raw, `boardB_shelly_proEM_data_${leg}_voltage`),
    current:   pickReal(raw, `boardB_shelly_proEM_data_${leg}_current`),
    actPower:  pickReal(raw, `boardB_shelly_proEM_data_${leg}_act_power`),
    aprtPower: pickReal(raw, `boardB_shelly_proEM_data_${leg}_aprt_power`),
    pf:        pickReal(raw, `boardB_shelly_proEM_data_${leg}_pf`),
  };
}

function readMeter(raw: RawPLCPayload): MeterReading {
  const a = readPhase(raw, "a");
  const b = readPhase(raw, "b");
  const c = readPhase(raw, "c");
  const reading: MeterReading = {
    a,
    b,
    c,
    neutralCurrent:  pickReal(raw, "boardB_shelly_proEM_data_n_current"),
    totalActPower:   pickReal(raw, "boardB_shelly_proEM_data_total_act_power"),
    totalAprtPower:  pickReal(raw, "boardB_shelly_proEM_data_total_aprt_power"),
    totalCurrent:    pickReal(raw, "boardB_shelly_proEM_data_total_current"),
    hasAny: false,
  };
  reading.hasAny =
    [a, b, c].some((p) => Object.values(p).some((v) => v !== null)) ||
    reading.neutralCurrent !== null ||
    reading.totalActPower !== null ||
    reading.totalAprtPower !== null ||
    reading.totalCurrent !== null;
  return reading;
}

function fmt(value: number | null, decimals: number, dash = "—"): string {
  if (value === null) return dash;
  return value.toFixed(decimals);
}

// Tweens a nullable number — renders the dash until a real value arrives,
// then animates between successive samples. Used for the proEM totals on
// the always-visible compact strip and the per-tile readouts in the drawer.
const TweenedAmount: React.FC<{
  value: number | null;
  decimals: number;
  dash?: string;
}> = ({ value, decimals, dash = "—" }) => {
  const tweened = useTweenedNumber(value ?? 0, 280);
  if (value === null) return <>{dash}</>;
  return <>{tweened.toFixed(decimals)}</>;
};

const VOLTAGE_LIVE_THRESHOLD = 50;
const CURRENT_LIVE_THRESHOLD = 0.05;

function isRunning(meter: MeterReading): boolean {
  const phases = [meter.a, meter.b, meter.c];
  return phases.some(
    (p) =>
      (p.voltage ?? 0) > VOLTAGE_LIVE_THRESHOLD &&
      Math.abs(p.current ?? 0) > CURRENT_LIVE_THRESHOLD,
  );
}

const PHASE_COLORS: Record<"a" | "b" | "c", string> = {
  a: "#ef4444", // R
  b: "#eab308", // Y
  c: "#3b82f6", // B
};

/* ── Detail drawer (portaled) ──────────────────────────── */

const DetailDrawer: React.FC<{
  meter: MeterReading;
  running: boolean;
  onClose: () => void;
}> = ({ meter, running, onClose }) => {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card p-5 w-[440px] max-w-[90vw] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-amber-500/[0.15] to-orange-500/[0.08] rounded-lg flex items-center justify-center border border-amber-400/[0.18]">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 1 L8 4 M3.5 3.5 L5.5 5.5 M12.5 3.5 L10.5 5.5 M2 8 L4 8 M14 8 L12 8 M3.5 12.5 L5.5 10.5 M12.5 12.5 L10.5 10.5 M8 12 L8 15"
                  stroke="white"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  opacity="0.85"
                />
                <circle cx="8" cy="8" r="2.2" fill="white" opacity="0.65" />
              </svg>
            </div>
            <div>
              <div className="text-[14px] font-semibold text-amber-100/95 uppercase tracking-[0.15em]">
                3-Phase Motor
              </div>
              <div className="text-[10px] text-amber-200/55 mt-0.5 tracking-[0.1em]">
                Shelly proEM • forming stage
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-medium flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${
                running
                  ? "text-amber-300/90 bg-amber-500/[0.07] border-amber-500/[0.18]"
                  : "text-blue-200/60 bg-blue-500/[0.04] border-blue-400/[0.06]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  running ? "bg-amber-400 animate-pulse-glow" : "bg-blue-400/30"
                }`}
              />
              {running ? "Running" : "Idle"}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center hover:bg-white/[0.08] transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 2l8 8M10 2l-8 8"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Per-phase grid */}
        <div className="font-mono text-[12px] leading-[16px] mt-1">
          <div className="grid grid-cols-[28px_1fr_1fr_1fr_1fr_1fr] gap-x-2 text-[10px] uppercase tracking-[0.12em] text-blue-200/50 pb-1.5 border-b border-blue-400/10">
            <div>Ph</div>
            <div className="text-right">V</div>
            <div className="text-right">A</div>
            <div className="text-right">W</div>
            <div className="text-right">VA</div>
            <div className="text-right">PF</div>
          </div>
          {(["a", "b", "c"] as const).map((leg) => {
            const phase = meter[leg];
            const energised = (phase.voltage ?? 0) > VOLTAGE_LIVE_THRESHOLD;
            return (
              <div
                key={leg}
                className="grid grid-cols-[28px_1fr_1fr_1fr_1fr_1fr] gap-x-2 py-1.5 border-b border-blue-400/[0.05] last:border-b-0"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: PHASE_COLORS[leg],
                      boxShadow: energised
                        ? `0 0 6px ${PHASE_COLORS[leg]}`
                        : undefined,
                    }}
                  />
                  <span className="text-blue-100/80 uppercase">{leg}</span>
                </div>
                <div className="text-right text-cyan-100/90">
                  {fmt(phase.voltage, 1)}
                </div>
                <div className="text-right text-cyan-100/90">
                  {fmt(phase.current, 3)}
                </div>
                <div className="text-right text-cyan-100/90">
                  {fmt(phase.actPower, 2)}
                </div>
                <div className="text-right text-cyan-100/90">
                  {fmt(phase.aprtPower, 2)}
                </div>
                <div className="text-right text-cyan-100/90">
                  {fmt(phase.pf, 2)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Neutral current */}
        <div className="flex justify-between items-center text-[11px] font-mono pt-1.5 border-t border-blue-400/10">
          <span className="text-blue-200/60 uppercase tracking-[0.1em]">
            Neutral I
          </span>
          <span className="text-cyan-100/90">
            {fmt(meter.neutralCurrent, 3)} A
          </span>
        </div>

        {/* Totals strip */}
        <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
          <div className="rounded border border-amber-500/15 bg-amber-500/[0.04] px-2 py-1.5">
            <div className="text-[9px] text-amber-200/60 uppercase tracking-[0.1em]">
              Σ Active P
            </div>
            <div className="text-amber-100/95 mt-0.5">
              <TweenedAmount value={meter.totalActPower} decimals={2} /> W
            </div>
          </div>
          <div className="rounded border border-amber-500/15 bg-amber-500/[0.04] px-2 py-1.5">
            <div className="text-[9px] text-amber-200/60 uppercase tracking-[0.1em]">
              Σ Apparent S
            </div>
            <div className="text-amber-100/95 mt-0.5">
              <TweenedAmount value={meter.totalAprtPower} decimals={2} /> VA
            </div>
          </div>
          <div className="rounded border border-amber-500/15 bg-amber-500/[0.04] px-2 py-1.5">
            <div className="text-[9px] text-amber-200/60 uppercase tracking-[0.1em]">
              Σ Current I
            </div>
            <div className="text-amber-100/95 mt-0.5">
              <TweenedAmount value={meter.totalCurrent} decimals={3} /> A
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* ── Compact sidebar strip ─────────────────────────────── */

interface ThreePhaseMotorWidgetProps {
  className?: string;
}

const ThreePhaseMotorWidget: React.FC<ThreePhaseMotorWidgetProps> = ({
  className = "",
}) => {
  const [meter, setMeter] = useState<MeterReading>(EMPTY_READING);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeRawPLCPayload((payload) => {
      const next = readMeter(payload);
      if (next.hasAny) setMeter(next);
    });
    return unsubscribe;
  }, []);

  const running = isRunning(meter);
  const energised: Record<"a" | "b" | "c", boolean> = {
    a: (meter.a.voltage ?? 0) > VOLTAGE_LIVE_THRESHOLD,
    b: (meter.b.voltage ?? 0) > VOLTAGE_LIVE_THRESHOLD,
    c: (meter.c.voltage ?? 0) > VOLTAGE_LIVE_THRESHOLD,
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`card px-3 py-2 flex items-center gap-3 animate-fade-in delay-4 cursor-pointer hover:border-amber-400/25 active:scale-[0.98] transition-all duration-200 text-left ${className}`}
      >
        {/* Title + RYB phase dots */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[10px] font-semibold text-amber-100/85 uppercase tracking-[0.14em] whitespace-nowrap">
            3-Phase
          </div>
          <div className="flex items-center gap-1">
            {(["a", "b", "c"] as const).map((leg) => (
              <span
                key={leg}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: energised[leg]
                    ? PHASE_COLORS[leg]
                    : "rgba(75,85,99,0.5)",
                  boxShadow: energised[leg]
                    ? `0 0 5px ${PHASE_COLORS[leg]}`
                    : undefined,
                }}
              />
            ))}
          </div>
        </div>

        {/* Totals — pushed to the right (tweened so live updates feel fluid) */}
        <div className="ml-auto flex items-center gap-3 font-mono text-[10px] text-cyan-100/80">
          <span className="flex items-baseline gap-0.5">
            <span className="text-amber-200/55 text-[8px] uppercase mr-0.5">Σ</span>
            <TweenedAmount value={meter.totalActPower} decimals={2} />
            <span className="text-blue-300/45 text-[8px] ml-0.5">W</span>
          </span>
          <span className="flex items-baseline gap-0.5">
            <TweenedAmount value={meter.totalCurrent} decimals={2} />
            <span className="text-blue-300/45 text-[8px] ml-0.5">A</span>
          </span>
        </div>

        {/* Status pill */}
        <span
          className={`text-[9px] font-medium flex items-center gap-1 px-1.5 py-0.5 rounded border whitespace-nowrap ${
            running
              ? "text-amber-300/90 bg-amber-500/[0.07] border-amber-500/[0.18]"
              : "text-blue-200/55 bg-blue-500/[0.04] border-blue-400/[0.06]"
          }`}
        >
          <span
            className={`w-1 h-1 rounded-full ${
              running ? "bg-amber-400 animate-pulse-glow" : "bg-blue-400/30"
            }`}
          />
          {running ? "RUN" : "IDLE"}
        </span>

        {/* Expand chevron */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          className="text-amber-300/50"
        >
          <path
            d="M3 5l3-3 3 3M3 7l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <DetailDrawer
          meter={meter}
          running={running}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default ThreePhaseMotorWidget;
