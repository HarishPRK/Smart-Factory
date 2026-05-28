import React from "react";

interface PepsiLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Classic Pepsi roundel — black outer ring, red top wave, white middle band
 * with "PEPSI" wordmark, blue bottom wave. Scales to any size via the `size`
 * prop (defaults to 56). Inline SVG so it inherits color filters cleanly.
 */
const PepsiLogo: React.FC<PepsiLogoProps> = ({ size = 56, className, style }) => {
  const clipId = React.useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={style}
      aria-label="Pepsi"
      role="img"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>
      {/* Black outer ring */}
      <circle cx="50" cy="50" r="49" fill="#000000" />
      {/* White inner background — visible as the band between the waves */}
      <circle cx="50" cy="50" r="47" fill="#ffffff" />

      <g clipPath={`url(#${clipId})`}>
        {/* Red top wave — wider/lower on the left, thinner on the right */}
        <path
          d="M 0 0 L 100 0 L 100 42 C 70 42, 55 58, 0 56 Z"
          fill="#EE1C25"
        />
        {/* Blue bottom wave — wider/higher on the right, thinner on the left */}
        <path
          d="M 0 100 L 100 100 L 100 56 C 60 56, 35 44, 0 66 Z"
          fill="#004B93"
        />
      </g>

      {/* PEPSI wordmark in the white band */}
      <text
        x="50"
        y="57"
        textAnchor="middle"
        fontFamily="'Montserrat', 'Arial Black', Impact, sans-serif"
        fontWeight={900}
        fontSize="18"
        fill="#000000"
        letterSpacing="-0.5"
      >
        PEPSI
      </text>
    </svg>
  );
};

export default PepsiLogo;
