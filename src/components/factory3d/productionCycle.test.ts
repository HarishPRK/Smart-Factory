import { describe, expect, it } from "vitest";
import { ARM_LENGTHS, BELT_Y, BOTTLE_HEIGHT, CELL_Y, CYCLE_SECONDS, LINE_PATHS, PACK, PROCESS_RATE, ROBOT_BASE, WRIST_DROP, advanceProcessClock, fillingPose, productAge, robotToolPoint, sampleProduct, solveRobotArm, stationPhase } from "./productionCycle";

describe("Coordinated PET process", () => {
  it("converts resin into an empty bottle before filling, capping, cooling and packing", () => {
    expect(sampleProduct(3).pellet).toBe(true);
    expect(sampleProduct(9)).toMatchObject({ pellet: false, expansion: 0, fill: 0 });
    expect(sampleProduct(14.5).expansion).toBeGreaterThan(0);
    expect(sampleProduct(14.5).expansion).toBeLessThan(1);
    expect(sampleProduct(20)).toMatchObject({ expansion: 1, fill: 0, capped: false });
    expect(sampleProduct(34).fill).toBeGreaterThan(0.35);
    expect(sampleProduct(34).fill).toBeLessThan(0.45);
    expect(sampleProduct(37.5)).toMatchObject({ fill: 1, capped: false });
    expect(sampleProduct(38.5).capped).toBe(true);
    expect(sampleProduct(47).cooled).toBeCloseTo(0.5);
    expect(sampleProduct(62).inspect).toBeCloseTo(0.5);
    expect(sampleProduct(80).boxed).toBe(true);
  });

  it("keeps each bottle on the same path as its conveyor during transfer", () => {
    for (const [age, path, t] of [[24.5, 1, 0.5], [55, 3, 0.5]] as const) {
      const p = sampleProduct(age).position; const belt = LINE_PATHS[path].getPointAt(t);
      expect(p[0]).toBeCloseTo(belt.x, 5); expect(p[2]).toBeCloseTo(belt.z, 5);
      expect(p[1]).toBe(BELT_Y);
    }
  });

  it("solves a reachable gripper position and keeps the carried bottle at its jaws", () => {
    for (const t of [0, 0.18, 0.3, 0.42, 0.55, 0.7, 0.8, 0.95]) {
      const target = robotToolPoint(t); const j = solveRobotArm(target); const [a, b] = ARM_LENGTHS;
      const x = -a * Math.sin(j.shoulder) - b * Math.sin(j.shoulder + j.elbow);
      const y = a * Math.cos(j.shoulder) + b * Math.cos(j.shoulder + j.elbow);
      expect(ROBOT_BASE[1] + a * Math.cos(j.shoulder)).toBeGreaterThan(BELT_Y + 0.5);
      const endpoint = [ROBOT_BASE[0] + x * Math.cos(j.yaw), ROBOT_BASE[1] + y, ROBOT_BASE[2] - x * Math.sin(j.yaw)];
      endpoint.forEach((v, i) => expect(v).toBeCloseTo(target[i] + (i === 1 ? WRIST_DROP : 0), 5));
      if (t >= PACK.grip && t < PACK.release) {
        const bottle = sampleProduct(69 + t * 8).position;
        expect(bottle[0]).toBeCloseTo(target[0] + 4, 5);
        expect(bottle[1] + BOTTLE_HEIGHT).toBeCloseTo(target[1] + CELL_Y, 5);
        expect(bottle[2]).toBeCloseTo(target[2] - 8, 5);
      }
    }
  });

  it("does not jump at filling, cooling or robot pickup and release", () => {
    for (const age of [18, 31, 39, 44, 50, 60, 64, 69, 69 + PACK.grip * 8, 69 + PACK.release * 8, 77, 86]) {
      const a = sampleProduct(age - 0.0001).position, b = sampleProduct(age + 0.0001).position;
      expect(Math.hypot(...a.map((v, i) => v - b[i]))).toBeLessThan(0.005);
    }
  });

  it("halts the entire cycle on pause or stopped conveyor and scales time together", () => {
    expect(advanceProcessClock(30, 0.05, false, 1)).toBe(30);
    expect(advanceProcessClock(30, 0.05, true, 0)).toBe(30);
    expect(advanceProcessClock(30, 0.05, true, 2)).toBeCloseTo(30 + 0.1 * PROCESS_RATE);
    expect(productAge(CYCLE_SECONDS, 0)).toBe(0);
    expect(stationPhase(34, "mixing")).toBeCloseTo(3 / 8);
  });

  it("fills monotonically with a docked nozzle, then clears the neck before capping", () => {
    let previousFill = 0;
    for (let age = 31; age <= 39; age += 0.01) {
      const pose = fillingPose(age);
      expect(pose.fill).toBeGreaterThanOrEqual(previousFill);
      if (pose.stream > 0) expect(pose.nozzleTip).toBeLessThan(BELT_Y - CELL_Y + BOTTLE_HEIGHT);
      if (pose.capperY < 2.4) { expect(pose.nozzleTip).toBeGreaterThan(2.4); expect(pose.nozzleX).toBeLessThan(-0.5); }
      previousFill = pose.fill;
    }
    for (const age of [31, 32, 36.54, 36.7, 37.2, 37.55, 38, 38.35, 38.4, 38.9, 39]) {
      const before = fillingPose(age - 0.001), after = fillingPose(age + 0.001);
      for (const key of ["nozzleX", "nozzleTip", "capperX", "capperY", "stream"] as const) expect(Math.abs(after[key] - before[key])).toBeLessThan(0.02);
    }
  });
});
