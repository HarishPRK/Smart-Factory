import { useEffect, useMemo } from "react";
import { Environment, Html, Lightformer, Line } from "@react-three/drei";
import * as THREE from "three";
import { useSceneSettingsStore } from "../../stores/sceneSettingsStore";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";
import { useDigitalTwinData } from "../../hooks/useDigitalTwinData";
import { CONVEYOR_PATH } from "./factoryLayout";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import { STAGE_NAMES, TWIN_STATUS_COLORS } from "./twinPresentation";

/** A locally generated light rig: metal has reflections even when offline. */
export function FactoryStudioLighting() {
  return <Environment resolution={128} frames={1} environmentIntensity={0.65}>
    <Lightformer form="rect" intensity={3} position={[0, 15, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 20, 1]} />
    <Lightformer form="rect" intensity={2} color="#c8dfed" position={[-20, 8, 0]} rotation={[0, Math.PI / 2, 0]} scale={[16, 12, 1]} />
    <Lightformer form="rect" intensity={1.5} color="#f6ead7" position={[18, 6, 5]} rotation={[0, -Math.PI / 2, 0]} scale={[18, 8, 1]} />
  </Environment>;
}

function FloorLettering() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048; canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 2048, 256);
    ctx.font = "500 76px sans-serif";
    ctx.fillStyle = "#61757b";
    ctx.fillText("PRODUCTION  /  PET BOTTLING", 24, 105);
    ctx.font = "32px monospace";
    ctx.fillStyle = "#74888b";
    ctx.fillText("MATERIAL INTAKE  →  PROCESSING  →  DISPATCH", 26, 170);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    return result;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-5, 0.015, 12]}>
    <planeGeometry args={[18, 2.25]} /><meshBasicMaterial map={texture} transparent depthWrite={false} />
  </mesh>;
}

/** Architectural base aligned to the existing machine and conveyor coordinates. */
export default function FactoryStage() {
  const guide = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(CONVEYOR_PATH.map(([x, , z]) => new THREE.Vector3(x, 0.025, z)), false, "catmullrom", 0.3);
    return curve.getPoints(150);
  }, []);

  return <group>
    <mesh receiveShadow position={[0, -0.42, 0]}><boxGeometry args={[46, 0.8, 30]} /><meshStandardMaterial color="#74888e" metalness={0.28} roughness={0.65} /></mesh>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}><planeGeometry args={[45.8, 29.8]} /><meshStandardMaterial color="#809a9c" metalness={0.1} roughness={0.82} /></mesh>
    {/* Inlaid work cells and expansion joints make the scale legible. */}
    {[8, 0, -8].map((z, row) => <group key={z}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, z]}><planeGeometry args={[39, 5.6]} /><meshStandardMaterial color={row === 1 ? "#708d90" : "#789496"} roughness={0.8} /></mesh>
      {[-2.9, 2.9].map((offset) => <mesh key={offset} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, z + offset]}><planeGeometry args={[39, 0.035]} /><meshBasicMaterial color="#70898d" /></mesh>)}
    </group>)}
    {Array.from({ length: 23 }, (_, i) => i * 2 - 22).map((x) => <mesh key={`x${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 0]}><planeGeometry args={[0.012, 29.8]} /><meshBasicMaterial color="#7f979c" transparent opacity={0.38} /></mesh>)}
    {Array.from({ length: 15 }, (_, i) => i * 2 - 14).map((z) => <mesh key={`z${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, z]}><planeGeometry args={[45.8, 0.012]} /><meshBasicMaterial color="#7f979c" transparent opacity={0.38} /></mesh>)}
    <Line points={guide} color="#4b9e97" lineWidth={8} transparent opacity={0.18} />
    {/* Low edge channels frame the model without obscuring equipment. */}
    {[-14.7, 14.7].map((z) => <group key={z}>
      <mesh position={[0, 0.06, z]}><boxGeometry args={[45.8, 0.12, 0.12]} /><meshStandardMaterial color="#527b7e" metalness={0.5} roughness={0.4} /></mesh>
      {Array.from({ length: 12 }, (_, i) => i * 3.8 - 21).map((x) => <mesh key={x} position={[x, 0.04, z - Math.sign(z) * 0.25]}><boxGeometry args={[1.7, 0.03, 0.08]} /><meshBasicMaterial color="#e4d4a1" /></mesh>)}
    </group>)}
    <FloorLettering />
  </group>;
}

export function FactoryStageLabels() {
  const visible = useSceneSettingsStore((s) => s.labelsVisible);
  const selected = useSceneSelectionStore((s) => s.selectedStageId);
  const select = useSceneSelectionStore((s) => s.select);
  const { stages } = useDigitalTwinData();
  if (!visible) return null;
  return <group>{stages.map((stage, index) => {
    if (selected && selected !== stage.id) return null;
    const [x, , z] = STAGE_POSITIONS[stage.id];
    // Stagger the rear row so labels remain distinct in the overview projection.
    const y = stage.id === "intake" ? 6.5 : stage.id === "dispatch" ? 7 : 4.1;
    return <group key={stage.id}>
      <Line points={[[x, 0.1, z], [x, y - 0.25, z]]} color="#567579" lineWidth={1} transparent opacity={0.45} />
      <Html position={[x, y, z]} center zIndexRange={[8, 1]}>
        <button className={`twin-stage-label${selected === stage.id ? " is-selected" : ""}`} onClick={(event) => { event.stopPropagation(); select(stage.id); }}>
          <span>{String(index + 1).padStart(2, "0")}</span>{STAGE_NAMES[stage.id]}<i style={{ background: TWIN_STATUS_COLORS[stage.status] }} />
        </button>
      </Html>
    </group>;
  })}</group>;
}
