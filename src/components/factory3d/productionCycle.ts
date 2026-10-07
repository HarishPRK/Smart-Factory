import { CatmullRomCurve3, Vector3 } from "three";
import type { StageId } from "../../types/digitalTwin";
import type { TwinAlarmSummary } from "./twinAlarmState";
export type V3 = [number, number, number];
export const CYCLE_SECONDS = 96;
export const PRODUCT_COUNT = 8;
export const BELT_Y = 1.3;
export const CELL_Y = 0.08;
export const BOTTLE_SCALE = 0.48;
export const BOTTLE_HEIGHT = 1.28 * BOTTLE_SCALE;
export const BOTTLE_RADIUS = 0.27 * BOTTLE_SCALE;
export const PROCESS_RATE = 1.8;
export const WRIST_DROP = 0.55;
export const CASE = { x: 2.1, width: 0.74, depth: 0.7, height: 0.78, floor: 0.06 } as const;
export const PACK = { grip: 0.3, release: 0.74, clear: 0.88, close: 0.9 } as const;
export const ROBOT_BASE: V3 = [0, 0.85, -1.6];
export const ARM_LENGTHS = [2, 2] as const;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a: V3, b: V3, t: number): V3 => a.map((n, i) => n + (b[i] - n) * smooth(t)) as V3;
const curve = (points: V3[]) => new CatmullRomCurve3(points.map((p) => new Vector3(...p)), false, "catmullrom", 0.2);
export const FEED_PATH = curve([[-13, 1.7, 9.8], [-10, 1.7, 9.8], [-8, 3.8, 9.8], [-4, 3.8, 8], [-2.4, 3.3, 7.3]]);
const toFill = curve([[0, BELT_Y, 8], [8, BELT_Y, 8], [10, BELT_Y, 6], [10, BELT_Y, 2], [8, BELT_Y, 0], [6, BELT_Y, 0]]);
const toInspection = curve([[-7, BELT_Y, 0], [-10, BELT_Y, -2], [-10, BELT_Y, -6], [-8, BELT_Y, -8], [-6, BELT_Y, -8]]);
// Product paths and conveyor geometry share the same curves; transfers cannot drift off the belt.
export const LINE_PATHS = [curve([[-2.1, BELT_Y - 0.08, 8], [0, BELT_Y - 0.08, 8]]), toFill, curve([[6, BELT_Y, 0], [-7, BELT_Y, 0]]), toInspection, curve([[-6, BELT_Y, -8], [17.5, BELT_Y, -8]])].map((c) => curve(c.points.map((p) => [p.x, BELT_Y - 0.08, p.z] as V3)));
const on = (c: CatmullRomCurve3, t: number) => c.getPointAt(clamp(t)).toArray() as V3;

export const STATION_WINDOWS: Record<StageId, [number, number]> = {
  intake: [0, 6], forming: [6, 18], mixing: [31, 39], curing: [44, 50], quality: [60, 64], packaging: [69, 77], dispatch: [86, 94],
};
export function productAge(time: number, index: number) { return ((time + index * CYCLE_SECONDS / PRODUCT_COUNT) % CYCLE_SECONDS + CYCLE_SECONDS) % CYCLE_SECONDS; }
export function stationPhase(time: number, stage: StageId): number | null {
  const [start, end] = STATION_WINDOWS[stage];
  for (let i = 0; i < PRODUCT_COUNT; i++) { const age = productAge(time, i); if (age >= start && age < end) return (age - start) / (end - start); }
  return null;
}
export function advanceProcessClock(time: number, delta: number, active: boolean, speed: number, alarm?: Pick<TwinAlarmSummary, "lineStopped" | "speedLimit">, userSpeedMultiplier = 1) {
  if (!active || alarm?.lineStopped || !Number.isFinite(delta) || !Number.isFinite(speed)) return time;
  // The shared simulation already applies its .8 slowdown. Cap it rather than
  // multiplying a second time, while preserving the operator's speed override.
  const responseSpeed = alarm?.speedLimit === 0.8 ? Math.min(speed, Math.max(0, userSpeedMultiplier) * 0.8) : speed;
  return (time + Math.max(0, Math.min(delta, 0.1)) * Math.max(0, responseSpeed) * PROCESS_RATE) % CYCLE_SECONDS;
}

/** Coordinates are relative to the packaging cell. The product and gripper use this exact path. */
export function robotToolPoint(phase: number): V3 {
  const pickup = BELT_Y - CELL_Y + BOTTLE_HEIGHT;
  const place = pickup + CASE.floor;
  const frames: [number, V3][] = [
    [0, [0.6, 2.95, -0.7]], [0.15, [0, 2.95, 0]], [PACK.grip, [0, pickup, 0]],
    [0.45, [0, 2.95, 0]], [0.6, [CASE.x, 2.95, 0]], [PACK.release, [CASE.x, place, 0]],
    [0.78, [CASE.x, place, 0]], [PACK.clear, [CASE.x, 2.95, 0]], [0.98, [0.6, 2.95, -0.7]], [1, [0.6, 2.95, -0.7]],
  ];
  for (let i = 1; i < frames.length; i++) if (phase <= frames[i][0]) return mix(frames[i - 1][1], frames[i][1], (phase - frames[i - 1][0]) / (frames[i][0] - frames[i - 1][0]));
  return frames[0][1];
}

/** Smooth docking, liquid delivery and capping use the same timeline as the bottle. */
export function fillingPose(age: number) {
  const dock = smooth((age - 31) / 1) * (1 - smooth((age - 36.7) / 0.5));
  const overBottle = smooth((age - 37.2) / 0.35) * (1 - smooth((age - 38.4) / 0.5));
  const down = smooth((age - 37.55) / 0.45) * (1 - smooth((age - 38) / 0.35));
  const fill = smooth((age - 32) / 4.7);
  return {
    fill,
    nozzleX: -0.55 * smooth((age - 36.7) / 0.5) * (1 - smooth((age - 38.7) / 0.3)),
    nozzleTip: 2.48 + (BELT_Y - CELL_Y + BOTTLE_HEIGHT - 0.018 - 2.48) * dock,
    stream: smooth((age - 32) / 0.16) * (1 - smooth((age - 36.54) / 0.16)),
    capperX: 0.75 * (1 - overBottle),
    capperY: 2.48 + (BELT_Y - CELL_Y + 1.365 * BOTTLE_SCALE - 2.48) * down,
  };
}
export function cartonPose(age: number) {
  const phase = (age - 69) / 8;
  const position: V3 = age < 69 ? mix([4 + CASE.x, BELT_Y, -10.8], [4 + CASE.x, BELT_Y, -8], (age - 66) / 3)
    : age < 77 ? [4 + CASE.x, BELT_Y, -8]
    : age < 86 ? mix([4 + CASE.x, BELT_Y, -8], [14, BELT_Y, -8], (age - 77) / 9)
    : mix([14, BELT_Y, -8], [17, BELT_Y, -8], (age - 86) / 10);
  return { visible: age >= 66, position, closed: smooth((phase - PACK.close) / 0.09) };
}
export function solveRobotArm(tool: V3) {
  const dx = tool[0] - ROBOT_BASE[0], dy = tool[1] + WRIST_DROP - ROBOT_BASE[1], dz = tool[2] - ROBOT_BASE[2];
  const r = Math.hypot(dx, dz); const d = Math.min(3.999, Math.max(0.01, Math.hypot(r, dy)));
  const [a, b] = ARM_LENGTHS;
  // Elbow-up solution keeps both links above the conveyor instead of sweeping through it.
  const elbow = -Math.acos(Math.max(-1, Math.min(1, (d * d - a * a - b * b) / (2 * a * b))));
  const shoulder = Math.atan2(dy, r) - Math.atan2(b * Math.sin(elbow), a + b * Math.cos(elbow)) - Math.PI / 2;
  return { yaw: Math.atan2(-dz, dx), shoulder, elbow, wrist: -shoulder - elbow };
}

export interface ProductPose {
  position: V3; phase: string; pellet: boolean; expansion: number; fill: number; capped: boolean; cooled: number; boxed: boolean; inCarton: boolean; inspect: number | null;
}
export function sampleProduct(age: number): ProductPose {
  const p: ProductPose = { position: [0, BELT_Y, 8], phase: "Material feed", pellet: false, expansion: 0, fill: 0, capped: false, cooled: 0, boxed: false, inCarton: false, inspect: null };
  if (age < 6) { p.position = on(FEED_PATH, age / 6); p.pellet = true; }
  else if (age < 10) { p.position = [-2.1, BELT_Y, 8]; p.phase = "Preform injection"; }
  else if (age < 12) { p.position = mix([-2.1, BELT_Y, 8], [0, BELT_Y, 8], (age - 10) / 2); p.phase = "Preform transfer"; }
  else if (age < 18) { p.expansion = smooth((age - 13.8) / 2.2); p.phase = age < 14 ? "Mold clamping" : age < 16 ? "Stretch & blow" : "Mold opening"; }
  else if (age < 31) { p.position = on(toFill, smooth((age - 18) / 13)); p.expansion = 1; p.phase = "Empty bottle transfer"; }
  else if (age < 39) { p.position = [6, BELT_Y, 0]; p.expansion = 1; p.fill = fillingPose(age).fill; p.capped = age >= 38; p.phase = age < 32 ? "Nozzle docking" : age < 36.7 ? "Liquid filling" : "Capping"; }
  else {
    p.expansion = 1; p.fill = 1; p.capped = true;
    if (age < 44) { p.position = mix([6, BELT_Y, 0], [-1, BELT_Y, 0], (age - 39) / 5); p.phase = "Filled bottle transfer"; }
    else if (age < 50) { p.position = [-1 - (age - 44), BELT_Y, 0]; p.cooled = (age - 44) / 6; p.phase = "Cooling / conditioning"; }
    else {
      p.cooled = 1;
      if (age < 60) { p.position = on(toInspection, (age - 50) / 10); p.phase = "Inspection infeed"; }
      else if (age < 64) { p.position = [-6, BELT_Y, -8]; p.inspect = (age - 60) / 4; p.phase = age < 63.4 ? "Optical / fill-level scan" : "Inspection passed"; }
      else if (age < 69) { p.position = mix([-6, BELT_Y, -8], [4, BELT_Y, -8], (age - 64) / 5); p.phase = "Packing infeed"; }
      else if (age < 77) {
        const t = (age - 69) / 8; p.phase = t < PACK.grip ? "Cobot approaches" : t < 0.45 ? "Cobot lifts bottle" : t < 0.6 ? "Cobot transfers bottle" : t < PACK.release ? "Cobot places bottle" : t < PACK.clear ? "Gripper withdraws" : "Case closing";
        p.position = t < PACK.grip ? [4, BELT_Y, -8] : t < PACK.release ? robotToolPoint(t).map((v, i) => v + [4, CELL_Y - BOTTLE_HEIGHT, -8][i]) as V3 : [4 + CASE.x, BELT_Y + CASE.floor, -8];
        p.inCarton = t >= PACK.release; p.boxed = t >= 0.99;
      } else { p.boxed = true; p.inCarton = true; p.phase = "Case outfeed / dispatch"; p.position = cartonPose(age).position.map((v, i) => v + (i === 1 ? CASE.floor : 0)) as V3; }

    }
  }
  return p;
}
