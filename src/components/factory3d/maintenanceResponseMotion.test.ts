import { describe, expect, it } from "vitest";
import type { StageId } from "../../types/digitalTwin";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import { FEED_PATH, LINE_PATHS } from "./productionCycle";
import { MAINTENANCE_HOME, advanceMaintenanceMotion, createMaintenanceMotion, maintenanceRoute, maintenanceRouteLength, maintenanceServicePoint, sampleMaintenanceRoute } from "./maintenanceResponseMotion";

const stageIds: StageId[] = ["intake", "forming", "mixing", "curing", "quality", "packaging", "dispatch"];
const footprints: Record<StageId, [number, number]> = { intake: [7.5, 6], forming: [7.8, 4.8], mixing: [7.1, 7], curing: [7.6, 4.8], quality: [6.5, 4.5], packaging: [7.7, 6.5], dispatch: [7.3, 6.2] };

describe("Illustrative maintenance response", () => {
  it("walks on service aisles, outside machine footprints and conveyor paths", () => {
    const beltSamples = [...LINE_PATHS, FEED_PATH].flatMap((path) => Array.from({ length: 251 }, (_, index) => path.getPointAt(index / 250)));
    for (const id of stageIds) {
      const route = maintenanceRoute(id);
      const length = maintenanceRouteLength(route);
      expect(route[0]).toEqual(MAINTENANCE_HOME);
      expect(route.at(-1)).toEqual(maintenanceServicePoint(id));
      for (let distance = 0; distance <= length; distance += 0.15) {
        const { position: [x, z] } = sampleMaintenanceRoute(route, distance);
        for (const cellId of stageIds) {
          const [cx, , cz] = STAGE_POSITIONS[cellId];
          const [width, depth] = footprints[cellId];
          const dx = Math.max(0, Math.abs(x - cx) - width / 2);
          const dz = Math.max(0, Math.abs(z - (cz - 0.5)) - depth / 2);
          expect(Math.hypot(dx, dz), `${id} service route vs ${cellId}`).toBeGreaterThan(0.24);
        }
        expect(Math.min(...beltSamples.map((point) => Math.hypot(point.x - x, point.z - z))), `${id} service route vs belt`).toBeGreaterThan(0.85);
      }
    }
  });

  it("moves independently while production is stopped and holds inspection until fault clears", () => {
    let state = createMaintenanceMotion();
    for (let frame = 0; frame < 400; frame++) state = advanceMaintenanceMotion(state, "forming", 0.05);
    expect(state.phase).toBe("inspecting");
    expect(sampleMaintenanceRoute(state.route, state.distance).position).toEqual(maintenanceServicePoint("forming"));
    const distance = state.distance;
    state = advanceMaintenanceMotion(state, "forming", 0.05);
    expect(state.distance).toBe(distance);
    expect(state.workingTime).toBeGreaterThan(0);
    expect(state.stageId).toBe("forming");
  });

  it("retraces its safe route when an incident clears or the target changes", () => {
    let state = createMaintenanceMotion();
    for (let frame = 0; frame < 40; frame++) state = advanceMaintenanceMotion(state, "forming", 0.05);
    const distance = state.distance;
    state = advanceMaintenanceMotion(state, "mixing", 0.05);
    expect(state.phase).toBe("returning");
    expect(state.stageId).toBe("forming");
    expect(state.distance).toBeLessThan(distance);
    for (let frame = 0; frame < 60; frame++) state = advanceMaintenanceMotion(state, null, 0.05);
    expect(state.phase).toBe("idle");
    expect(state.stageId).toBeNull();
    expect(sampleMaintenanceRoute(state.route, state.distance).position).toEqual(MAINTENANCE_HOME);
  });

  it("uses a static exterior technician for reduced motion and suppresses elapsed work animation", () => {
    const state = advanceMaintenanceMotion(createMaintenanceMotion(), "packaging", 0.016, true);
    expect(state.phase).toBe("inspecting");
    expect(state.workingTime).toBe(0);
    expect(sampleMaintenanceRoute(state.route, state.distance).position).toEqual(maintenanceServicePoint("packaging"));
    expect(advanceMaintenanceMotion(state, null, 0.016, true).phase).toBe("idle");
  });
});
