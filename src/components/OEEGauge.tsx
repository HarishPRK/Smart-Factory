import React from "react";

interface OEEGaugeProps {
  value: number; // 0–1
  size?: number;
  label?: string;
  showPercentage?: boolean;
}

const OEEGauge: React.FC<OEEGaugeProps> = ({
  value,
  size = 120,
  label,
  showPercentage = true,
}) => {
  const pct = Math.min(Math.max(value, 0), 1) * 100;
  const radius = (size - 16) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // Semi-circle arc (180 degrees, from left to right)
  const startAngle = Math.PI;
  const endAngle = 0;
  const totalArc = Math.PI;
  const filledArc = totalArc * Math.min(value, 1);

  const arcX1 = cx + radius * Math.cos(startAngle);
  const arcY1 = cy - radius * Math.sin(startAngle);
  const arcX2 = cx + radius * Math.cos(startAngle - filledArc);
  const arcY2 = cy - radius * Math.sin(startAngle - filledArc);

  const bgArcX2 = cx + radius * Math.cos(endAngle);
  const bgArcY2 = cy - radius * Math.sin(endAngle);

  // Color based on OEE value
  let color = "#ef4444"; // Red < 65%
  let glowColor = "rgba(239,68,68,0.3)";
  if (pct >= 85) {
    color = "#10b981"; // Green >= 85%
    glowColor = "rgba(16,185,129,0.3)";
  } else if (pct >= 65) {
    color = "#f59e0b"; // Yellow 65-84%
    glowColor = "rgba(245,158,11,0.3)";
  }

  const bgPath = `M ${arcX1} ${arcY1} A ${radius} ${radius} 0 ${1} 0 ${bgArcX2} ${bgArcY2}`;
  const largeArc = filledArc > Math.PI / 2 ? 1 : 0;
  const fillPath = filledArc > 0.001
    ? `M ${arcX1} ${arcY1} A ${radius} ${radius} 0 ${largeArc} 0 ${arcX2} ${arcY2}`
    : "";

  const fontSize = size >= 100 ? 28 : size >= 60 ? 16 : 12;
  const labelSize = size >= 100 ? 10 : 8;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        <defs>
          <filter id={`oee-glow-${size}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="rgba(100,160,220,0.1)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Filled arc */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            filter={`url(#oee-glow-${size})`}
            style={{
              filter: `drop-shadow(0 0 6px ${glowColor})`,
              transition: "d 0.8s ease-out",
            }}
          />
        )}

        {/* Value text */}
        {showPercentage && (
          <text
            x={cx}
            y={cy - 2}
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
