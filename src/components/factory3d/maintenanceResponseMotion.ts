import type { StageId } from "../../types/digitalTwin";
import { STAGE_POSITIONS } from "./digitalTwinLayout";

export type MaintenancePoint = [number, number];
export type MaintenancePhase = "idle" | "approaching" | "inspecting" | "returning";
export const MAINTENANCE_HOME: MaintenancePoint = [-19.85, 12.8];
export const MAINTENANCE_WALK_SPEED = 2.2;

// These are exterior service locations, not conveyor or robot work envelopes.
// Back-row inspections remain outside the packaging/dispatch safety fences.
const SERVICE_OFFSETS: Record<StageId, MaintenancePoint> = {
  intake: [2.5, 3.25], forming: [2.5, 2.9], mixing: [2.6, 3.9],
  curing: [2.6, 2.9], quality: [-1.2, -3.65], packaging: [2.1, -4.25], dispatch: [-1.7, -4.15],
};
const SERVICE_CORRIDORS: Record<StageId, number> = {
  intake: 12.8, forming: 12.8, mixing: 3.75, curing: 3.75,
  quality: -12.15, packaging: -12.15, dispatch: -12.15,
};

export function maintenanceServicePoint(stageId: StageId): MaintenancePoint {
  const [x, , z] = STAGE_POSITIONS[stageId];
  const [dx, dz] = SERVICE_OFFSETS[stageId];
  return [x + dx, z + dz];
}

export function maintenanceRoute(stageId: StageId): MaintenancePoint[] {
  const service = maintenanceServicePoint(stageId);
  const corridor = SERVICE_CORRIDORS[stageId];
  const route: MaintenancePoint[] = [[...MAINTENANCE_HOME], [MAINTENANCE_HOME[0], corridor], [service[0], corridor], service];
  return route.filter((point, index) => index === 0 || Math.hypot(point[0] - route[index - 1][0], point[1] - route[index - 1][1]) > 0.001);
}

export function maintenanceRouteLength(route: readonly MaintenancePoint[]): number {
  return route.slice(1).reduce((length, point, index) => length + Math.hypot(point[0] - route[index][0], point[1] - route[index][1]), 0);
}

export function sampleMaintenanceRoute(route: readonly MaintenancePoint[], distance: number) {
  let remaining = Math.max(0, distance);
  for (let index = 1; index < route.length; index++) {
    const from = route[index - 1], to = route[index];
    const dx = to[0] - from[0], dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    if (remaining <= length || index === route.length - 1) {
      const fraction = length > 0 && remaining < length - 0.000001 ? remaining / length : 1;
      return { position: fraction === 1 ? [...to] as MaintenancePoint : [from[0] + dx * fraction, from[1] + dz * fraction] as MaintenancePoint, heading: Math.atan2(dx, dz) };
    }
    remaining -= length;
  }
  return { position: [...MAINTENANCE_HOME] as MaintenancePoint, heading: 0 };
}

export interface MaintenanceMotion {
  phase: MaintenancePhase;
  stageId: StageId | null;
  route: MaintenancePoint[];
  distance: number;
  workingTime: number;
}

export function createMaintenanceMotion(): MaintenanceMotion {
  return { phase: "idle", stageId: null, route: [[...MAINTENANCE_HOME]], distance: 0, workingTime: 0 };
}

/** Only moves the illustrated technician. Never changes a sensor, fault or PLC. */
export function advanceMaintenanceMotion(state: MaintenanceMotion, targetStageId: StageId | null, delta: number, reducedMotion = false): MaintenanceMotion {
  if (reducedMotion) {
    if (!targetStageId) return createMaintenanceMotion();
    const route = maintenanceRoute(targetStageId);
    return { phase: "inspecting", stageId: targetStageId, route, distance: maintenanceRouteLength(route), workingTime: 0 };
  }
  const step = Math.max(0, Math.min(delta, 0.1));
  let next = state;
  if (state.phase === "idle") {
    if (!targetStageId) return state;
    next = { phase: "approaching", stageId: targetStageId, route: maintenanceRoute(targetStageId), distance: 0, workingTime: 0 };
  }
  // When the target changes, retrace the known safe route before taking another.
  if (next.stageId !== targetStageId && next.phase !== "returning") next = { ...next, phase: "returning", workingTime: 0 };
  if (next.phase === "returning") {
    const distance = Math.max(0, next.distance - step * MAINTENANCE_WALK_SPEED);
    return distance === 0 ? createMaintenanceMotion() : { ...next, distance };
  }
  if (next.phase === "approaching") {
    const length = maintenanceRouteLength(next.route);
    const distance = Math.min(length, next.distance + step * MAINTENANCE_WALK_SPEED);
    return { ...next, distance, phase: distance >= length ? "inspecting" : "approaching" };
  }
  return { ...next, workingTime: next.workingTime + step };
}
