"use no memo";
import { useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { StageId } from "../../types/digitalTwin";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import { Block, Cylinder } from "./industrialPrimitives";
import { advanceMaintenanceMotion, createMaintenanceMotion, sampleMaintenanceRoute } from "./maintenanceResponseMotion";

function Limb({ length, sleeve = false }: { length: number; sleeve?: boolean }) {
  return <mesh position={[0, -length / 2, 0]} castShadow>
    <capsuleGeometry args={[sleeve ? 0.09 : 0.075, length - 0.15, 4, 8]} />
    <meshStandardMaterial color={sleeve ? "#dca347" : "#334650"} roughness={0.95} metalness={0} />
  </mesh>;
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReducedMotion(query.matches);
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  return reducedMotion;
}

/** Illustrative response only: a technician checks outside the guarded cell. */
export default function MaintenanceResponse({ targetStageId, reducedMotion: motionPreference, hazardActive = false }: { targetStageId: StageId | null; reducedMotion?: boolean; hazardActive?: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = motionPreference ?? prefersReducedMotion;
  const motion = useRef(createMaintenanceMotion());
  const worker = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const legs = useRef<THREE.Group>(null);
  const lowerLegs = useRef<(THREE.Group | null)[]>([]);
  const arms = useRef<THREE.Group>(null);
  const forearms = useRef<(THREE.Group | null)[]>([]);
  const bag = useRef<THREE.Group>(null);
  const label = useRef<HTMLDivElement>(null);
  const posture = useRef(0);

  useFrame((_, delta) => {
    const step = Math.max(0, Math.min(delta, 0.1));
    motion.current = advanceMaintenanceMotion(motion.current, targetStageId, step, reducedMotion);
    const state = motion.current;
    const visible = state.phase !== "idle";
    if (worker.current) worker.current.visible = visible;
    if (label.current) label.current.style.visibility = visible ? "visible" : "hidden";
    if (!visible || !worker.current) return;
    const { position, heading } = sampleMaintenanceRoute(state.route, state.distance);
    worker.current.position.set(position[0], 0.06, position[1]);
    const inspecting = state.phase === "inspecting";
    const stage = state.stageId ? STAGE_POSITIONS[state.stageId] : null;
    const facing = inspecting && stage ? Math.atan2(stage[0] - position[0], stage[2] - position[1]) : heading + (state.phase === "returning" ? Math.PI : 0);
    const rotationDifference = Math.atan2(Math.sin(facing - worker.current.rotation.y), Math.cos(facing - worker.current.rotation.y));
    worker.current.rotation.y += rotationDifference * (reducedMotion ? 1 : 1 - Math.exp(-step * 9));
    const servicePosture = inspecting && !hazardActive ? 1 : 0;
    posture.current = reducedMotion ? servicePosture : THREE.MathUtils.damp(posture.current, servicePosture, 5, step);
    const crouch = posture.current;
    const walking = !inspecting && !reducedMotion;
    const gait = walking ? Math.sin(state.distance * 4.5) * 0.45 * (1 - crouch) : 0;
    const check = !reducedMotion && inspecting && !hazardActive ? Math.sin(state.workingTime * 1.3) * 0.055 : 0;
    if (hips.current) hips.current.position.y = 0.905 - crouch * 0.173 - (walking ? 0.84 * (1 - Math.cos(gait)) : 0);
    if (torso.current) torso.current.rotation.x = 0.22 * crouch;
    legs.current?.children.forEach((limb, index) => { limb.rotation.x = (index === 0 ? gait : -gait) - crouch * 0.8; });
    lowerLegs.current.forEach((limb) => { if (limb) limb.rotation.x = crouch * 1.25; });
    arms.current?.children.forEach((limb, index) => { limb.rotation.x = (index === 0 ? -gait : gait) - crouch * (index === 0 ? 0.55 : 0.75) - (inspecting && hazardActive && index === 0 ? 0.75 : 0); });
    forearms.current.forEach((limb, index) => { if (limb) limb.rotation.x = -crouch * (index === 0 ? 0.6 : 0.75) + (index === 1 ? check : 0) - (inspecting && hazardActive && index === 0 ? 0.95 : 0); });
    if (bag.current) bag.current.position.set(-0.43, inspecting ? 0.01 : 0.67, inspecting ? 0.05 : 0.04);
    if (label.current) label.current.textContent = `Simulated maintenance · ${inspecting ? hazardActive ? "Awaiting safety assessment" : "Checking exterior panel" : state.phase === "returning" ? "Returning to aisle" : "Approaching station"}`;
  });

  return <group ref={worker} visible={false}>
    <group ref={hips} position={[0, 0.905, 0]}>
      <Block at={[0, 0, 0]} size={[0.32, 0.17, 0.24]} color="#334650" metal={0} roughness={0.95} round />
      <group ref={legs}>
        {[-1, 1].map((side, index) => <group key={side} position={[side * 0.105, -0.015, 0]}>
          <Limb length={0.44} />
          <group ref={(group) => { lowerLegs.current[index] = group; }} position={[0, -0.44, 0]}>
            <Limb length={0.4} />
            <Block at={[0, -0.4, 0.06]} size={[0.17, 0.13, 0.3]} color="#222a2d" metal={0} roughness={1} round />
          </group>
        </group>)}
      </group>
      <group ref={torso} position={[0, 0.1, 0]}>
        <Block at={[0, 0.23, 0]} size={[0.43, 0.48, 0.28]} color="#dca347" metal={0} roughness={0.9} round />
        <Block at={[0, 0.08, 0.149]} size={[0.42, 0.06, 0.02]} color="#ccd3ce" metal={0.3} roughness={0.8} />
        {[-1, 1].map((side) => <Block key={side} at={[side * 0.13, 0.3, 0.149]} size={[0.045, 0.27, 0.02]} color="#ccd3ce" metal={0.3} roughness={0.8} />)}
        <Cylinder at={[0, 0.515, 0]} radius={0.055} height={0.1} color="#b78e73" metal={0} />
        <mesh position={[0, 0.66, 0]} castShadow><sphereGeometry args={[0.135, 12, 10]} /><meshStandardMaterial color="#b78e73" roughness={0.95} /></mesh>
        <mesh position={[0, 0.72, 0]} castShadow><sphereGeometry args={[0.155, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#ecd069" roughness={0.82} /></mesh>
        <Cylinder at={[0, 0.724, 0.018]} radius={0.185} height={0.035} color="#ecd069" metal={0} />
        <Block at={[0, 0.668, 0.12]} size={[0.225, 0.05, 0.05]} color="#476472" opacity={0.65} metal={0} />
        <group ref={arms} position={[0, 0.39, 0]}>
          {[-1, 1].map((side, index) => <group key={side} position={[side * 0.265, 0, 0]}>
            <Limb length={0.29} sleeve />
            <group ref={(group) => { forearms.current[index] = group; }} position={[0, -0.29, 0]}>
              <Limb length={0.27} />
              <mesh position={[0, -0.29, 0]}><sphereGeometry args={[0.078, 8, 8]} /><meshStandardMaterial color="#59666a" roughness={1} /></mesh>
              {side === 1 && !hazardActive && <group position={[0, -0.33, 0.025]}><Cylinder at={[0, -0.07, 0]} radius={0.025} height={0.2} color="#bbc8c8" metal={0.75} /><Block at={[0, -0.165, 0]} size={[0.11, 0.045, 0.025]} color="#bbc8c8" metal={0.75} /></group>}
              {side === -1 && <group position={[0, -0.28, 0.09]} rotation={[0.32, 0, 0]}><Block at={[0, 0, 0]} size={[0.2, 0.29, 0.045]} color="#293b43" metal={0} round /><Block at={[0, 0, 0.026]} size={[0.15, 0.21, 0.01]} color="#65a8af" metal={0} /></group>}
            </group>
          </group>)}
        </group>
      </group>
    </group>
    <group ref={bag} position={[-0.43, 0.67, 0.04]}><Block at={[0, 0.1, 0]} size={[0.32, 0.23, 0.2]} color="#5f4b35" metal={0} roughness={1} round /><Cylinder at={[0, 0.26, 0]} radius={0.019} height={0.2} color="#d0b08c" rotation={[0, 0, Math.PI / 2]} metal={0} /></group>
    <Html position={[0, 2.2, 0]} center zIndexRange={[7, 1]} style={{ pointerEvents: "none" }}>
      <div ref={label} className="maintenance-response-label" style={{ visibility: "hidden" }}>Simulated maintenance</div>
    </Html>
  </group>;
}
