/* eslint-disable react-refresh/only-export-components -- Shared clock hook drives machine and product animation together. */
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { advanceProcessClock, productAge, sampleProduct, stationPhase, PRODUCT_COUNT, STATION_WINDOWS, BOTTLE_SCALE, CASE, cartonPose } from "./productionCycle";
import { Html } from "@react-three/drei";
import type { StageId } from "../../types/digitalTwin";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import { Block } from "./industrialPrimitives";
import RawMaterialFeed from "./RawMaterialFeed";
import { readTwinAlarmState, summarizeTwinAlarm } from "./twinAlarmState";

const ClockContext = createContext({ current: { time: 0, alarm: summarizeTwinAlarm([]), reducedMotion: false } });
export function useLineClock() { return useContext(ClockContext); }
export function LineClock({ children }: { children: ReactNode }) {
  const clock = useRef({ time: 0, alarm: summarizeTwinAlarm([]), reducedMotion: false });
  const motionPreference = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)"), []);
  useFrame((_, delta) => {
    const s = useDigitalTwinStore.getState();
    clock.current.alarm = readTwinAlarmState();
    clock.current.reducedMotion = motionPreference.matches;
    clock.current.time = advanceProcessClock(clock.current.time, delta,
      s.simulationActive && !clock.current.reducedMotion,
      s.conveyorSpeedMultiplier, clock.current.alarm, s.userSpeedMultiplier);
  }, -2);
  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

function BottleUnit({ index }: { index: number }) {
  const clock = useLineClock();
  const product = useRef<THREE.Group>(null); const glass = useRef<THREE.Mesh>(null); const liquid = useRef<THREE.Mesh>(null); const cap = useRef<THREE.Mesh>(null); const carton = useRef<THREE.Group>(null); const bottle = useRef<THREE.Group>(null); const flaps = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    const profile = [[0, 0], [0.2, 0], [0.255, 0.04], [0.27, 0.15], [0.25, 0.35], [0.27, 0.55], [0.265, 0.84], [0.23, 0.96], [0.13, 1.08], [0.095, 1.14], [0.095, 1.24], [0.11, 1.26], [0.11, 1.28], [0.07, 1.28]];
    const final = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 24);
    const start = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(y > 1.1 ? r : r === 0 ? 0 : 0.07, 0.68 + y / 1.28 * 0.6)), 24);
    start.morphAttributes.position = [final.attributes.position];
    start.morphAttributes.normal = [final.attributes.normal];
    return start;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    if (!product.current || !glass.current || !liquid.current || !cap.current || !carton.current || !bottle.current) return;
    const age = productAge(clock.current.time, index);
    const pose = sampleProduct(age);
    const box = cartonPose(age);
    product.current.position.set(...pose.position);
    glass.current.visible = !pose.pellet && !pose.boxed;
    if (glass.current.morphTargetInfluences) glass.current.morphTargetInfluences[0] = pose.expansion;
    // The injection core grows a preform before it is transferred into the blow mold.
    glass.current.scale.y = age >= 6 && age < 10 ? Math.max(0.01, Math.min(1, (age - 6) / 3)) : 1;
    const material = glass.current.material as THREE.MeshPhysicalMaterial;
    material.color.set(pose.expansion < 1 ? "#eaba7e" : pose.cooled > 0.5 ? "#65bbd0" : "#81bbc5");
    liquid.current.visible = pose.fill > 0 && !pose.boxed;
    liquid.current.scale.y = Math.max(0.001, pose.fill);
    liquid.current.position.y = 0.045 + pose.fill * 0.48;
    cap.current.visible = pose.capped && !pose.boxed;
    bottle.current.visible = !pose.pellet;
    carton.current.visible = box.visible;
    carton.current.position.set(...box.position);
    flaps.current?.children.forEach((flap, i) => { flap.rotation.z = (i === 0 ? -1 : 1) * (0.3 + box.closed * (Math.PI - 0.3)); });
  });
  return <><group ref={product}><group ref={bottle} scale={BOTTLE_SCALE}>
    <mesh ref={glass} args={[geometry]} castShadow><meshPhysicalMaterial color="#81bbc5" metalness={0} roughness={0.12} clearcoat={0.8} clearcoatRoughness={0.15} transparent opacity={0.32} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <mesh ref={liquid}><cylinderGeometry args={[0.22, 0.225, 0.96, 24]} /><meshStandardMaterial color="#793611" roughness={0.18} transparent opacity={0.96} /></mesh>
    <mesh ref={cap} position={[0, 1.32, 0]} castShadow><cylinderGeometry args={[0.115, 0.115, 0.085, 16]} /><meshStandardMaterial color="#4c9fc1" roughness={0.45} /></mesh>
  </group></group>
    <group ref={carton}>
      <Block at={[0, CASE.floor / 2, 0]} size={[CASE.width, CASE.floor, CASE.depth]} color="#c6a478" metal={0} />
      {[-1, 1].map((sign) => <group key={sign}>
        <Block at={[sign * (CASE.width / 2 - 0.015), CASE.height / 2, 0]} size={[0.03, CASE.height, CASE.depth]} color="#c6a478" metal={0} />
        <Block at={[0, CASE.height / 2, sign * (CASE.depth / 2 - 0.015)]} size={[CASE.width, CASE.height, 0.03]} color="#c6a478" metal={0} />
      </group>)}
      <group ref={flaps}>{[-1, 1].map((sign) => <group key={sign} position={[sign * CASE.width / 2, CASE.height, 0]}>
        <Block at={[sign * CASE.width / 4, 0, 0]} size={[CASE.width / 2, 0.02, CASE.depth]} color="#d5b68e" metal={0} />
      </group>)}</group>
      <Block at={[0, 0.4, CASE.depth / 2 + 0.005]} size={[0.26, 0.19, 0.009]} color="#f6f0de" metal={0} />
    </group>
  </>;
}

export default function LineProcess() {
  return <><RawMaterialFeed />{Array.from({ length: PRODUCT_COUNT }, (_, i) => <BottleUnit key={i} index={i} />)}<ProcessReadout /></>;
}

/** A local readout makes the action legible at the selected machine without a sequence strip. */
export function ProcessReadout() {
  const clock = useLineClock();
  const selected = useSceneSelectionStore((s) => s.selectedStageId);
  const label = useRef<HTMLSpanElement>(null);
  useFrame(() => {
    if (!selected || !label.current) return;
    const phase = stationPhase(clock.current.time, selected as StageId);
    const [start, end] = STATION_WINDOWS[selected];
    const product = phase === null ? null : sampleProduct(start + phase * (end - start));
    const progress = product?.phase === "Liquid filling" ? product.fill : product?.phase === "Stretch & blow" ? product.expansion : product?.phase === "Cooling / conditioning" ? product.cooled : null;
    label.current.textContent = clock.current.alarm.lineStopped ? "Production paused · threshold interlock" : selected === "intake" ? "PET resin / metered feed" : product ? `${product.phase}${progress === null ? "" : ` · ${Math.round(progress * 100)}%`}` : "Waiting for next item";
  });
  if (!selected) return null;
  const [x, , z] = STAGE_POSITIONS[selected];
  return <Html position={[x, 0.15, z + 2.25]} center zIndexRange={[8, 1]}><div className="plant-process-readout"><i /><span ref={label}>Process simulation</span></div></Html>;
}
