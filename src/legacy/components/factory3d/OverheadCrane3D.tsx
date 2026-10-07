"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STAGE_POSITIONS } from "./digitalTwinLayout";

/**
 * OverheadCrane3D — Animated gantry crane that moves along the production line
 *
 * Runs on two overhead rails spanning the factory.
 * The trolley moves along the bridge, and a hook/cable hangs down.
 * Periodically picks up and moves materials between stages.
 */
const OverheadCrane3D: React.FC = () => {
  const bridgeRef = useRef<THREE.Group>(null);
  const trolleyRef = useRef<THREE.Group>(null);
  const cableRef = useRef<THREE.Mesh>(null);
  const hookRef = useRef<THREE.Group>(null);
  const warningLightRef = useRef<THREE.Mesh>(null);

  // Crane travels along X axis, above the factory at y=5
  const RAIL_Y = 4.5;
  const RAIL_Z_FRONT = 5;
  const RAIL_Z_BACK = -5;
  const RAIL_X_MIN = -9;
  const RAIL_X_MAX = 10;

  // Waypoints the crane visits (above each stage)
  const waypoints = useMemo(() => [
    STAGE_POSITIONS.intake[0],
    STAGE_POSITIONS.mixing[0],
    STAGE_POSITIONS.forming[0],
    STAGE_POSITIONS.curing[0],
    STAGE_POSITIONS.quality[0],
    STAGE_POSITIONS.packaging[0],
    STAGE_POSITIONS.dispatch[0],
  ], []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // Bridge position — slowly moves between waypoints
    const cycleTime = 40; // seconds for full cycle
    const phase = (t % cycleTime) / cycleTime;
    const waypointIdx = phase * waypoints.length;
    const idx = Math.floor(waypointIdx);
    const frac = waypointIdx - idx;
    const fromX = waypoints[idx % waypoints.length];
    const toX = waypoints[(idx + 1) % waypoints.length];
    const ease = frac * frac * (3 - 2 * frac); // smoothstep
    const bridgeX = fromX + (toX - fromX) * ease;

    if (bridgeRef.current) {
      bridgeRef.current.position.x = bridgeX;
    }

    // Trolley moves along the bridge (Z axis) — oscillates
    const trolleyZ = Math.sin(t * 0.5) * 3;
    if (trolleyRef.current) {
      trolleyRef.current.position.z = trolleyZ;
    }

    // Cable length — varies as if picking up / setting down
    const cablePhase = (t * 0.3) % Math.PI;
    const cableLen = 1.5 + Math.sin(cablePhase) * 1.0;
    if (cableRef.current) {
      cableRef.current.scale.y = cableLen;
      cableRef.current.position.y = -cableLen / 2;
    }
    if (hookRef.current) {
      hookRef.current.position.y = -cableLen;
    }

    // Warning light flash when moving
    if (warningLightRef.current) {
      const mat = warningLightRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = Math.sin(t * 4) > 0 ? 1.0 : 0.1;
    }
  });

  return (
    <group>
      {/* ── Overhead Rails (2 parallel, spanning factory length) ── */}
      {[RAIL_Z_FRONT, RAIL_Z_BACK].map((z, i) => (
        <group key={`rail-${i}`}>
          {/* Rail beam */}
          <mesh position={[(RAIL_X_MIN + RAIL_X_MAX) / 2, RAIL_Y, z]}>
            <boxGeometry args={[RAIL_X_MAX - RAIL_X_MIN + 2, 0.08, 0.12]} />
            <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Rail supports (columns) */}
          {[RAIL_X_MIN, (RAIL_X_MIN + RAIL_X_MAX) / 2, RAIL_X_MAX].map((x, j) => (
            <mesh key={j} position={[x, RAIL_Y / 2, z]}>
              <boxGeometry args={[0.1, RAIL_Y, 0.1]} />
              <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ── Bridge (moves along X on the rails) ── */}
      <group ref={bridgeRef}>
        {/* Bridge beam spanning between front and back rails */}
        <mesh position={[0, RAIL_Y + 0.06, 0]}>
          <boxGeometry args={[0.2, 0.12, RAIL_Z_FRONT - RAIL_Z_BACK + 0.5]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Bridge end trucks (wheels on rails) */}
        {[RAIL_Z_FRONT, RAIL_Z_BACK].map((z, i) => (
          <mesh key={i} position={[0, RAIL_Y, z]}>
            <boxGeometry args={[0.3, 0.1, 0.2]} />
            <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}

        {/* ── Trolley (moves along Z on the bridge) ── */}
        <group ref={trolleyRef} position={[0, RAIL_Y, 0]}>
          {/* Trolley body */}
          <mesh position={[0, -0.1, 0]}>
            <boxGeometry args={[0.25, 0.12, 0.3]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Motor housing */}
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.12, 8]} />
            <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Warning light */}
          <mesh ref={warningLightRef} position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} />
          </mesh>

          {/* Cable (scales vertically) */}
          <mesh ref={cableRef} position={[0, -0.75, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 1, 4]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.1} />
          </mesh>

          {/* Hook assembly */}
          <group ref={hookRef} position={[0, -1.5, 0]}>
            <mesh>
              <torusGeometry args={[0.05, 0.012, 6, 12, Math.PI]} />
              <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Spreader bar */}
            <mesh position={[0, -0.03, 0]}>
              <boxGeometry args={[0.2, 0.02, 0.02]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};

export default OverheadCrane3D;
