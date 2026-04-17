/**
 * Frame-budget governor shared across heavy useFrame hooks.
 *
 * Target: ~120fps when GPU allows, gracefully degrade to 60fps when R3F's
 * adaptive performance signal drops. Components call shouldRun(delta) at the
 * top of their useFrame; when it returns false they skip the frame's work.
 */
import { useThree } from "@react-three/fiber";
import { useRef } from "react";

type BudgetTier = "high" | "medium" | "low";

export interface FrameBudget {
  /** Call at the top of useFrame. Returns true if this frame should render. */
  shouldRun: (delta: number) => boolean;
  /** Current target tier — components can scale their instance counts. */
  tier: () => BudgetTier;
}

export function useFrameBudget(targetFps = 120): FrameBudget {
  const perfRef = useThree((s) => s.performance);
  const accumRef = useRef(0);

  const minInterval = 1 / targetFps;
  const lowInterval = 1 / 60;

  return {
    shouldRun(delta: number) {
      const perf = perfRef.current;
      const interval = perf < 0.75 ? lowInterval : minInterval;
      accumRef.current += delta;
      if (accumRef.current < interval) return false;
      accumRef.current = 0;
      return true;
    },
    tier() {
      const perf = perfRef.current;
      if (perf < 0.6) return "low";
      if (perf < 0.85) return "medium";
      return "high";
    },
  };
}
