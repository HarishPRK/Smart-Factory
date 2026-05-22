import { useEffect, useRef, useState } from "react";

/* ── useTweenedNumber ─────────────────────────────────────
 * Smoothly animates from the current display value to a new `target` using
 * requestAnimationFrame and an ease-out cubic curve. Each time the target
 * changes the tween restarts from the *current* display position (not from
 * the previous target), so rapid live-data updates blend together rather
 * than snapping.
 *
 * Honors `prefers-reduced-motion` — when set, the value updates instantly
 * with no animation cost.
 *
 * Designed for KPI tiles, gauge readouts, and any stat number being driven
 * by ~1–10 Hz live data. Keep duration ≤ 250–400 ms so the value never
 * lags noticeably behind the underlying signal.
 */

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function useTweenedNumber(target: number, durationMs = 350): number {
  const [displayValue, setDisplayValue] = useState(target);
  const displayRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  // Track prefers-reduced-motion live so users toggling the OS setting
  // mid-session get the right behaviour without a reload.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mql.matches;
    const handler = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!Number.isFinite(target)) return;

    if (reducedMotionRef.current) {
      displayRef.current = target;
      setDisplayValue(target);
      return;
    }

    const startValue = displayRef.current;
    const delta = target - startValue;
    // Skip negligible changes — avoids a render storm when a live feed
    // republishes the same value (or a noise-floor jitter near zero).
    if (Math.abs(delta) < 1e-6) {
      displayRef.current = target;
      return;
    }

    const startTime = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      const current = startValue + delta * eased;

      displayRef.current = current;
      setDisplayValue(current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, durationMs]);

  return displayValue;
}
