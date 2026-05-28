import React from "react";

interface PepsiCoLogoProps {
  /** Height of the mark in px (width scales with it). Default 44. */
  size?: number;
  /** Show the "pepsico" wordmark to the right of the mark. */
  showWordmark?: boolean;
  /** Wordmark color — defaults to white for dark backgrounds. */
  wordmarkColor?: string;
  /** Optional tagline under the wordmark ("Food. Drinks. Smiles."). */
  showTagline?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Stylised recreation of the 2023 PepsiCo "Smile" corporate mark, using the
 * brand colours sampled by the user:
 *   amber  #f5a802   (sprouting petals)
 *   blue   #75b0ea   (water drop)
 *   lime   #91c904   (smile highlight)
 *   green  #5aa000   (smile base)
 *
 * Hand-authored SVG so it scales crisply and inherits the dark theme without
 * shipping a raster asset. For a pixel-perfect official mark, drop the vendor
 * PNG/SVG into src/assets and swap the <svg> for an <img>.
 */
const C = {
  amber: "#f5a802",
  blue: "#75b0ea",
  lime: "#91c904",
  green: "#5aa000",
};

const PepsiCoLogo: React.FC<PepsiCoLogoProps> = ({
  size = 44,
  showWordmark = false,
  wordmarkColor = "#ffffff",
  showTagline = false,
  className,
  style,
}) => {
  return (
    <div
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.28, ...style }}
      aria-label="PepsiCo"
      role="img"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        style={{ display: "block", flex: "0 0 auto" }}
      >
        {/* ── Green smile (base) ── */}
        <path
          d="M16 64
             C 26 96, 94 96, 104 60
             C 92 80, 30 84, 28 60 Z"
          fill={C.green}
        />
        {/* ── Lime smile highlight (right side) ── */}
        <path
          d="M58 82
             C 80 82, 96 72, 104 60
             C 94 76, 76 80, 60 79 Z"
          fill={C.lime}
        />

        {/* ── Amber sprouting petals (top-left) ── */}
        <path
          d="M54 14
             C 40 22, 36 44, 47 58
             C 53 42, 60 26, 54 14 Z"
          fill={C.amber}
        />
        <path
          d="M40 24
             C 28 34, 28 52, 41 61
             C 43 48, 42 34, 40 24 Z"
          fill={C.amber}
          opacity="0.9"
        />

        {/* ── Blue water drop (top-right) ── */}
        <path
          d="M72 20
             C 84 28, 84 46, 72 55
             C 64 44, 64 30, 72 20 Z"
          fill={C.blue}
        />

        {/* ── White lowercase "p" (stem + bowl) ── */}
        <g fill="#ffffff">
          <rect x="48" y="42" width="8" height="42" rx="4" />
          <path
            d="M56 50
               C 56 45, 78 45, 78 60
               C 78 75, 56 75, 56 70
               L 56 62
               C 60 66, 70 66, 70 60
               C 70 54, 60 54, 56 58 Z"
          />
        </g>
        {/* ── Amber seed dot in the bowl ── */}
        <circle cx="63.5" cy="60" r="4.6" fill={C.amber} />
      </svg>

      {showWordmark && (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <span
            style={{
              fontFamily: "'Montserrat', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: size * 0.46,
              letterSpacing: "-0.02em",
              color: wordmarkColor,
            }}
          >
            pepsico
          </span>
          {showTagline && (
            <span
              style={{
                fontFamily: "'Montserrat', system-ui, sans-serif",
                fontWeight: 600,
                fontSize: size * 0.2,
                letterSpacing: "0.02em",
                marginTop: size * 0.08,
                color: C.blue,
              }}
            >
              Food. Drinks. Smiles.
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default PepsiCoLogo;
