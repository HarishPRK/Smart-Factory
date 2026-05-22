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
  // `extras` + `particles` + `cctv` toggles govern background eye-candy that
  // each run their own useFrame loops (wind socks, anemometers, QR beams,
  // forklift animations, flag waves, steam particles, CCTV camera rotation,
  // etc.). They're off by default so the factory-floor scene has maximum
  // frame-budget headroom for live MQTT traffic. Users can turn any of them
  // back on from the scene-settings toggles (FunControls, lower-left of the
  // 3D canvas) once their hardware has spare capacity.
  particlesEnabled: false,
  extrasEnabled: false,
  cctvEnabled: false,
  labelsVisible: true,
  // Default quality lowered from "high" → "medium" so the post-processing
  // stack (Bloom + ToneMapping + BrightnessContrast + HueSaturation + Vignette
  // + SMAA) runs in its lighter configuration. The "high" preset was eating
  // ~20 ms of every animation frame on mid-range laptops, which pushed the
  // whole dashboard past the 33 ms frame budget and starved MQTT/UI updates.
  // Users can still switch back to "high"/"ultra" from the settings toggle.
  quality: "medium",
  postFxQuality: QUALITY_TO_POSTFX.medium,

  setParticles: (v) => set({ particlesEnabled: v }),
  setExtras: (v) => set({ extrasEnabled: v }),
  setCCTV: (v) => set({ cctvEnabled: v }),
  setLabels: (v) => set({ labelsVisible: v }),
  setQuality: (q) => set({ quality: q, postFxQuality: QUALITY_TO_POSTFX[q] }),
  setPostFxQuality: (q) => set({ postFxQuality: q }),
}));
