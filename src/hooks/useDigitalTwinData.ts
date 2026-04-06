/**
 * useDigitalTwinData — For 2D UI panels only
 *
 * Subscribes to `tick` (bumped every 500ms) and reads everything
 * else via getState(). This gives the panel a consistent snapshot
 * while limiting React re-renders to 2 Hz.
 *
 * 3D components should NOT use this hook — they read getState()
 * inside useFrame for zero-overhead access.
 */
import { useDigitalTwinStore } from "../stores/digitalTwinStore";
import type { ManufacturingStage, ProductOnBelt, StageId } from "../types/digitalTwin";

export interface DigitalTwinData {
  stages: ManufacturingStage[];
  products: ProductOnBelt[];
  conveyorSpeedMultiplier: number;
  simulationActive: boolean;
  activeScenario: string | null;
  totalProduced: number;
  totalRejected: number;
  throughputPerMin: number;
  getStage: (id: StageId) => ManufacturingStage | undefined;
  getSensorHistory: (sensorId: string) => number[];
}

export function useDigitalTwinData(): DigitalTwinData {
  // Subscribe to tick — triggers re-render at 2 Hz
  useDigitalTwinStore((s) => s.tick);

  // Read everything else from snapshot (no subscription overhead)
  const state = useDigitalTwinStore.getState();

  return {
    stages: state.stages,
    products: state.products,
    conveyorSpeedMultiplier: state.conveyorSpeedMultiplier,
    simulationActive: state.simulationActive,
    activeScenario: state.activeScenario,
    totalProduced: state.totalProduced,
    totalRejected: state.totalRejected,
    throughputPerMin: state.throughputPerMin,
    getStage: (id: StageId) => state.stages.find((s) => s.id === id),
    getSensorHistory: (sensorId: string) => state.sensorHistories[sensorId] ?? [],
  };
}
