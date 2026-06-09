import React, { useId } from "react";
import { useTweenedNumber } from "../hooks/useTweenedNumber";

interface OEEGaugeProps {
  value: number; // 0–1
  size?: number;
  label?: string;
  showPercentage?: boolean;
}

/* Band colour + a lighter companion used for the arc gradient and tip glow. */
function band(pct: number): { color: string; light: string; glow: string } {
  if (pct >= 85) return { color: "#10b981", light: "#6ee7b7", glow: "rgba(16,185,129,0.45)" };
  if (pct >= 65) return { color: "#f59e0b", light: "#fcd34d", glow: "rgba(245,158,11,0.45)" };
  return { color: "#ef4444", light: "#fca5a5", glow: "rgba(239,68,68,0.45)" };
}

/* ── Semicircle gauge ─────────────────────────────────────
 * Renders a 180° arc that fills clockwise from the left tip to the right tip.
 * The fill is a single stroked path with stroke-dasharray sized to the
 * desired fraction — this avoids re-emitting the `d` attribute on every
 * value change (which CSS can't animate) and keeps the curve mathematically
 * exact at any value, including very small ones (no chunky round-cap blob
 * for 0.4%, no half-clipped path for 95%).
 */
const OEEGauge: React.FC<OEEGaugeProps> = ({
  value,
  size = 120,
  label,
  showPercentage = true,
}) => {
  const uid = useId().replace(/:/g, "");
  // Tween the incoming 0–1 value — the percentage text, arc fill (via
  // stroke-dashoffset), and colour band threshold (red/amber/green) all
  // derive from this so they stay perfectly locked while animating.
  const tweened = useTweenedNumber(value, 450);
  const clamped = Math.min(Math.max(tweened, 0), 1);
  const pct = clamped * 100;

  const strokeWidth = Math.max(6, Math.round(size * 0.07));
  // Reserve half the stroke width on every edge so the round caps don't get
  // clipped by the viewBox. This was the source of the "badly shaped" look
  // at low values — a 4-px round cap on an 8-px stroke landed half outside
  // the original tight viewBox.
  const pad = strokeWidth / 2 + 2;
  const cx = size / 2;
  const radius = cx - pad;
  const cy = pad + radius; // baseline of the semicircle

  const viewW = size;
  const viewH = cy + pad;

  // Full semicircle path: left tip → over the top → right tip.
  // sweep=0 in SVG goes counter-clockwise visually (Y axis is flipped),
  // which routes the arc over the top.
  const arcPath =
    `M ${cx - radius} ${cy} ` +
    `A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;

  // Total length of the half-circle perimeter
  const arcLength = Math.PI * radius;
  const filledLength = arcLength * clamped;

  const { color, light, glow } = band(pct);

  // Tip of the filled arc — angle sweeps from π (left) to 0 (right).
  const tipAngle = Math.PI * (1 - clamped);
  const tipX = cx + radius * Math.cos(tipAngle);
  const tipY = cy - radius * Math.sin(tipAngle);

  const fontSize = size >= 100 ? Math.round(size * 0.2) : size >= 60 ? 16 : 12;
  const labelSize = size >= 100 ? 10 : 8;
  const showTicks = size >= 110;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={viewH} viewBox={`0 0 ${viewW} ${viewH}`}>
        <defs>
          <linearGradient id={`oee-grad-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.7" />
            <stop offset="55%" stopColor={color} />
            <stop offset="100%" stopColor={light} />
          </linearGradient>
        </defs>

        {/* Tick marks around the dial — subtle, big gauges only */}
        {showTicks &&
          Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI * (1 - i / 8);
            const rOuter = radius + strokeWidth / 2 + 3;
            const rInner = rOuter - 4;
            const frac = i / 8;
            const lit = frac <= clamped + 0.001;
            return (
              <line
                key={i}
                x1={cx + rInner * Math.cos(a)}
                y1={cy - rInner * Math.sin(a)}
                x2={cx + rOuter * Math.cos(a)}
                y2={cy - rOuter * Math.sin(a)}
                stroke={lit ? color : "rgba(120,170,220,0.18)"}
                strokeWidth="1.5"
                strokeLinecap="round"
                style={{ transition: "stroke 0.4s ease-out" }}
              />
            );
          })}

        {/* Background track */}
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(100,160,220,0.12)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Foreground fill — same path, dasharray-clipped to `filledLength`.
            transitioning stroke-dashoffset is GPU-friendly and animates
            smoothly even at small fractions. */}
        {filledLength > 0 && (
          <path
            d={arcPath}
            fill="none"
            stroke={`url(#oee-grad-${uid})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${arcLength}`}
            strokeDashoffset={arcLength - filledLength}
            style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
          />
        )}

        {/* Pulsing tip — a bright core dot with an expanding halo ring that
            rides the leading edge of the fill, so the gauge always reads as
            "live". */}
        {filledLength > 4 && (
          <g>
            <circle cx={tipX} cy={tipY} r={Math.max(2.5, strokeWidth * 0.32)} fill="#ffffff">
              <animate attributeName="opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle cx={tipX} cy={tipY} r={strokeWidth * 0.5} fill="none" stroke={light} strokeWidth="1.5">
              <animate attributeName="r" values={`${strokeWidth * 0.45};${strokeWidth * 1.1};${strokeWidth * 0.45}`} dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="1.6s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {/* Value text — sits inside the semicircle, vertically centered on
            the baseline so the number reads cleanly under the arc. */}
        {showPercentage && (
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            dominantBaseline="alphabetic"
            fill="white"
            fontSize={fontSize}
            fontWeight="600"
            fontFamily="Inter, sans-serif"
            style={{ filter: `drop-shadow(0 0 10px ${glow})` }}
          >
            {pct.toFixed(1)}%
          </text>
        )}
      </svg>
      {label && (
        <span
          className="text-blue-200/60 font-semibold uppercase tracking-[0.14em] mt-0.5"
          style={{ fontSize: labelSize }}
        >
          {label}
        </span>
      )}
    </div>
  );
};

export default OEEGauge;
