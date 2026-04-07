"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { STAGE_POSITIONS } from "./digitalTwinLayout";

/**
 * FactoryShowpiece3D — WOW-factor features that make visitors say "whoa"
 *
 * 1. AI Orb — glowing sphere that orbits the factory, trailing particles
 * 2. Data Streams — flowing light particles from IoT tower to each machine
 * 3. Helipad + Helicopter with spinning rotor
 * 4. Giant LED Scoreboard with live KPIs
 * 5. Welding robot with spark shower at maintenance bay
 * 6. Holographic miniature factory on a table
 */

const DATA_PARTICLE_COUNT = 40;
const SPARK_COUNT = 20;
const TRAIL_COUNT = 25;

const FactoryShowpiece3D: React.FC = () => {
  // AI Orb
  const orbRef = useRef<THREE.Group>(null);
  const orbGlowRef = useRef<THREE.Mesh>(null);
  const orbRingRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);

  // Data streams
  const dataRef = useRef<THREE.InstancedMesh>(null);

  // Helicopter
  const heliRef = useRef<THREE.Group>(null);
  const mainRotorRef = useRef<THREE.Group>(null);
  const tailRotorRef = useRef<THREE.Group>(null);

  // Welding
  const weldSparkRef = useRef<THREE.InstancedMesh>(null);
  const weldArmRef = useRef<THREE.Group>(null);

  // Scoreboard
  const scoreRefs = useRef<{ produced: HTMLDivElement | null; rate: HTMLDivElement | null; uptime: HTMLDivElement | null; quality: HTMLDivElement | null }>({ produced: null, rate: null, uptime: null, quality: null });
  const lastScoreUpdate = useRef(0);

  // Holo table
  const holoRotRef = useRef<THREE.Group>(null);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  const IOT_POS: [number, number, number] = [10, 4.5, 6];

  // Data stream targets (each machine)
  const dataTargets = useMemo(() => Object.values(STAGE_POSITIONS), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const now = performance.now();

    // ═══ 1. AI ORB — orbits factory, pulsing, trailing particles ═══
    if (orbRef.current) {
      const orbX = Math.cos(t * 0.2) * 12;
      const orbZ = Math.sin(t * 0.2) * 8;
      const orbY = 3.5 + Math.sin(t * 0.5) * 0.5;
      orbRef.current.position.set(orbX, orbY, orbZ);
    }
    if (orbGlowRef.current) {
      const mat = orbGlowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.4;
      const s = 1 + Math.sin(t * 3) * 0.1;
      orbGlowRef.current.scale.set(s, s, s);
    }
    if (orbRingRef.current) {
      orbRingRef.current.rotation.x = t * 1.5;
      orbRingRef.current.rotation.z = t * 0.8;
    }
    // Trail particles behind orb
    if (trailRef.current && orbRef.current) {
      for (let i = 0; i < TRAIL_COUNT; i++) {
        const age = i / TRAIL_COUNT;
        const pastT = t - age * 0.8;
        const x = Math.cos(pastT * 0.2) * 12;
        const z = Math.sin(pastT * 0.2) * 8;
        const y = 3.5 + Math.sin(pastT * 0.5) * 0.5;
        const s = (1 - age) * 0.4;
        tempPos.set(x, y, z);
        tempScale.set(s, s, s);
        tempMatrix.compose(tempPos, tempQuat, tempScale);
        trailRef.current.setMatrixAt(i, tempMatrix);
        tempColor.setHSL(0.55 + age * 0.15, 0.9, 0.6 - age * 0.3);
        trailRef.current.setColorAt(i, tempColor);
      }
      trailRef.current.instanceMatrix.needsUpdate = true;
      if (trailRef.current.instanceColor) trailRef.current.instanceColor.needsUpdate = true;
    }

    // ═══ 2. DATA STREAMS — particles flowing from IoT tower to machines ═══
    if (dataRef.current) {
      for (let i = 0; i < DATA_PARTICLE_COUNT; i++) {
        const targetIdx = i % dataTargets.length;
        const target = dataTargets[targetIdx];
        const progress = (t * 0.8 + i * 0.15) % 1.0;

        const x = IOT_POS[0] + (target[0] - IOT_POS[0]) * progress;
        const y = IOT_POS[1] + (target[1] - IOT_POS[1]) * progress + Math.sin(progress * Math.PI) * 1.5;
        const z = IOT_POS[2] + (target[2] - IOT_POS[2]) * progress;
        const s = (1 - Math.abs(progress - 0.5) * 2) * 0.3 + 0.1;

        tempPos.set(x, y, z);
        tempScale.set(s, s, s);
        tempMatrix.compose(tempPos, tempQuat, tempScale);
        dataRef.current.setMatrixAt(i, tempMatrix);

        // Color: cyan near tower, green near machine
        tempColor.setHSL(0.48 + progress * 0.1, 0.9, 0.5);
        dataRef.current.setColorAt(i, tempColor);
      }
      dataRef.current.instanceMatrix.needsUpdate = true;
      if (dataRef.current.instanceColor) dataRef.current.instanceColor.needsUpdate = true;
    }

    // ═══ 3. HELICOPTER — hovering with spinning rotors ═══
    if (heliRef.current) {
      // Gentle hover bob
      heliRef.current.position.y = 5.5 + Math.sin(t * 0.8) * 0.15;
      heliRef.current.rotation.y = Math.sin(t * 0.1) * 0.3;
    }
    if (mainRotorRef.current) mainRotorRef.current.rotation.y += 0.4;
    if (tailRotorRef.current) tailRotorRef.current.rotation.x += 0.6;

    // ═══ 4. SCOREBOARD — update every second ═══
    if (now - lastScoreUpdate.current > 1000) {
      lastScoreUpdate.current = now;
      const state = useDigitalTwinStore.getState();
      if (scoreRefs.current.produced) scoreRefs.current.produced.textContent = state.totalProduced.toLocaleString();
      if (scoreRefs.current.rate) scoreRefs.current.rate.textContent = `${state.throughputPerMin.toFixed(1)}/min`;
      const hrs = Math.floor(t / 3600);
      const mins = Math.floor((t % 3600) / 60);
      if (scoreRefs.current.uptime) scoreRefs.current.uptime.textContent = `${hrs}h ${mins}m`;
      const quality = state.totalProduced > 0 ? ((1 - state.totalRejected / state.totalProduced) * 100).toFixed(1) : "100.0";
      if (scoreRefs.current.quality) scoreRefs.current.quality.textContent = `${quality}%`;
    }

    // ═══ 5. WELDING SPARKS ═══
    if (weldSparkRef.current) {
      for (let i = 0; i < SPARK_COUNT; i++) {
        const phase = (t * 4 + i * 0.5) % 1.2;
        const life = phase / 1.2;
        if (life > 0.8) {
          tempMatrix.makeTranslation(0, -100, 0);
        } else {
          const angle = i * 0.7 + t * 3;
          const speed = 0.2 + (i % 4) * 0.08;
          const x = -12 + Math.cos(angle) * life * speed;
          const y = 0.8 + life * 0.5 - life * life * 1.2;
          const z = 0 + Math.sin(angle) * life * speed;
          tempPos.set(x, y, z);
          tempScale.set(0.3 - life * 0.2, 0.3 - life * 0.2, 0.3 - life * 0.2);
          tempMatrix.compose(tempPos, tempQuat, tempScale);
        }
        weldSparkRef.current.setMatrixAt(i, tempMatrix);
      }
      weldSparkRef.current.instanceMatrix.needsUpdate = true;
    }
    // Welding arm oscillation
    if (weldArmRef.current) {
      weldArmRef.current.rotation.z = Math.sin(t * 1.5) * 0.3;
      weldArmRef.current.rotation.x = Math.sin(t * 0.8) * 0.15;
    }

    // ═══ 6. HOLO TABLE rotation ═══
    if (holoRotRef.current) {
      holoRotRef.current.rotation.y = t * 0.3;
    }
  });

  return (
    <group>
      {/* ═══════ 2. DATA STREAM PARTICLES ═══════ */}
      <instancedMesh ref={dataRef} args={[undefined, undefined, DATA_PARTICLE_COUNT]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.7} />
      </instancedMesh>

    </group>
  );
};

export default FactoryShowpiece3D;
