import type { PLCParameter } from "../types";

type InstrumentKind = "voltage" | "current" | "ph" | "pressure" | "gas" | "turbidity" | "light" | "orp" | "level";

const INSTRUMENTS: Record<string, InstrumentKind> = {
  voltage: "voltage",
  current: "current",
  ph: "ph",
  forming_pressure: "pressure",
  curing_mq: "gas",
  mixing_turbidity: "turbidity",
  forming_light: "light",
  mixing_orp: "orp",
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const rounded = (value: number) => Math.round(value * 1000) / 1000;
const positionX = (position: number) => rounded(8 + position * 48);
const dialPoint = (position: number, radius: number) => {
  const angle = Math.PI * (1 - position);
  return { x: rounded(32 + Math.cos(angle) * radius), y: rounded(31 - Math.sin(angle) * radius) };
};

/** A configured-range instrument: geometry comes only from the latest received sample. */
export default function ParameterMicroviz({ param }: { param: PLCParameter }) {
  const kind = INSTRUMENTS[param.id] ?? "level";
  const min = param.min ?? Number.NaN;
  const max = param.max ?? Number.NaN;
  const range = max - min;
  const calibrated = Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(range) && range > 0;
  const available = calibrated && !param.placeholder && typeof param.value === "number" && Number.isFinite(param.value);
  const position = available ? clamp((param.value! - min) / range) : 0;
  const nominal = calibrated && typeof param.nominal === "number" && Number.isFinite(param.nominal)
    ? clamp((param.nominal - min) / range) : null;
  const zero = calibrated && min <= 0 && max >= 0 ? clamp(-min / range) : null;
  const label = available
    ? `${param.label} range position: ${Math.round(position * 100)}% of ${min}–${max}${param.unit ? ` ${param.unit}` : ""}`
    : `${param.label}: awaiting PLC reading`;

  return <svg className={`pmv pmv--${kind}`} viewBox="0 0 64 40" role="img" aria-label={label} data-available={available} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <title>{label}</title>
    {kind === "voltage" && <>
      {[10, 14, 18, 22, 26].map((height, index) => {
        const x = 8 + index * 10, y = 33 - height;
        return <g key={height}>
          <path className="pmv-side" d={`M${x + 6} ${y}l3-2v${height}l-3 2z`} />
          <path className="pmv-face" d={`M${x} ${y}l3-2h6l-3 2z`} />
          <rect className="pmv-face" x={x} y={y} width="6" height={height} rx=".5" />
          <path className="pmv-track" d={`M${x} 33V${y}h6v${height}`} />
          <path className="pmv-highlight" d={`M${x} 33V${y}l3-2`} />
        </g>;
      })}
      {available && [10, 14, 18, 22, 26].map((height, index) => {
        const amount = clamp(position * 5 - index);
        return amount > 0 && <rect key={height} className="pmv-fill" data-sample="level" x={8 + index * 10} y={rounded(33 - height * amount)} width="6" height={rounded(height * amount)} rx="1" fill="currentColor" stroke="none" />;
      })}
      <path className="pmv-side" d="M6 35h51l3-2v3l-3 2H6z" />
      <path className="pmv-highlight" d="M6 35h51l3-2" />
    </>}
    {kind === "current" && <>
      {[9, 19, 29].map((y) => <g key={y}>
        <path className="pmv-side" d={`M56 ${y}l3-2v5l-3 2z`} />
        <path className="pmv-face" d={`M8 ${y}l3-2h48l-3 2z`} />
        <rect className="pmv-face" x="8" y={y} width="48" height="5" rx="1" />
        <rect className="pmv-track" x="8" y={y} width="48" height="5" rx="1" />
        <path className="pmv-highlight" d={`M8 ${y + 4}v-4h48l3-2`} />
      </g>)}
      {available && position > 0 && [9, 19, 29].map((y) => <rect key={y} className="pmv-fill" data-sample="level" x="8" y={y} width={rounded(position * 48)} height="5" rx="2.5" fill="currentColor" stroke="none" />)}
      {nominal !== null && <path className="pmv-nominal" d={`M${positionX(nominal)} 6v3m0 25v3`} />}
    </>}
    {kind === "ph" && <>
      {Array.from({ length: 7 }, (_, index) => {
        const x = 8 + index * 7;
        return <g key={index}>
          <path className="pmv-side" d={`M${x + 5.5} 17l2-3v11l-2 3z`} />
          <path className="pmv-face" d={`M${x} 17l2-3h5.5l-2 3z`} />
          <rect className="pmv-face" x={x} y="17" width="5.5" height="11" rx=".5" />
          <rect className="pmv-track" x={x} y="17" width="5.5" height="11" rx=".5" />
          <path className="pmv-highlight" d={`M${x} 27V17l2-3`} />
        </g>;
      })}
      <path className="pmv-side" d="M7 31h49l2-2v4l-2 2H7z" />
      <path className="pmv-highlight" d="M7 31h49l2-2" />
      {nominal !== null && <path className="pmv-nominal" d={`M${positionX(nominal)} 30v6`} />}
      {available && <path className="pmv-mark" data-sample="position" d={`M${positionX(position) - 3} 9l3 4 3-4z`} fill="currentColor" stroke="none" />}
    </>}
    {kind === "pressure" && <>
      <path className="pmv-side" d="M8 31v3h48v-3zM8 33a24 24 0 0 1 48 0h-2a22 22 0 0 0-44 0z" />
      <path className="pmv-face" d="M8 31a24 24 0 0 1 48 0h-2a22 22 0 0 0-44 0z" />
      <path className="pmv-face" d="M10 31a22 22 0 0 1 44 0z" />
      <path className="pmv-highlight" d="M8 31a24 24 0 0 1 38-19" />
      <path className="pmv-track" d="M10 31a22 22 0 0 1 44 0" />
      {[0, .25, .5, .75, 1].map((tick) => {
        const outer = dialPoint(tick, 22), inner = dialPoint(tick, 18);
        return <line key={tick} className="pmv-track" x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} />;
      })}
      {nominal !== null && (() => {
        const point = dialPoint(nominal, 25);
        return <circle className="pmv-nominal" cx={point.x} cy={point.y} r="1" />;
      })()}
      <circle className="pmv-side" cx="33" cy="32" r="3" />
      <circle className="pmv-face" cx="32" cy="31" r="3" />
      <circle className="pmv-track" cx="32" cy="31" r="3" />
      {available && <line className="pmv-mark" data-sample="position" x1="32" y1="31" x2={dialPoint(position, 16).x} y2={dialPoint(position, 16).y} />}
    </>}
    {kind === "gas" && <>
      {Array.from({ length: 15 }, (_, index) => {
        const x = 12 + index % 5 * 10, y = 10 + Math.floor(index / 5) * 10;
        return <g key={index}>
          <circle className="pmv-side" cx={x + 1} cy={y + 1} r="2.8" />
          <circle className="pmv-face" cx={x} cy={y} r="2.8" />
          <circle className="pmv-track" cx={x} cy={y} r="2.5" />
          <path className="pmv-highlight" d={`M${x - 1.8} ${y}a1.8 1.8 0 0 1 1.8-1.8`} />
        </g>;
      })}
      {available && Array.from({ length: 15 }, (_, index) => {
        const amount = clamp(position * 15 - index);
        return amount > 0 && <circle key={index} className="pmv-fill" data-sample="level" cx={12 + index % 5 * 10} cy={10 + Math.floor(index / 5) * 10} r={rounded(2.5 * Math.sqrt(amount))} fill="currentColor" stroke="none" />;
      })}
    </>}
    {kind === "turbidity" && <>
      <path className="pmv-side" d="M44 6l4-3v26q0 4-4 6z" />
      <path className="pmv-face" d="M17 6v25a4 4 0 0 0 4 4h19a4 4 0 0 0 4-4V6z" />
      <ellipse className="pmv-face" cx="30.5" cy="6" rx="13.5" ry="3" />
      <path className="pmv-track" d="M17 6v25a4 4 0 0 0 4 4h19a4 4 0 0 0 4-4V6M14 6h33" />
      <path className="pmv-track" d="M48 10h4m-4 8h4m-4 8h4m-4 8h4" />
      {available && position > 0 && <rect className="pmv-fill" data-sample="level" x="20" y={rounded(32 - position * 23)} width="21" height={rounded(position * 23)} rx="1" fill="currentColor" stroke="none" />}
      <path className="pmv-highlight" d="M19 12v17m-2-23a13.5 3 0 0 1 27 0" />
      {nominal !== null && <path className="pmv-nominal" d={`M44 ${rounded(32 - nominal * 23)}h4`} />}
    </>}
    {kind === "light" && <>
      <circle className="pmv-side" cx="33" cy="22" r="9" />
      <circle className="pmv-face" cx="32" cy="20" r="9" />
      <circle className="pmv-face" cx="32" cy="20" r="7" />
      <path className="pmv-highlight" d="M23 20a9 9 0 0 1 15-6.7" />
      <circle className="pmv-track" cx="32" cy="20" r="7" />
      {Array.from({ length: 8 }, (_, index) => {
        const angle = index * Math.PI / 4;
        return <line key={index} className="pmv-track" x1={rounded(32 + Math.cos(angle) * 11)} y1={rounded(20 + Math.sin(angle) * 11)} x2={rounded(32 + Math.cos(angle) * 16)} y2={rounded(20 + Math.sin(angle) * 16)} />;
      })}
      {available && position > 0 && <circle className="pmv-fill" data-sample="level" cx="32" cy="20" r={rounded(6 * Math.sqrt(position))} fill="currentColor" stroke="none" />}
      {available && Array.from({ length: 8 }, (_, index) => {
        const amount = clamp(position * 8 - index);
        const angle = index * Math.PI / 4;
        return amount > 0 && <line key={index} className="pmv-mark" data-sample="level" x1={rounded(32 + Math.cos(angle) * 11)} y1={rounded(20 + Math.sin(angle) * 11)} x2={rounded(32 + Math.cos(angle) * (11 + amount * 5))} y2={rounded(20 + Math.sin(angle) * (11 + amount * 5))} />;
      })}
      <path className="pmv-highlight" d="M27 19a5 5 0 0 1 5-4" />
    </>}
    {(kind === "orp" || kind === "level") && <>
      <path className="pmv-side" d="M8 24h48l2-2v4l-2 2H8zM56 18l2-2v6l-2 2z" />
      <path className="pmv-face" d="M8 18l2-2h48l-2 2z" />
      <rect className="pmv-face" x="8" y="18" width="48" height="6" rx="1" />
      <path className="pmv-highlight" d="M8 18h48l2-2" />
      <path className="pmv-track" d="M8 21h48M8 18v6m48-6v6" />
      {zero !== null && <line className="pmv-zero" data-reference="zero" x1={positionX(zero)} y1="12" x2={positionX(zero)} y2="30" />}
      {nominal !== null && <path className="pmv-nominal" d={`M${positionX(nominal)} 29v5`} />}
      {available && <>
        <line className="pmv-mark" data-sample="level" x1={positionX(kind === "orp" ? zero ?? 0 : 0)} y1="21" x2={positionX(position)} y2="21" strokeWidth="3" />
        <circle className="pmv-side" cx={positionX(position) + 1} cy="22" r="3" />
        <circle className="pmv-mark" data-sample="position" cx={positionX(position)} cy="21" r="3" fill="currentColor" stroke="none" />
        <path className="pmv-highlight" d={`M${positionX(position) - 1.8} 21a1.8 1.8 0 0 1 1.8-1.8`} />
      </>}
    </>}
  </svg>;
}
