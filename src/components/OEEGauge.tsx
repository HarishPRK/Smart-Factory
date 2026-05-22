import React from "react";
import { useTweenedNumber } from "../hooks/useTweenedNumber";

interface OEEGaugeProps {
  value: number; // 0–1
  size?: number;
  label?: string;
  showPercentage?: boolean;
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

  // Colour bands matching the rest of the dashboard
  let color = "#ef4444";
  let glow = "rgba(239,68,68,0.35)";
  if (pct >= 85) {
    color = "#10b981";
    glow = "rgba(16,185,129,0.35)";
  } else if (pct >= 65) {
    color = "#f59e0b";
    glow = "rgba(245,158,11,0.35)";
  }

  const fontSize = size >= 100 ? Math.round(size * 0.2) : size >= 60 ? 16 : 12;
  const labelSize = size >= 100 ? 10 : 8;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={viewH} viewBox={`0 0 ${viewW} ${viewH}`}>
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
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${arcLength}`}
            strokeDashoffset={arcLength - filledLength}
            style={{
              filter: `drop-shadow(0 0 5px ${glow})`,
              // dashoffset is now driven by the tweened value, so no CSS
              // transition is needed (or wanted — would compound the easing).
              transition: "stroke 0.4s ease-out",
            }}
          />
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
