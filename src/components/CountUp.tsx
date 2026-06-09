import React, { useEffect, useState } from "react";
import { useTweenedNumber } from "../hooks/useTweenedNumber";

interface CountUpProps {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  /** Thousands grouping (default: on for values ≥ 1000). */
  group?: boolean;
  durationMs?: number;
  /** Rendered verbatim when `value` isn't a finite number (e.g. "—"). */
  fallback?: React.ReactNode;
}

/**
 * Animated number that sweeps to `value`. On first mount it counts up from
 * zero (one-frame reveal gate); afterwards it tweens from the current value to
 * any new target, so live updates blend smoothly. Honors prefers-reduced-motion
 * via the underlying tween hook. Shared by the OEE / Analytics / Predict panels
 * so every stat animates identically.
 */
const CountUp: React.FC<CountUpProps> = ({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  group,
  durationMs = 800,
  fallback = "—",
}) => {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const ok = Number.isFinite(value);
  const tweened = useTweenedNumber(ok && revealed ? value : 0, durationMs);

  if (!ok) return <>{fallback}</>;

  const useGrouping = group ?? Math.abs(value) >= 1000;
  return (
    <>
      {prefix}
      {tweened.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping,
      })}
      {suffix}
    </>
  );
};

export default CountUp;
