"use no memo";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type WorkerPose = "standing" | "inspecting" | "operating" | "clipboard";

interface FactoryWorker3DProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  pose?: WorkerPose;
  helmetColor?: string;
  vestColor?: string;
}

/**
 * FactoryWorker3D — Stylized human operator
 *
 * Simple geometric body with hard hat, high-vis vest, and subtle idle animation.
 * Single useFrame per worker for gentle breathing/sway.
 */
const FactoryWorker3D: React.FC<FactoryWorker3DProps> = ({
  position,
  rotation = [0, 0, 0],
  pose = "standing",
  helmetColor = "#fbbf24",
  vestColor = "#f97316",
}) => {
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const lArmRef = useRef<THREE.Group>(null);
  const rArmRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // Gentle body sway
    if (bodyRef.current) {
      bodyRef.current.rotation.z = Math.sin(t * 0.5 + position[0]) * 0.015;
      bodyRef.current.position.y = Math.sin(t * 0.8) * 0.003; // breathing
    }

    // Subtle head look-around
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.3 + position[2]) * 0.2;
    }

    // Arm animations based on pose
    if (lArmRef.current && rArmRef.current) {
      switch (pose) {
        case "operating":
          lArmRef.current.rotation.x = -0.8 + Math.sin(t * 2) * 0.15;
          rArmRef.current.rotation.x = -0.8 + Math.sin(t * 2 + 1) * 0.15;
          break;
        case "inspecting":
          lArmRef.current.rotation.x = -0.4;
          rArmRef.current.rotation.x = -1.0 + Math.sin(t * 0.5) * 0.1;
          rArmRef.current.rotation.z = 0.3;
          break;
        case "clipboard":
          lArmRef.current.rotation.x = -0.7;
          lArmRef.current.rotation.z = 0.2;
          rArmRef.current.rotation.x = -0.5;
          rArmRef.current.rotation.z = -0.1;
          break;
        default:
          lArmRef.current.rotation.x = Math.sin(t * 0.4) * 0.05;
          rArmRef.current.rotation.x = Math.sin(t * 0.4 + Math.PI) * 0.05;
          break;
      }
    }
  });

  const skinColor = "#d4a574";
  const pantsColor = "#1e3a5f";
  const bootColor = "#292524";

  return (
    <group position={position} rotation={rotation} scale={[0.55, 0.55, 0.55]}>
      <group ref={bodyRef}>
        {/* Boots */}
        <mesh position={[-0.1, 0.06, 0]} castShadow>
          <boxGeometry args={[0.12, 0.12, 0.18]} />
          <meshStandardMaterial color={bootColor} roughness={0.9} metalness={0.1} />
        </mesh>
        <mesh position={[0.1, 0.06, 0]} castShadow>
          <boxGeometry args={[0.12, 0.12, 0.18]} />
          <meshStandardMaterial color={bootColor} roughness={0.9} metalness={0.1} />
        </mesh>

        {/* Legs (pants) */}
        <mesh position={[-0.08, 0.35, 0]} castShadow>
          <boxGeometry args={[0.14, 0.5, 0.14]} />
          <meshStandardMaterial color={pantsColor} roughness={0.8} metalness={0.05} />
        </mesh>
        <mesh position={[0.08, 0.35, 0]} castShadow>
          <boxGeometry args={[0.14, 0.5, 0.14]} />
          <meshStandardMaterial color={pantsColor} roughness={0.8} metalness={0.05} />
        </mesh>

        {/* Torso */}
        <mesh position={[0, 0.8, 0]} castShadow>
          <boxGeometry args={[0.35, 0.4, 0.2]} />
          <meshStandardMaterial color="#1e3a5f" roughness={0.7} metalness={0.05} />
        </mesh>

        {/* High-vis vest */}
        <mesh position={[0, 0.82, 0.005]}>
          <boxGeometry args={[0.36, 0.35, 0.21]} />
          <meshStandardMaterial color={vestColor} emissive={vestColor} emissiveIntensity={0.15} roughness={0.6} metalness={0.1} />
        </mesh>
        {/* Reflective vest stripes */}
        <mesh position={[0, 0.72, 0.115]}>
          <boxGeometry args={[0.34, 0.03, 0.005]} />
          <meshStandardMaterial color="#e2e8f0" emissive="#e2e8f0" emissiveIntensity={0.3} metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.90, 0.115]}>
          <boxGeometry args={[0.34, 0.03, 0.005]} />
          <meshStandardMaterial color="#e2e8f0" emissive="#e2e8f0" emissiveIntensity={0.3} metalness={0.5} roughness={0.3} />
        </mesh>

        {/* Neck */}
        <mesh position={[0, 1.02, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.06, 8]} />
          <meshStandardMaterial color={skinColor} roughness={0.9} metalness={0.0} />
        </mesh>

        {/* Head */}
        <mesh ref={headRef} position={[0, 1.15, 0]} castShadow>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshStandardMaterial color={skinColor} roughness={0.9} metalness={0.0} />
        </mesh>

        {/* Hard hat */}
        <mesh position={[0, 1.23, 0]} castShadow>
          <sphereGeometry args={[0.14, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={helmetColor} roughness={0.4} metalness={0.2} />
        </mesh>
        {/* Hard hat brim */}
        <mesh position={[0, 1.22, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.015, 12]} />
          <meshStandardMaterial color={helmetColor} roughness={0.4} metalness={0.2} />
        </mesh>

        {/* Eyes */}
        <mesh position={[-0.04, 1.15, 0.11]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#1f2937" roughness={0.5} metalness={0.0} />
        </mesh>
        <mesh position={[0.04, 1.15, 0.11]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#1f2937" roughness={0.5} metalness={0.0} />
        </mesh>

        {/* Left arm */}
        <group ref={lArmRef} position={[-0.22, 0.9, 0]}>
          {/* Upper arm */}
          <mesh position={[0, -0.15, 0]} castShadow>
            <boxGeometry args={[0.1, 0.28, 0.1]} />
            <meshStandardMaterial color={vestColor} emissive={vestColor} emissiveIntensity={0.08} roughness={0.6} metalness={0.1} />
          </mesh>
          {/* Forearm */}
          <mesh position={[0, -0.38, 0.02]}>
            <boxGeometry args={[0.08, 0.2, 0.08]} />
            <meshStandardMaterial color={pantsColor} roughness={0.7} metalness={0.05} />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.5, 0.02]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color={skinColor} roughness={0.9} metalness={0.0} />
          </mesh>
          {/* Glove */}
          <mesh position={[0, -0.5, 0.02]}>
            <sphereGeometry args={[0.042, 6, 6]} />
            <meshStandardMaterial color="#6b7280" transparent opacity={0.6} roughness={0.7} metalness={0.1} />
          </mesh>
        </group>

        {/* Right arm */}
        <group ref={rArmRef} position={[0.22, 0.9, 0]}>
          {/* Upper arm */}
          <mesh position={[0, -0.15, 0]} castShadow>
            <boxGeometry args={[0.1, 0.28, 0.1]} />
            <meshStandardMaterial color={vestColor} emissive={vestColor} emissiveIntensity={0.08} roughness={0.6} metalness={0.1} />
          </mesh>
          {/* Forearm */}
          <mesh position={[0, -0.38, 0.02]}>
            <boxGeometry args={[0.08, 0.2, 0.08]} />
            <meshStandardMaterial color={pantsColor} roughness={0.7} metalness={0.05} />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.5, 0.02]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color={skinColor} roughness={0.9} metalness={0.0} />
          </mesh>
          <mesh position={[0, -0.5, 0.02]}>
            <sphereGeometry args={[0.042, 6, 6]} />
            <meshStandardMaterial color="#6b7280" transparent opacity={0.6} roughness={0.7} metalness={0.1} />
          </mesh>
        </group>

        {/* Clipboard (for clipboard pose) */}
        {pose === "clipboard" && (
          <group position={[-0.15, 0.55, 0.15]}>
            <mesh rotation={[0.3, 0, 0.2]}>
              <boxGeometry args={[0.15, 0.2, 0.01]} />
              <meshStandardMaterial color="#a16207" roughness={0.8} metalness={0.1} />
            </mesh>
            <mesh rotation={[0.3, 0, 0.2]} position={[0, 0, 0.008]}>
              <planeGeometry args={[0.12, 0.16]} />
              <meshStandardMaterial color="#f5f5f4" roughness={0.9} metalness={0.0} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
};

export default FactoryWorker3D;
