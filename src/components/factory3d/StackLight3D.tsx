"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";

interface StackLight3DProps {
  /** Index into useDigitalTwinStore.getState().stages — same convention as
   *  ManufacturingStage3D, so the light tracks whichever stage owns it. */
  stageIndex: number;
  /** World position of the base of the pole. */
  position: [number, number, number];
}

/**
 * StackLight3D — classic 3-tier andon stack light next to a manufacturing stage.
 *
 *   ●  red    — flashes when stage.status === "faulted"
 *   ●  amber  — pulses when stage.status === "warning"
 *   ●  green  — steady glow when stage.status === "running"
 *
 * idle    → all three dim
 * blocked → all three dim, base plate flashes blue
 *
 * Reads stage status via getState() inside useFrame (zero React re-renders),
 * matching the perf pattern used elsewhere in this codebase.
 */
const StackLight3D: React.FC<StackLight3DProps> = ({ stageIndex, position }) => {
  const redRef = useRef<THREE.Mesh>(null);
  const amberRef = useRef<THREE.Mesh>(null);
  const greenRef = useRef<THREE.Mesh>(null);
  const baseRef = useRef<THREE.Mesh>(null);

  // Geometry / material constants — shared across instances cheaply
  const domeGeo = useMemo(() => new THREE.SphereGeometry(0.07, 12, 8), []);

  useFrame(({ clock }) => {
    const stage = useDigitalTwinStore.getState().stages[stageIndex];
    if (!stage) return;
    const t = clock.elapsedTime;

    const redMat = redRef.current?.material as THREE.MeshStandardMaterial | undefined;
    const amberMat = amberRef.current?.material as THREE.MeshStandardMaterial | undefined;
    const greenMat = greenRef.current?.material as THREE.MeshStandardMaterial | undefined;
    const baseMat = baseRef.current?.material as THREE.MeshStandardMaterial | undefined;

    // Default: everything dim
    let redI = 0.05;
    let amberI = 0.05;
    let greenI = 0.05;
    let baseI = 0.0;

    switch (stage.status) {
      case "running":
        // Steady green glow
        greenI = 1.0 + Math.sin(t * 1.5) * 0.1;
        break;
      case "warning":
        // Amber pulses ~1.5Hz
        amberI = 0.4 + Math.abs(Math.sin(t * 1.5 * Math.PI)) * 0.9;
        break;
      case "faulted":
        // Red flashes ~3Hz on/off
        redI = Math.sin(t * 3 * Math.PI) > 0 ? 1.4 : 0.1;
        break;
      case "blocked":
        // All three dark, base plate flashes blue
        baseI = Math.sin(t * 2 * Math.PI) > 0 ? 0.9 : 0.1;
        break;
      case "idle":
      default:
        // Already at dim defaults
        break;
    }

    if (redMat) redMat.emissiveIntensity = redI;
    if (amberMat) amberMat.emissiveIntensity = amberI;
    if (greenMat) greenMat.emissiveIntensity = greenI;
    if (baseMat) baseMat.emissiveIntensity = baseI;
  });

  return (
    <group position={position}>
      {/* Base plate — flashes blue when stage is blocked */}
      <mesh ref={baseRef} position={[0, 0.015, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.1, 0.03, 12]} />
        <meshStandardMaterial
          color="#1f2937"
          metalness={0.7}
          roughness={0.3}
          emissive="#3b82f6"
          emissiveIntensity={0}
        />
      </mesh>
      {/* Pole */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.6, 8]} />
        <meshStandardMaterial color="#27272a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Domes — green (bottom), amber (middle), red (top) */}
      <mesh
        ref={greenRef}
        geometry={domeGeo}
        position={[0, 0.66, 0]}
        scale={[1, 0.7, 1]}
      >
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={0.05}
          metalness={0.2}
          roughness={0.35}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh
        ref={amberRef}
        geometry={domeGeo}
        position={[0, 0.81, 0]}
        scale={[1, 0.7, 1]}
      >
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.05}
          metalness={0.2}
          roughness={0.35}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh
        ref={redRef}
        geometry={domeGeo}
        position={[0, 0.96, 0]}
        scale={[1, 0.7, 1]}
      >
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={0.05}
          metalness={0.2}
          roughness={0.35}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* Top cap */}
      <mesh position={[0, 1.045, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.025, 8]} />
        <meshStandardMaterial color="#18181b" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
};

export default StackLight3D;
