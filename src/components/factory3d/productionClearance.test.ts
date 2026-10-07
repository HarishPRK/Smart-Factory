import { describe, expect, it } from "vitest";
import {
  ARM_LENGTHS, BELT_Y, BOTTLE_HEIGHT, BOTTLE_RADIUS, BOTTLE_SCALE, CASE, CELL_Y,
  PACK, ROBOT_BASE, WRIST_DROP, cartonPose, robotToolPoint, sampleProduct, solveRobotArm,
  type V3,
} from "./productionCycle";

type Bounds = { min: V3; max: V3 };

// Cell-local envelopes include the wall thickness and the full 0.37-long open flaps.
// These are geometry contracts for the rendered package, not just its center point.
const cartonObstacles: Bounds[] = [
  { min: [1.73, 1.22, -0.35], max: [1.77, 2, 0.35] },
  { min: [2.43, 1.22, -0.35], max: [2.47, 2, 0.35] },
  { min: [1.73, 1.22, -0.35], max: [2.47, 2, -0.31] },
  { min: [1.73, 1.22, 0.31], max: [2.47, 2, 0.35] },
  { min: [1.37, 1.98, -0.35], max: [1.77, 2.12, 0.35] },
  { min: [2.43, 1.98, -0.35], max: [2.83, 2.12, 0.35] },
];

function pointClearance(point: V3, box: Bounds) {
  return Math.hypot(...point.map((value, axis) =>
    Math.max(box.min[axis] - value, 0, value - box.max[axis])));
}

function capsuleClearance(start: V3, end: V3, radius: number, box: Bounds) {
  let clearance = Infinity;
  for (let step = 0; step <= 32; step++) {
    const point = start.map((value, axis) => value + (end[axis] - value) * step / 32) as V3;
    clearance = Math.min(clearance, pointClearance(point, box) - radius);
  }
  return clearance;
}

function armPoints(phase: number) {
  const tool = robotToolPoint(phase);
  const joint = solveRobotArm(tool);
  const [upper, lower] = ARM_LENGTHS;
  const elbowRadius = -upper * Math.sin(joint.shoulder);
  const wristRadius = elbowRadius - lower * Math.sin(joint.shoulder + joint.elbow);
  const elbow: V3 = [
    ROBOT_BASE[0] + elbowRadius * Math.cos(joint.yaw),
    ROBOT_BASE[1] + upper * Math.cos(joint.shoulder),
    ROBOT_BASE[2] - elbowRadius * Math.sin(joint.yaw),
  ];
  const wrist: V3 = [
    ROBOT_BASE[0] + wristRadius * Math.cos(joint.yaw),
    elbow[1] + lower * Math.cos(joint.shoulder + joint.elbow),
    ROBOT_BASE[2] - wristRadius * Math.sin(joint.yaw),
  ];
  return { tool, elbow, wrist };
}

function bottleClearance(bottom: V3, box: Bounds) {
  const dx = Math.max(box.min[0] - bottom[0], 0, bottom[0] - box.max[0]);
  const dz = Math.max(box.min[2] - bottom[2], 0, bottom[2] - box.max[2]);
  const horizontalGap = Math.max(0, Math.hypot(dx, dz) - BOTTLE_RADIUS);
  const verticalGap = Math.max(0, box.min[1] - bottom[1] - 1.365 * BOTTLE_SCALE, bottom[1] - box.max[1]);
  return Math.hypot(horizontalGap, verticalGap);
}

describe("Packaging geometry clearance", () => {
  it("fits the entire capped bottle below the case lip with room around its body", () => {
    expect(BOTTLE_HEIGHT).toBeLessThan(0.65);
    expect(CASE.floor + 1.365 * BOTTLE_SCALE).toBeLessThan(CASE.height - 0.04);
    expect(2 * BOTTLE_RADIUS + 0.2).toBeLessThan(Math.min(CASE.width, CASE.depth) - 0.08);
  });

  it("keeps the physical forearm and vertical extension clear of carton walls and open flaps", () => {
    for (let step = 0; step <= 100; step++) {
      const { tool, elbow, wrist } = armPoints(step / 100);
      const target: V3 = [tool[0], tool[1] + WRIST_DROP, tool[2]];
      target.forEach((value, axis) => expect(wrist[axis]).toBeCloseTo(value, 6));
      expect(Math.hypot(...target.map((value, axis) => value - ROBOT_BASE[axis]))).toBeLessThan(3.9);
      for (const box of cartonObstacles) {
        expect(capsuleClearance(elbow, wrist, 0.21, box)).toBeGreaterThan(0.08);
        expect(capsuleClearance(wrist, tool, 0.06, box)).toBeGreaterThan(0.08);
        // Covers the palm's 0.32-by-0.16 footprint, open fingers and actuator.
        expect(capsuleClearance([tool[0], tool[1] - 0.06, tool[2]], [tool[0], tool[1] + 0.22, tool[2]], 0.18, box)).toBeGreaterThan(0.08);
      }
    }
  });

  it("carries the whole bottle above the flaps and lowers it through the open center", () => {
    for (let step = 0; step <= 100; step++) {
      const phase = PACK.grip + (PACK.release - PACK.grip) * step / 100;
      const tool = robotToolPoint(phase);
      const product = sampleProduct(69 + phase * 8);
      const localBottom: V3 = [product.position[0] - 4, product.position[1] - CELL_Y, product.position[2] + 8];
      expect(localBottom[0]).toBeCloseTo(tool[0], 6);
      expect(localBottom[1] + BOTTLE_HEIGHT).toBeCloseTo(tool[1], 6);
      expect(localBottom[2]).toBeCloseTo(tool[2], 6);
      for (const box of cartonObstacles) expect(bottleClearance(localBottom, box)).toBeGreaterThan(0.08);
      if (phase >= 0.45 && phase <= 0.6) expect(product.position[1]).toBeGreaterThan(2.3);
    }
  });

  it("withdraws vertically before moving sideways or closing the carton", () => {
    let previousHeight = -Infinity;
    for (let step = 0; step <= 100; step++) {
      const phase = PACK.release + (PACK.clear - PACK.release) * step / 100;
      const tool = robotToolPoint(phase);
      expect(tool[0]).toBeCloseTo(CASE.x, 6);
      expect(tool[2]).toBe(0);
      expect(tool[1]).toBeGreaterThanOrEqual(previousHeight - 1e-10);
      expect(cartonPose(69 + phase * 8).closed).toBe(0);
      previousHeight = tool[1];
    }
    expect(PACK.close).toBeGreaterThan(PACK.clear);
    expect(robotToolPoint(PACK.clear)[1] + CELL_Y - 0.06).toBeGreaterThan(BELT_Y + CASE.height + 0.3);
    expect(cartonPose(69 + PACK.close * 8).closed).toBeCloseTo(0, 10);
    expect(cartonPose(69 + 0.99 * 8).closed).toBeCloseTo(1, 10);
  });

  it("keeps the returning arm above the flaps throughout their upward closing sweep", () => {
    for (let step = 0; step <= 100; step++) {
      const phase = PACK.close + (1 - PACK.close) * step / 100;
      const { tool, elbow, wrist } = armPoints(phase);
      const closed = cartonPose(69 + phase * 8).closed;
      for (const sign of [-1, 1]) {
        const angle = sign * (0.3 + closed * (Math.PI - 0.3));
        const corners = [0, sign * 0.37].flatMap((x) => [-0.01, 0.01].map((y) => [
          2.1 + sign * 0.37 + x * Math.cos(angle) - y * Math.sin(angle),
          2 + x * Math.sin(angle) + y * Math.cos(angle),
        ]));
        const flap: Bounds = {
          min: [Math.min(...corners.map(([x]) => x)), Math.min(...corners.map(([, y]) => y)), -0.35],
          max: [Math.max(...corners.map(([x]) => x)), Math.max(...corners.map(([, y]) => y)), 0.35],
        };
        expect(capsuleClearance(elbow, wrist, 0.21, flap)).toBeGreaterThan(0.08);
        expect(capsuleClearance(wrist, tool, 0.06, flap)).toBeGreaterThan(0.08);
        expect(capsuleClearance([tool[0], tool[1] - 0.06, tool[2]], [tool[0], tool[1] + 0.22, tool[2]], 0.18, flap)).toBeGreaterThan(0.08);
      }
    }
  });

  it("keeps the seated bottle and carton aligned through closing and outfeed", () => {
    for (const age of [69 + PACK.release * 8, 76.92, 76.999, 77, 77.001, 81, 86]) {
      const product = sampleProduct(age);
      const carton = cartonPose(age);
      expect(product.position[0]).toBeCloseTo(carton.position[0], 6);
      expect(product.position[1] - carton.position[1]).toBeCloseTo(CASE.floor, 6);
      expect(product.position[2]).toBeCloseTo(carton.position[2], 6);
    }
    for (const boundary of [69 + PACK.grip * 8, 69 + PACK.release * 8, 76.92, 77, 86]) {
      const before = sampleProduct(boundary - 0.0001).position;
      const after = sampleProduct(boundary + 0.0001).position;
      expect(Math.hypot(...before.map((value, axis) => value - after[axis]))).toBeLessThan(0.001);
    }
  });
});
