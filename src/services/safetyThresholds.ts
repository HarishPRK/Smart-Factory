/** Fire input falls as the hazard increases; thresholds use the scaled 0–100 reading. */
export const FIRE_WARNING_THRESHOLD = 60;
export const FIRE_HAZARD_THRESHOLD = 50;

export function fireSensorStatus(value: number): "normal" | "warning" | "critical" {
  if (value <= FIRE_HAZARD_THRESHOLD) return "critical";
  if (value <= FIRE_WARNING_THRESHOLD) return "warning";
  return "normal";
}
