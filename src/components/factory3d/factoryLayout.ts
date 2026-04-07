import type { ZoneId } from "../../types";

// Machine positions in 3D space [x, y(up), z]
// Legacy machines removed — only the CNC Lathe and Cooling Tower remain
// as auxiliary equipment near the digital twin pipeline
export const MACHINE_POSITIONS: Record<string, [number, number, number]> = {
  m5: [-6, 0,  -3],   // CNC Lathe (tool maintenance area)
  m6: [ 6, 0,  -3],   // Cooling Tower (utilities)
};

// Zone floor rectangles [centerX, centerZ, width, depth]
export const ZONE_BOUNDS: Record<ZoneId, [number, number, number, number]> = {
  1: [-5, 2, 10, 8],
  2: [ 0, -2, 10, 8],
  3: [ 5, 2, 10, 8],
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

/**
 * Zig-zag conveyor path for the PET bottle production line.
 *
 * Layout (top-down view):
 *
 *   INTAKE ──── MIXING ─────┐
 *                            │  (turn 1)
 *   FORMING ←────────────────┘
 *   │
 *   └──────────── CURING ─── QUALITY
 *                                │  (turn 2)
 *   DISPATCH ← PACKAGING ───────┘
 *
 * Conveyor runs at y=0.5 with smooth corners.
 */
export const CONVEYOR_PATH: [number, number, number][] = [
  // Row 1: left to right (intake → mixing)
  [-8,  0.5,  4],
  [-4,  0.5,  4],
  [ 0,  0.5,  4],
  [ 4,  0.5,  4],
  // Turn 1: right side, go down
  [ 5,  0.5,  3],
  [ 5,  0.5,  1],
  // Row 2: right to left (forming → curing)
  [ 4,  0.5,  0],
  [ 0,  0.5,  0],
  [-4,  0.5,  0],
  // Turn 2: left side, go down
  [-5,  0.5, -1],
  [-5,  0.5, -3],
  // Row 3: left to right (quality → packaging → dispatch)
  [-4,  0.5, -4],
  [ 0,  0.5, -4],
  [ 4,  0.5, -4],
  [ 8,  0.5, -4],
];

// Re-export digital twin layout for convenience
export { STAGE_POSITIONS, STAGE_CONVEYOR_T } from "./digitalTwinLayout";
