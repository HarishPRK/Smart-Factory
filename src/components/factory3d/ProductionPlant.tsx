"use no memo";
// The twin mutates stage arrays in place; each subscribed tick must read a fresh snapshot.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";
import { useSceneSettingsStore } from "../../stores/sceneSettingsStore";
import type { StageId } from "../../types/digitalTwin";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import { LINE_PATHS } from "./productionCycle";
import LineProcess, { LineClock } from "./LineProcess";
import { STAGE_NAMES, TWIN_STATUS_COLORS } from "./twinPresentation";
import IndustrialMachine from "./IndustrialMachines";
import FactoryFloor from "./FactoryFloor";
import { Block, Cylinder, MACHINE_PAINT, METAL, Pallet, Pipe, type Point3 } from "./industrialPrimitives";
import { HallAlarmLight, MachineAlarmFeedback, MaintenanceDispatch } from "./TwinAlarmPresentation";
import { readTwinAlarmState } from "./twinAlarmState";

const STAGES: StageId[] = ["intake", "forming", "mixing", "curing", "quality", "packaging", "dispatch"];
const FOOTPRINTS: Record<StageId, [number, number]> = { intake: [7.5, 6], forming: [7.8, 4.8], mixing: [7.1, 7], curing: [7.6, 4.8], quality: [6.5, 4.5], packaging: [7.7, 6.5], dispatch: [7.3, 6.2] };
const LABEL_HEIGHT: Record<StageId, number> = { intake: 6.8, forming: 4.6, mixing: 5.8, curing: 4.3, quality: 4.3, packaging: 5, dispatch: 6.5 };

function FloorMark({ at, text, width = 8, muted = false }: { at: Point3; text: string; width?: number; muted?: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext("2d")!; ctx.font = "600 64px 'Inter', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = muted ? "#84989f" : "#657e76";
    ctx.fillText(text, 512, 64); const result = new THREE.CanvasTexture(canvas); result.colorSpace = THREE.SRGBColorSpace; return result;
  }, [text, muted]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={at} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[width, width / 8]} /><meshBasicMaterial map={texture} transparent depthWrite={false} /></mesh>;
}

function PlantBuilding() {
  const extras = useSceneSettingsStore((s) => s.extrasEnabled);
  const cctv = useSceneSettingsStore((s) => s.cctvEnabled);
  return <group>
    <FactoryFloor />
    {/* Cutaway hall: rear service wall, exposed columns and a continuous utility rack. */}
    <Block at={[0, 2.65, -14.25]} size={[46, 5.3, 0.35]} color="#adb3ae" metal={0} roughness={0.9} />
    <Block at={[0, 5.35, -14.15]} size={[46, 0.25, 0.75]} color={METAL.dark} />
    {[-20, -12, -4, 4, 12, 20].map((x) => <group key={x}>
      <Block at={[x, 2.85, -13.92]} size={[0.3, 5.7, 0.45]} color={METAL.dark} />
      {x < 20 && <><Block at={[x + 4, 3.7, -14.02]} size={[7, 1.6, 0.08]} color="#a5c3c9" metal={0.25} />
      <Block at={[x + 4, 3.7, -13.95]} size={[0.08, 1.6, 0.08]} color={METAL.edge} />
      <Block at={[x + 4, 3.7, -13.95]} size={[7, 0.065, 0.08]} color={METAL.edge} /></>}
    </group>)}
    {[-20, -10, 0, 10, 20].map((x) => <group key={x}>
      <Block at={[x, 2.45, -12.6]} size={[0.13, 4.9, 0.15]} color={METAL.steel} />
      <Block at={[x, 4.7, -12.15]} size={[0.14, 0.15, 1.15]} color={METAL.steel} />
    </group>)}
    {[0, 1, 2].map((i) => <Pipe key={i} points={[[-21, 4.85 + i * 0.19, -12.4 + i * 0.28], [20, 4.85 + i * 0.19, -12.4 + i * 0.28], [20, 0.5, -12.4 + i * 0.28]]} radius={0.085} color={i === 1 ? METAL.blue : METAL.steel} />)}
    {/* Clearly marked pedestrian aisle and crosswalks. */}
    {[-21.1, -18.6].map((x) => <Block key={x} at={[x, 0.06, 0]} size={[0.055, 0.015, 27.5]} color="#d9b566" metal={0} />)}
    {Array.from({ length: 10 }, (_, i) => <Block key={i} at={[-19.85, 0.07, -1.4 + i * 0.34]} size={[2.45, 0.01, 0.16]} color="#cdd4c7" metal={0} />)}
    {[-18, 18].map((x) => <group key={x}>
      <Block at={[x, 1.1, -13.35]} size={[1.1, 2.15, 0.7]} color={METAL.shell} round />
      {[0, 1, 2, 3, 4].map((i) => <Block key={i} at={[x, 0.5 + i * 0.16, -12.98]} size={[0.7, 0.045, 0.02]} color={METAL.dark} />)}
    </group>)}
    {extras && <><Pallet at={[-16.8, 0.08, -10]} /><Pallet at={[-16.8, 0.08, -7]} /><Pallet at={[-16.8, 0.08, -4]} loaded={false} /></>}
    {cctv && [-18, 18].map((x) => <group key={x}><Pipe points={[[x, 5.5, -14], [x, 5.5, -12.6]]} /><Block at={[x, 5.5, -12.5]} size={[0.35, 0.3, 0.65]} color={METAL.shell} round /><Cylinder at={[x, 5.5, -12.13]} radius={0.1} height={0.09} color={METAL.dark} rotation={[Math.PI / 2, 0, 0]} /></group>)}
  </group>;
}

function ConveyorSection({ curve, caseInfeed = false }: { curve: THREE.CatmullRomCurve3; caseInfeed?: boolean }) {
  const rollers = useRef<THREE.InstancedMesh>(null);
  const length = useMemo(() => curve.getLength(), [curve]);
  const count = Math.ceil(length / 0.26);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rails = useMemo(() => [-0.62, 0.62].flatMap((side) => {
    const sections: Point3[][] = []; let points: Point3[] = [];
    for (let i = 0; i <= 150; i++) {
      const p = curve.getPointAt(i / 150); const t = curve.getTangentAt(i / 150);
      // The side-fed empty carton needs a real opening in the rear guide rail.
      if (caseInfeed && side < 0 && p.x > 5.5 && p.x < 6.7) { if (points.length > 1) sections.push(points); points = []; }
      else points.push([p.x - t.z * side, 1.5, p.z + t.x * side]);
    }
    if (points.length > 1) sections.push(points);
    return sections;
  }), [curve, caseInfeed]);
  const supports = useMemo(() => Array.from({ length: Math.ceil(length / 2.5) + 1 }, (_, i) => i), [length]);
  useLayoutEffect(() => {
    const mesh = rollers.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++) {
      const p = curve.getPointAt(i / (count - 1)); const t = curve.getTangentAt(i / (count - 1));
      dummy.position.copy(p); dummy.rotation.set(0, Math.atan2(t.x, t.z), 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // Instance transforms do not invalidate Three's cached culling bounds.
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [count, curve, dummy]);
  return <group>
    <instancedMesh ref={rollers} args={[undefined, undefined, count]} castShadow receiveShadow><boxGeometry args={[1.12, 0.12, 0.215]} /><meshStandardMaterial color="#879397" metalness={0.72} roughness={0.5} /></instancedMesh>
    {rails.map((points, i) => <Pipe key={i} points={points} radius={0.045} color="#bdcbcd" />)}
    {supports.map((_, i) => { const p = curve.getPointAt(i / (supports.length - 1)); const t = curve.getTangentAt(i / (supports.length - 1)); return <group key={i} position={[p.x, 0, p.z]} rotation={[0, Math.atan2(t.x, t.z), 0]}>
      {[-0.5, 0.5].map((x) => <group key={x}><Block at={[x, 0.57, 0]} size={[0.08, 1.14, 0.1]} color={METAL.steel} /><Block at={[x, 0.08, 0]} size={[0.23, 0.1, 0.3]} color={METAL.dark} /></group>)}
      <Block at={[0, 0.92, 0]} size={[1.2, 0.12, 0.12]} color={METAL.steel} />
    </group>; })}
  </group>;
}

function ProductionCell({ id, index }: { id: StageId; index: number }) {
  const [x, , z] = STAGE_POSITIONS[id];
  const status = useDigitalTwinStore((s) => s.stages.find((stage) => stage.id === id)?.status ?? "idle");
  useDigitalTwinStore((s) => s.tick);
  const response = readTwinAlarmState();
  const alarm = response.stageAlarms[id];
  const selected = useSceneSelectionStore((s) => s.selectedStageId === id);
  const hasSelection = useSceneSelectionStore((s) => s.selectedStageId !== null);
  const select = useSceneSelectionStore((s) => s.select);
  const labels = useSceneSettingsStore((s) => s.labelsVisible);
  const [w, d] = FOOTPRINTS[id];
  const color = alarm?.severity === "critical" ? "#ff837a" : alarm?.severity === "warning" || response.lineStopped ? "#ffca78" : TWIN_STATUS_COLORS[status];
  const stateLabel = alarm?.stopRequired ? "Fault · line stopped" : alarm?.severity === "critical" ? "Critical reading" : response.lineStopped ? "Paused · line interlock" : alarm?.severity === "warning" ? "Warning" : status;
  useEffect(() => () => { document.body.style.cursor = ""; }, []);
  return <group position={[x, 0.08, z]}>
    <Block at={[0, 0, -0.5]} size={[w, 0.055, d]} color={selected ? "#435b63" : "#374347"} metal={0} roughness={1} environmentIntensity={0} />
    <Block at={[0, 0.037, d / 2 - 0.52]} size={[w - 0.15, 0.018, 0.15]} color={MACHINE_PAINT[id]} metal={0} roughness={0.95} environmentIntensity={0} />
    {[-1, 1].map((s) => <group key={s}><Block at={[0, 0.035, s * d / 2 - 0.5]} size={[w, 0.018, 0.045]} color={selected ? "#72d1f4" : "#b6a476"} metal={0} /><Block at={[s * w / 2, 0.035, -0.5]} size={[0.045, 0.018, d]} color={selected ? "#72d1f4" : "#b6a476"} metal={0} /></group>)}
    <group onClick={(e) => { e.stopPropagation(); select(id); }} onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
      <MachineAlarmFeedback stageId={id} footprint={[w, d]}><IndustrialMachine stageId={id} /></MachineAlarmFeedback>
    </group>
    <FloorMark at={[-w / 2 + 0.55, 0.065, d / 2 - 0.9]} text={String(index + 1).padStart(2, "0")} width={0.6} />
    {labels && (!hasSelection || selected) && <Html position={[0, LABEL_HEIGHT[id], -0.5]} center zIndexRange={[8, 1]}><button className={`plant-label${selected ? " is-selected" : ""}`} data-alarm={alarm?.severity ?? "normal"} aria-label={`${STAGE_NAMES[id]} · ${stateLabel}. Inspect machine`} onClick={() => select(id)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{STAGE_NAMES[id]}</strong><i style={{ background: color }} /></button></Html>}
  </group>;
}

export default function ProductionPlant() {
  return <LineClock><group><PlantBuilding />{LINE_PATHS.map((curve, i) => <ConveyorSection key={i} curve={curve} caseInfeed={i === 4} />)}{STAGES.map((id, index) => <ProductionCell key={id} id={id} index={index} />)}<LineProcess /><HallAlarmLight /><MaintenanceDispatch /></group></LineClock>;
}
