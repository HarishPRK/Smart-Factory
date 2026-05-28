"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";

interface PepsiFillingStation3DProps {
  position: [number, number, number];
  rotationY: number;
}

/**
 * PepsiFillingStation3D — Inline Pepsi filling station
 *
 * A linear filling machine where bottles pass through on the conveyor
 * and get filled with Pepsi from overhead nozzles. Simpler design
 * than the rotary carousel, with bottles staying on the main belt.
 *
 * Visual elements:
 *  - Blue Pepsi tank mounted on top
 *  - Multiple filling nozzles in a row
 *  - Animated brown liquid streams from nozzles to bottles
 *  - Frame structure around the filling zone
 *  - Control panel on the side
 */

const NOZZLE_COUNT = 4;
const STREAM_COUNT = 8;

const PepsiFillingStation3D: React.FC<PepsiFillingStation3DProps> = ({
  position,
  rotationY,
}) => {
  const streamRef = useRef<THREE.InstancedMesh>(null);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const convSpeed = useDigitalTwinStore.getState().conveyorSpeedMultiplier;

    // Animate filling streams — continuous flow (high-speed production)
    if (streamRef.current && convSpeed > 0) {
      for (let i = 0; i < STREAM_COUNT; i++) {
        const nozzleIndex = i % NOZZLE_COUNT;
        const nozzleZ = (nozzleIndex - (NOZZLE_COUNT - 1) / 2) * 0.35;
        const phase = (t * 3 + i * 0.3) % 1.0;
        const x = 0;
        const z = nozzleZ;
        const y = 1.5 - phase * 0.65; // fall from nozzle to bottle height
        const s = (1 - phase) * 0.25 + 0.08;

        tempPos.set(x, y, z);
        tempScale.set(s, s * 2.5, s);
        tempMatrix.compose(tempPos, tempQuat, tempScale);
        streamRef.current.setMatrixAt(i, tempMatrix);
      }
      streamRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={[1.2, 1.2, 1.2]}
    >
      {/* ── Base platform ── */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[1.4, 0.1, 2.2]} />
        <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ── Main frame structure ── */}
      {/* Vertical supports */}
      {[-0.65, 0.65].map((x, idx) => (
        <React.Fragment key={`support-${idx}`}>
          <mesh position={[x, 0.9, -0.9]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 1.7, 8]} />
            <meshStandardMaterial
              color="#4b5563"
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[x, 0.9, 0.9]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 1.7, 8]} />
            <meshStandardMaterial
              color="#4b5563"
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        </React.Fragment>
      ))}

      {/* Top cross beam */}
      <mesh position={[0, 1.75, -0.9]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 1.3, 8]} />
        <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 1.75, 0.9]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 1.3, 8]} />
        <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* ── Pepsi syrup tank on top ── */}
      <mesh position={[0, 2.1, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 0.7, 16]} />
        <meshStandardMaterial
          color="#004B93"
          metalness={0.6}
          roughness={0.3}
          emissive="#001f4d"
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* Tank top cap */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.08, 16]} />
        <meshStandardMaterial color="#001f4d" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* White Pepsi band on tank */}
      <mesh position={[0, 2.1, 0]}>
        <cylinderGeometry args={[0.405, 0.405, 0.15, 16, 1, true]} />
        <meshStandardMaterial
          color="#f8fafc"
          metalness={0.1}
          roughness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Feed pipes from tank to nozzles ── */}
      <mesh position={[0, 1.7, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.4, 8]} />
        <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* ── Distribution manifold ── */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[0.15, 0.08, 1.5]} />
        <meshStandardMaterial color="#52525b" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* ── Filling nozzles (in a row) ── */}
      {Array.from({ length: NOZZLE_COUNT }).map((_, i) => {
        const z = (i - (NOZZLE_COUNT - 1) / 2) * 0.35;
        return (
          <group key={`nozzle-${i}`}>
            {/* Nozzle arm */}
            <mesh position={[0, 1.46, z]}>
              <cylinderGeometry args={[0.015, 0.015, 0.08, 6]} />
              <meshStandardMaterial
                color="#6b7280"
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
            {/* Nozzle tip (downward pointing cone) */}
            <mesh position={[0, 1.38, z]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.025, 0.06, 8]} />
              <meshStandardMaterial
                color="#374151"
                metalness={0.9}
                roughness={0.1}
              />
            </mesh>
          </group>
        );
      })}

      {/* ── Animated filling streams (brown Pepsi liquid) ── */}
      <instancedMesh
        ref={streamRef}
        args={[undefined, undefined, STREAM_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial
          color="#3d1c02"
          emissive="#1c0a00"
          emissiveIntensity={0.4}
          transparent
          opacity={0.9}
        />
      </instancedMesh>

      {/* ── Control panel on the side ── */}
      <group position={[0.8, 0.8, 0]}>
        {/* Panel box */}
        <mesh castShadow>
          <boxGeometry args={[0.08, 0.6, 0.5]} />
          <meshStandardMaterial
            color="#374151"
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
        {/* Screen */}
        <mesh position={[0.045, 0.15, 0]}>
          <boxGeometry args={[0.01, 0.3, 0.35]} />
          <meshStandardMaterial
            color="#1e293b"
            emissive="#22d3ee"
            emissiveIntensity={0.3}
          />
        </mesh>
        {/* Buttons */}
        {[-0.15, -0.05, 0.05].map((y, idx) => (
          <mesh key={`btn-${idx}`} position={[0.045, y, 0.2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.01, 8]} />
            <meshStandardMaterial
              color={idx === 0 ? "#22c55e" : idx === 1 ? "#fbbf24" : "#ef4444"}
              emissive={
                idx === 0 ? "#10b981" : idx === 1 ? "#f59e0b" : "#dc2626"
              }
              emissiveIntensity={0.5}
            />
          </mesh>
        ))}
      </group>

      {/* ── Status indicator light ── */}
      <mesh position={[0, 2.7, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={1.0}
        />
      </mesh>
      <pointLight
        position={[0, 2.7, 0]}
        color="#22c55e"
        intensity={0.4}
        distance={3}
      />

      {/* ── Safety guards (transparent panels) ── */}
      {[-0.65, 0.65].map((x, idx) => (
        <mesh key={`guard-${idx}`} position={[x, 0.9, 0]}>
          <boxGeometry args={[0.02, 1.6, 2.0]} />
          <meshStandardMaterial
            color="#fbbf24"
            transparent
            opacity={0.2}
            metalness={0.5}
            roughness={0.1}
          />
        </mesh>
      ))}

      {/* ── Warning stripes on base ── */}
      {[-0.6, -0.2, 0.2, 0.6].map((z, idx) => (
        <mesh
          key={`stripe-${idx}`}
          position={[-0.65, 0.11, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.15, 0.15]} />
          <meshBasicMaterial color={idx % 2 === 0 ? "#fbbf24" : "#1f2937"} />
        </mesh>
      ))}
    </group>
  );
};

export default PepsiFillingStation3D;
