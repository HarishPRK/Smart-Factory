import { EffectComposer, N8AO, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useSceneSettingsStore } from "../../stores/sceneSettingsStore";

/** Contact depth for detailed inspection; balanced mode preserves the motion budget. */
export default function StudioEffects() {
  const quality = useSceneSettingsStore((s) => s.quality);
  if (quality !== "high" && quality !== "ultra") return null;
  return <EffectComposer multisampling={0}>
    <N8AO aoRadius={0.65} intensity={1.05} distanceFalloff={0.8} quality={quality === "ultra" ? "high" : "low"} halfRes={quality !== "ultra"} color="#142c3d" />
    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    <SMAA />
  </EffectComposer>;
}
