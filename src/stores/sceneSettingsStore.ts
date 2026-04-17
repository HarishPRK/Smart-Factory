/**
 * Scene-level display toggles for the 3D factory floor.
 *
 * These are independent from the digital-twin simulation — they only affect
 * what's rendered. 3D components subscribe with narrow selectors so the store
 * change doesn't rebroadcast across the tree.
 */
import { create } from "zustand";

export type QualityTier = "ultra" | "high" | "medium" | "low";
export type PostFxQuality = "ultra" | "high" | "med" | "off";

const QUALITY_TO_POSTFX: Record<QualityTier, PostFxQuality> = {
  ultra: "ultra",
  high: "high",
  medium: "med",
  low: "off",
};

export interface SceneSettingsStore {
  particlesEnabled: boolean;
  extrasEnabled: boolean;
  cctvEnabled: boolean;
  labelsVisible: boolean;
  quality: QualityTier;
  postFxQuality: PostFxQuality;

  setParticles: (v: boolean) => void;
  setExtras: (v: boolean) => void;
  setCCTV: (v: boolean) => void;
  setLabels: (v: boolean) => void;
  setQuality: (q: QualityTier) => void;
  setPostFxQuality: (q: PostFxQuality) => void;
}

export const useSceneSettingsStore = create<SceneSettingsStore>((set) => ({
  particlesEnabled: true,
  extrasEnabled: true,
  cctvEnabled: true,
  labelsVisible: true,
  quality: "high",
  postFxQuality: QUALITY_TO_POSTFX.high,

  setParticles: (v) => set({ particlesEnabled: v }),
  setExtras: (v) => set({ extrasEnabled: v }),
  setCCTV: (v) => set({ cctvEnabled: v }),
  setLabels: (v) => set({ labelsVisible: v }),
  setQuality: (q) => set({ quality: q, postFxQuality: QUALITY_TO_POSTFX[q] }),
  setPostFxQuality: (q) => set({ postFxQuality: q }),
}));
