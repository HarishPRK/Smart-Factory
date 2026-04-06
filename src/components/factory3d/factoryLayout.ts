import type { ZoneId } from "../../types";

// Machine positions in 3D space [x, y(up), z]
export const MACHINE_POSITIONS: Record<string, [number, number, number]> = {
  m1: [-7, 0, -2],   // Injection Molding  (Zone 1)
  m4: [-7, 0,  3],   // Conveyor Belt      (Zone 1)
  m2: [ 0, 0, -2],   // Hydraulic Press    (Zone 2)
  m5: [ 0, 0,  3],   // CNC Lathe          (Zone 2)
  m3: [ 7, 0, -2],   // Industrial Boiler  (Zone 3)
  m6: [ 7, 0,  3],   // Cooling Tower      (Zone 3)
};

// Zone floor rectangles [centerX, centerZ, width, depth]
export const ZONE_BOUNDS: Record<ZoneId, [number, number, number, number]> = {
  1: [-7, 0.5, 8, 12],
  2: [ 0, 0.5, 8, 12],
  3: [ 7, 0.5, 8, 12],
};

export const ZONE_COLORS: Record<ZoneId, string> = {
  1: "#1e3a5f",
  2: "#1a2f4a",
  3: "#162842",
};

export const STATUS_COLORS = {
  critical: { hex: "#ef4444", emissive: 0xef4444, pulseSpeed: 4.0 },
  warning:  { hex: "#f59e0b", emissive: 0xf59e0b, pulseSpeed: 1.5 },
  normal:   { hex: "#10b981", emissive: 0x10b981, pulseSpeed: 0.0 },
} as const;

export type StatusTier = keyof typeof STATUS_COLORS;

export const STATUS_MAP: Record<string, StatusTier> = {
  high: "critical",
  medium: "warning",
  low: "normal",
};

// Conveyor path waypoints (runs along front of all zones)
export const CONVEYOR_PATH: [number, number, number][] = [
  [-10, 0.5, 3],
  [ -4, 0.5, 3],
  [  4, 0.5, 3],
  [ 10, 0.5, 3],
];

// Re-export digital twin layout for convenience
export { STAGE_POSITIONS, STAGE_CONVEYOR_T } from "./digitalTwinLayout";
