"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";

interface RotaryFiller3DProps {
  position: [number, number, number];
  rotationY: number;
}

/**
 * RotaryFiller3D — Rotary carousel filling station for Coca-Cola.
 *
 * A spinning turntable sits beside the belt. Bottles transfer onto it,
 * rotate under filling nozzles, and transfer back. The carousel spins
 * in sync with the conveyor speed so it feels connected to the line.
 *
 * Visual elements:
 *  - Large turntable disc (spins)
 *  - 8 filling nozzle arms radiating from center
 *  - Central column with Coke-red tank on top
 *  - Animated brown "liquid streams" dropping from nozzles
 *  - Guard ring around the carousel
 *  - Transfer guides connecting to belt
 */

const NOZZLE_COUNT = 8;
const STREAM_COUNT = 8;

const RotaryFiller3D: React.FC<RotaryFiller3DProps> = ({ position, rotationY }) => {
  const turntableRef = useRef<THREE.Group>(null);
  const streamRef = useRef<THREE.InstancedMesh>(null);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const convSpeed = useDigitalTwinStore.getState().conveyorSpeedMultiplier;
    const rpm = convSpeed * 0.3; // gentle rotation

    // Spin turntable
    if (turntableRef.current) {
      turntableRef.current.rotation.y += rpm * 0.016; // ~60fps delta
    }

    // Animate filling streams — brown liquid droplets falling from nozzles
    if (streamRef.current) {
      for (let i = 0; i < STREAM_COUNT; i++) {
        const angle = (i / NOZZLE_COUNT) * Math.PI * 2 +
                      (turntableRef.current?.rotation.y ?? 0);
        const radius = 0.9;
        const phase = (t * 3 + i * 0.5) % 1.0;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = 1.6 - phase * 0.7; // fall from nozzle to bottle height
        const s = (1 - phase) * 0.3 + 0.1;

        tempPos.set(x, y, z);
        tempScale.set(s, s * 2, s);
        tempMatrix.compose(tempPos, tempQuat, tempScale);
        streamRef.current.setMatrixAt(i, tempMatrix);
      }
      streamRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[1.3, 1.3, 1.3]}>
      {/* ── Guard ring — outer transparent safety ring ── */}
      <mesh position={[0, 0.4, 0]}>
        <torusGeometry args={[1.5, 0.03, 8, 32]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <torusGeometry args={[1.5, 0.03, 8, 32]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Guard posts */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={`gp-${i}`} position={[Math.cos(a) * 1.5, 0.6, Math.sin(a) * 1.5]}>
            <cylinderGeometry args={[0.025, 0.025, 0.8, 6]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.4} roughness={0.4} />
          </mesh>
        );
      })}

      {/* ── Base platform ── */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[1.4, 1.45, 0.1, 24]} />
        <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ── Spinning turntable group ── */}
      <group ref={turntableRef} position={[0, 0.15, 0]}>
        {/* Turntable disc */}
        <mesh castShadow>
          <cylinderGeometry args={[1.2, 1.2, 0.08, 24]} />
          <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Turntable accent ring */}
        <mesh position={[0, 0.01, 0]}>
          <torusGeometry args={[1.15, 0.015, 4, 24]} />
          <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.3} />
        </mesh>

        {/* 8 bottle pocket positions (small circular guides on turntable) */}
        {Array.from({ length: NOZZLE_COUNT }).map((_, i) => {
          const a = (i / NOZZLE_COUNT) * Math.PI * 2;
          const r = 0.9;
          return (
            <mesh key={`pocket-${i}`} position={[Math.cos(a) * r, 0.06, Math.sin(a) * r]}>
              <torusGeometry args={[0.06, 0.008, 4, 12]} />
              <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
            </mesh>
          );
        })}
      </group>

      {/* ── Central column (stationary) ── */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 1.3, 12]} />
        <meshStandardMaterial color="#52525b" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* ── Coca-Cola syrup tank on top ── */}
      <mesh position={[0, 1.7, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.6, 16]} />
        <meshStandardMaterial color="#dc2626" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Tank top cap */}
      <mesh position={[0, 2.05, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.06, 16]} />
        <meshStandardMaterial color="#991b1b" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* White Coca-Cola band on tank */}
      <mesh position={[0, 1.7, 0]}>
        <cylinderGeometry args={[0.355, 0.355, 0.12, 16, 1, true]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.1} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Nozzle arms (stationary, radial) ── */}
      {Array.from({ length: NOZZLE_COUNT }).map((_, i) => {
        const a = (i / NOZZLE_COUNT) * Math.PI * 2;
        const r = 0.55;
        return (
          <group key={`nozzle-${i}`}>
            {/* Horizontal arm from center to nozzle position */}
            <mesh
              position={[Math.cos(a) * r, 1.5, Math.sin(a) * r]}
              rotation={[0, -a, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
              <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Nozzle tip (downward pointing) */}
            <mesh position={[Math.cos(a) * 0.9, 1.45, Math.sin(a) * 0.9]}>
              <coneGeometry args={[0.03, 0.08, 8]} />
              <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
        );
      })}

      {/* ── Animated filling streams (brown Coca-Cola liquid) ── */}
      <instancedMesh
        ref={streamRef}
        args={[undefined, undefined, STREAM_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial
          color="#3d1c02"
          emissive="#1c0a00"
          emissiveIntensity={0.3}
          transparent
          opacity={0.85}
        />
      </instancedMesh>

      {/* ── Transfer guide rails (connect carousel to belt) ── */}
      {/* Inlet guide — from belt direction into carousel */}
      <mesh position={[0, 0.25, 1.6]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.4, 0.15, 0.5]} />
        <meshStandardMaterial color="#52525b" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Outlet guide — from carousel back to belt */}
      <mesh position={[0, 0.25, -1.6]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.4, 0.15, 0.5]} />
        <meshStandardMaterial color="#52525b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ── Status indicator on top ── */}
      <mesh position={[0, 2.3, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
};

export default RotaryFiller3D;
