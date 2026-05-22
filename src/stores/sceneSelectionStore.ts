import { create } from "zustand";
import type { StageId } from "../types/digitalTwin";

/**
 * Scene-selection state — which stage is currently "focused" in the 3D view.
 *
 * Kept as its own tiny store so both the 3D click path (ProcessPipeline3D)
 * and the 2D SensorHUD can push/pull the same selection without prop drilling.
 * A null value means "no focus, overview camera".
 */
interface SceneSelectionState {
  selectedStageId: StageId | null;
  select: (id: StageId) => void;
  toggle: (id: StageId) => void;
  clear: () => void;
}

export const useSceneSelectionStore = create<SceneSelectionState>((set) => ({
  selectedStageId: null,
  select: (id) => set({ selectedStageId: id }),
  toggle: (id) =>
    set((state) => ({
      selectedStageId: state.selectedStageId === id ? null : id,
    })),
  clear: () => set({ selectedStageId: null }),
}));
