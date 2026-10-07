import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import CameraController, { OVERVIEW_POSITION, OVERVIEW_TARGET, resetCameraView, setCameraTarget, setOverviewAspect } from "./CameraController";
import ProductionPlant from "./ProductionPlant";
import StudioEffects from "./StudioEffects";
import TwinWorkbench from "./TwinWorkbench";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";
import { useSceneSettingsStore } from "../../stores/sceneSettingsStore";
import { usePLCStore } from "../../stores/plcStore";

function SceneCamera() {
  const size = useThree((s) => s.size);
  const selected = useSceneSelectionStore((s) => s.selectedStageId);
  useEffect(() => {
    setOverviewAspect(size.width / Math.max(1, size.height));
    if (!selected) { resetCameraView(); return; }
    const [x, , z] = STAGE_POSITIONS[selected];
    const height = selected === "intake" ? 3 : 2;
    const distance = selected === "intake" ? 15 : 10;
    const narrow = size.width < 600;
    // Three-quarter inspection retains depth and reserves the inspector edge.
    setCameraTarget([x - (narrow ? 4 : 5), height + 5, z + distance], [x, height, z - 0.2]);
  }, [selected, size.width, size.height]);
  return <CameraController />;
}

function EmergencySignal() {
  const active = usePLCStore((s) => s.emergencyLightOn);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => { if (light.current) light.current.intensity = active ? 8 + Math.sin(clock.elapsedTime * 6) * 4 : 0; });
  return <pointLight ref={light} position={[0, 6, 1]} distance={30} color="#f26458" intensity={0} />;
}

function Studio() {
  return <>
    <color attach="background" args={["#162a35"]} />
    <ambientLight intensity={0.45} />
    <hemisphereLight args={["#dcf3ff", "#253c4b", 0.9]} />
    <directionalLight position={[-12, 28, 18]} intensity={2.5} color="#fff7ed" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-camera-far={100} shadow-normalBias={0.04} shadow-bias={-0.0001} />
    <directionalLight position={[18, 15, -16]} intensity={1.1} color="#94d9f0" />
    <Environment resolution={128} frames={1} environmentIntensity={0.65}>
      <Lightformer form="rect" intensity={3} position={[0, 18, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 18, 1]} />
      <Lightformer form="rect" intensity={2} position={[-22, 7, 0]} rotation={[0, Math.PI / 2, 0]} scale={[20, 12, 1]} />
      <Lightformer form="rect" intensity={1.5} color="#b4dcef" position={[22, 10, -3]} rotation={[0, -Math.PI / 2, 0]} scale={[20, 10, 1]} />
    </Environment>
  </>;
}

export default function FactoryScene({ paused = false, inspectorHost = null }: { paused?: boolean; inspectorHost?: HTMLElement | null }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const quality = useSceneSettingsStore((s) => s.quality);
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try { if (!document.fullscreenElement) await containerRef.current.requestFullscreen(); else await document.exitFullscreen(); }
    catch (error) { console.error("Unable to change fullscreen view", error); }
  }, []);
  useEffect(() => {
    const changed = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    const keys = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))) return;
      if (e.key === "Escape") useSceneSelectionStore.getState().clear();
      if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey) void toggleFullscreen();
    };
    document.addEventListener("fullscreenchange", changed); window.addEventListener("keydown", keys);
    return () => { document.removeEventListener("fullscreenchange", changed); window.removeEventListener("keydown", keys); };
  }, [toggleFullscreen]);
  return <div ref={containerRef} className="twin-workbench">
    <div className="twin-canvas"><Canvas shadows={quality !== "low"} frameloop={paused ? "never" : "always"} dpr={quality === "ultra" ? [1, 1.75] : quality === "high" ? [1, 1.5] : quality === "low" ? 1 : [1, 1.25]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      camera={{ position: OVERVIEW_POSITION, fov: 40, near: 0.1, far: 200 }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 0.88; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
      <Studio />
      <OrbitControls makeDefault target={OVERVIEW_TARGET} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.1} minPolarAngle={0.08} minDistance={6} maxDistance={125} rotateSpeed={0.65} />
      <SceneCamera /><ProductionPlant /><EmergencySignal /><StudioEffects />
    </Canvas></div>
    <TwinWorkbench isFullscreen={isFullscreen} onFullscreen={toggleFullscreen} inspectorHost={isFullscreen ? null : inspectorHost} />
  </div>;
}
