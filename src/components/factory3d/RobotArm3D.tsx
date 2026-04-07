"use no memo";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface RobotArm3DProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  speed?: number;
  scale?: number;
}

/**
 * RobotArm3D — Animated 6-axis industrial robot arm
 *
 * Uses a single useFrame for smooth joint animation.
 * Geometry: base + turret + lower arm + elbow + upper arm + wrist + gripper.
 */
const RobotArm3D: React.FC<RobotArm3DProps> = ({
  position,
  rotation = [0, 0, 0],
  color = "#f59e0b",
  speed = 1,
  scale = 1,
}) => {
  const turretRef = useRef<THREE.Group>(null);
  const lowerArmRef = useRef<THREE.Group>(null);
  const upperArmRef = useRef<THREE.Group>(null);
  const wristRef = useRef<THREE.Group>(null);
  const gripperLRef = useRef<THREE.Mesh>(null);
  const gripperRRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed;

    // Turret rotation (base swivel)
    if (turretRef.current) {
      turretRef.current.rotation.y = Math.sin(t * 0.8) * 0.6;
    }

    // Lower arm (shoulder pitch)
    if (lowerArmRef.current) {
      lowerArmRef.current.rotation.z = -0.3 + Math.sin(t * 0.6) * 0.25;
    }

    // Upper arm (elbow pitch)
    if (upperArmRef.current) {
      upperArmRef.current.rotation.z = 0.4 + Math.sin(t * 0.9 + 1) * 0.3;
    }

    // Wrist rotation
    if (wristRef.current) {
      wristRef.current.rotation.x = Math.sin(t * 1.2) * 0.5;
    }

    // Gripper open/close
    const gripAngle = 0.05 + Math.abs(Math.sin(t * 1.5)) * 0.12;
    if (gripperLRef.current) {
      gripperLRef.current.rotation.z = gripAngle;
    }
    if (gripperRRef.current) {
      gripperRRef.current.rotation.z = -gripAngle;
    }
  });

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* Base plate */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.18, 0.04, 12]} />
        <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Base pedestal */}
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.1, 10]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Turret (rotates on Y) */}
      <group ref={turretRef} position={[0, 0.13, 0]}>
        {/* Turret housing */}
        <mesh castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.06, 10]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
        </mesh>

        {/* Lower arm assembly (rotates on Z — shoulder) */}
        <group ref={lowerArmRef} position={[0, 0.03, 0]}>
          {/* Shoulder joint */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.08, 8]} />
            <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
          </mesh>

          {/* Lower arm segment */}
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[0.06, 0.35, 0.05]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
          </mesh>

          {/* Hydraulic cylinder detail */}
          <mesh position={[0.04, 0.15, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.2, 6]} />
            <meshStandardMaterial color="#a1a1aa" metalness={0.9} roughness={0.1} />
          </mesh>

          {/* Elbow joint */}
          <group position={[0, 0.38, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.07, 8]} />
              <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Upper arm assembly (rotates on Z — elbow) */}
            <group ref={upperArmRef}>
              {/* Upper arm segment */}
              <mesh position={[0, 0.15, 0]} castShadow>
                <boxGeometry args={[0.05, 0.28, 0.04]} />
                <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
              </mesh>

              {/* Cable routing */}
              <mesh position={[-0.03, 0.15, 0]}>
                <cylinderGeometry args={[0.008, 0.008, 0.22, 4]} />
                <meshStandardMaterial color="#1f2937" roughness={0.8} metalness={0.1} />
              </mesh>

              {/* Wrist assembly */}
              <group ref={wristRef} position={[0, 0.3, 0]}>
                {/* Wrist joint */}
                <mesh>
                  <sphereGeometry args={[0.03, 8, 8]} />
                  <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
                </mesh>

                {/* Gripper mount */}
                <mesh position={[0, 0.04, 0]}>
                  <boxGeometry args={[0.06, 0.03, 0.04]} />
                  <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
                </mesh>

                {/* Left gripper finger */}
                <mesh ref={gripperLRef} position={[-0.02, 0.08, 0]} castShadow>
                  <boxGeometry args={[0.015, 0.07, 0.03]} />
                  <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.1} />
                </mesh>

                {/* Right gripper finger */}
                <mesh ref={gripperRRef} position={[0.02, 0.08, 0]} castShadow>
                  <boxGeometry args={[0.015, 0.07, 0.03]} />
                  <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.1} />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* Brand label on base */}
      <mesh position={[0, 0.08, 0.125]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.06, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
};

export default RobotArm3D;
