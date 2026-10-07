import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import {
  BrightnessContrast,
  EffectComposer,
  Bloom,
  HueSaturation,
  SMAA,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { useSceneSettingsStore } from "../../stores/sceneSettingsStore";

export default function PostFxStack() {
  const postFxQuality = useSceneSettingsStore((s) => s.postFxQuality);
  const get = useThree((s) => s.get);

  useEffect(() => {
    if (postFxQuality === "off") return;
    const gl = get().gl;
    const prev = gl.toneMapping;
    gl.toneMapping = THREE.NoToneMapping;
    return () => {
      gl.toneMapping = prev;
    };
  }, [get, postFxQuality]);

  if (postFxQuality === "off") return null;

  const bloomIntensity =
    postFxQuality === "ultra" ? 0.35 : postFxQuality === "high" ? 0.25 : 0.12;
  const bloomThreshold =
    0.85;
  const vignetteDarkness =
    0.12;
  const enableGrading =
    postFxQuality === "ultra" || postFxQuality === "high";

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.35}
        mipmapBlur
        radius={0.8}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {enableGrading ? (
        <BrightnessContrast
          brightness={0.015}
          contrast={postFxQuality === "ultra" ? 0.06 : 0.04}
        />
      ) : (
        <></>
      )}
      {enableGrading ? (
        <HueSaturation
          hue={0}
          saturation={postFxQuality === "ultra" ? 0.08 : 0.04}
        />
      ) : (
        <></>
      )}
      <Vignette offset={0.2} darkness={vignetteDarkness} />
      <SMAA />
    </EffectComposer>
  );
}
