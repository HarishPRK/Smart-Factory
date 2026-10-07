"use no memo";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { STAGE_POSITIONS } from "./digitalTwinLayout";

/**
 * BottleProcessing3D â€” Animated water filling, capping & labeling stations
 *
 * Placed between Quality Inspection and Packaging stages.
 * Shows the final steps before bottles are packaged:
 *   1. Water filling nozzles (animated liquid stream)
 *   2. Cap feeder + capping head pressing down
 *   3. Label applicator roller + printed label
 *   4. Rejection arm sweeping defective bottles off
 */

const BottleProcessing3D: React.FC = () => {
  // Position between quality and packaging
  const qPos = STAGE_POSITIONS.quality;
  const pPos = STAGE_POSITIONS.packaging;
  const midX = (qPos[0] + pPos[0]) / 2;
  const midZ = (qPos[2] + pPos[2]) / 2;
  const baseY = qPos[1];

  // Animation refs
  const nozzleStreamRef = useRef<THREE.InstancedMesh>(null);
  const capHeadRef = useRef<THREE.Mesh>(null);
  const labelRollerRef = useRef<THREE.Mesh>(null);
  const rejectArmRef = useRef<THREE.Group>(null);
  const capFeedRef = useRef<THREE.Group>(null);
  const fillLevelRef = useRef<THREE.Mesh>(null);

  const tempMatrix = React.useMemo(() => new THREE.Matrix4(), []);
  const STREAM_COUNT = 8;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // â”€â”€ Water stream from nozzles â”€â”€
    if (nozzleStreamRef.current) {
      for (let i = 0; i < STREAM_COUNT; i++) {
        const phase = (t * 2 + i * 0.3) % 1.0;
        const x = midX - 1.8;
        const y = baseY + 1.2 - phase * 0.8;
        const z = midZ + (i % 2 === 0 ? -0.1 : 0.1);
        const s = (1 - phase) * 0.5 + 0.2;
        tempMatrix.makeTranslation(x, y, z);
        tempMatrix.scale(new THREE.Vector3(s, s * 2, s));
        nozzleStreamRef.current.setMatrixAt(i, tempMatrix);
      }
      nozzleStreamRef.current.instanceMatrix.needsUpdate = true;
    }

    // â”€â”€ Fill level indicator (water rising in bottle) â”€â”€
    if (fillLevelRef.current) {
      const fillCycle = (t * 0.5) % 1.0;
      fillLevelRef.current.scale.y = fillCycle;
      fillLevelRef.current.position.y = baseY + 0.15 + fillCycle * 0.2;
    }

    // â”€â”€ Capping head pressing down â”€â”€
    if (capHeadRef.current) {
      const capCycle = Math.sin(t * 2);
      capHeadRef.current.position.y = baseY + 1.0 + capCycle * 0.15;
    }

    // â”€â”€ Cap feeder vibration â”€â”€
    if (capFeedRef.current) {
      capFeedRef.current.position.x = midX - 0.5 + Math.sin(t * 15) * 0.005;
    }

    // â”€â”€ Label roller spinning â”€â”€
    if (labelRollerRef.current) {
      labelRollerRef.current.rotation.z += 0.02;
    }

    // â”€â”€ Reject arm sweep â”€â”€
    if (rejectArmRef.current) {
      const sweep = (t * 0.3) % 4;
      if (sweep < 0.5) {
        rejectArmRef.current.rotation.y = sweep * Math.PI * 0.3;
      } else if (sweep < 1.0) {
        rejectArmRef.current.rotation.y = (1.0 - sweep) * Math.PI * 0.3;
      } else {
        rejectArmRef.current.rotation.y = 0;
      }
    }
  });

  return (
    <group>
      {/* â•â•â•â•â•â• WATER FILLING STATION â•â•â•â•â•â• */}
      <group position={[midX - 1.8, 0, midZ]}>
        {/* Filling machine frame */}
        <mesh position={[0, baseY + 0.7, 0]} castShadow>
          <boxGeometry args={[0.6, 1.2, 0.5]} />
          <meshStandardMaterial color="#2563eb" metalness={0.6} roughness={0.35} />
        </mesh>
        {/* Nozzle array (4 nozzles) */}
        {[-0.15, -0.05, 0.05, 0.15].map((z, i) => (
          <group key={`noz${i}`}>
            <mesh position={[0, baseY + 1.25, z]}>
              <cylinderGeometry args={[0.02, 0.015, 0.12, 6]} />
              <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Nozzle tip */}
            <mesh position={[0, baseY + 1.18, z]}>
              <cylinderGeometry args={[0.008, 0.008, 0.03, 6]} />
              <meshStandardMaterial color="#d4d4d8" metalness={0.95} roughness={0.05} />
            </mesh>
          </group>
        ))}
        {/* Water tank on top */}
        <mesh position={[0, baseY + 1.55, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.4, 10]} />
          <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Water level visible inside tank */}
        <mesh ref={fillLevelRef} position={[0, baseY + 1.45, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.3, 10]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.35} emissive="#2563eb" emissiveIntensity={0.15} />
        </mesh>
        {/* Pipe connections */}
        <mesh position={[0.22, baseY + 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.15, 6]} />
          <meshStandardMaterial color="#3b82f6" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* "FILLING" label */}
        <Html position={[0, baseY + 1.9, 0]} center distanceFactor={12} style={{ pointerEvents: "none", willChange: "transform" }}>
          <div style={{ background: "rgba(10,22,40,0.9)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "4px", padding: "2px 8px", fontSize: "8px", fontWeight: 700, color: "#93c5fd", fontFamily: "'Montserrat', system-ui", whiteSpace: "nowrap" }}>
            WATER FILLING
          </div>
        </Html>
      </group>

      {/* Water stream particles */}
      <instancedMesh ref={nozzleStreamRef} args={[undefined, undefined, STREAM_COUNT]}>
        <sphereGeometry args={[0.01, 4, 4]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.5} />
      </instancedMesh>

      {/* â•â•â•â•â•â• CAPPING STATION â•â•â•â•â•â• */}
      <group position={[midX - 0.5, 0, midZ]}>
        {/* Capper frame */}
        <mesh position={[0, baseY + 0.6, 0]} castShadow>
          <boxGeometry args={[0.5, 1.0, 0.4]} />
          <meshStandardMaterial color="#059669" metalness={0.6} roughness={0.35} />
        </mesh>
        {/* Capping head (presses down) */}
        <mesh ref={capHeadRef} position={[0, baseY + 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.04, 0.15, 8]} />
          <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Piston rod */}
        <mesh position={[0, baseY + 1.2, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.3, 6]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.95} roughness={0.05} />
        </mesh>
        {/* Cap feeder chute */}
        <group ref={capFeedRef} position={[midX - 0.5, 0, midZ]}>
          <mesh position={[-0.3, baseY + 0.9, -0.15]} rotation={[0, 0, -0.3]} castShadow>
            <boxGeometry args={[0.3, 0.04, 0.1]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Caps on feeder (small colored discs) */}
          {[0, 1, 2, 3].map((i) => (
            <mesh key={`cap${i}`} position={[-0.35 - i * 0.06, baseY + 0.94 + i * 0.02, -0.15]}>
              <cylinderGeometry args={[0.018, 0.018, 0.01, 8]} />
              <meshStandardMaterial color="#2563eb" roughness={0.4} metalness={0.3} />
            </mesh>
          ))}
        </group>
        {/* "CAPPING" label */}
        <Html position={[0, baseY + 1.6, 0]} center distanceFactor={12} style={{ pointerEvents: "none", willChange: "transform" }}>
          <div style={{ background: "rgba(10,22,40,0.9)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "4px", padding: "2px 8px", fontSize: "8px", fontWeight: 700, color: "#6ee7b7", fontFamily: "'Montserrat', system-ui", whiteSpace: "nowrap" }}>
            CAPPING
          </div>
        </Html>
      </group>

      {/* â•â•â•â•â•â• LABELING STATION â•â•â•â•â•â• */}
      <group position={[midX + 0.8, 0, midZ]}>
        {/* Labeler frame */}
        <mesh position={[0, baseY + 0.5, 0]} castShadow>
          <boxGeometry args={[0.4, 0.8, 0.4]} />
          <meshStandardMaterial color="#7c3aed" metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Label roll */}
        <mesh ref={labelRollerRef} position={[-0.25, baseY + 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.05, 12]} />
          <meshStandardMaterial color="#fef3c7" roughness={0.8} metalness={0.05} />
        </mesh>
        {/* Label roll core */}
        <mesh position={[-0.25, baseY + 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.06, 8]} />
          <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Applicator roller */}
        <mesh position={[0.05, baseY + 0.4, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.15, 8]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Guide rails */}
        {[-0.12, 0.12].map((z, i) => (
          <mesh key={i} position={[0, baseY + 0.15, z]}>
            <boxGeometry args={[0.5, 0.03, 0.02]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
        {/* "LABELING" label */}
        <Html position={[0, baseY + 1.2, 0]} center distanceFactor={12} style={{ pointerEvents: "none", willChange: "transform" }}>
          <div style={{ background: "rgba(10,22,40,0.9)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "4px", padding: "2px 8px", fontSize: "8px", fontWeight: 700, color: "#c4b5fd", fontFamily: "'Montserrat', system-ui", whiteSpace: "nowrap" }}>
            LABELING
          </div>
        </Html>
      </group>

      {/* â•â•â•â•â•â• REJECTION ARM â•â•â•â•â•â• */}
      <group position={[midX + 1.8, 0, midZ]}>
        {/* Arm base */}
        <mesh position={[0, baseY + 0.15, 0.3]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.3, 6]} />
          <meshStandardMaterial color="#dc2626" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Sweep arm */}
        <group ref={rejectArmRef} position={[0, baseY + 0.3, 0.3]}>
          <mesh position={[0, 0, -0.2]} castShadow>
            <boxGeometry args={[0.04, 0.06, 0.4]} />
            <meshStandardMaterial color="#ef4444" metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Pusher pad */}
          <mesh position={[0, 0, -0.4]}>
            <boxGeometry args={[0.08, 0.08, 0.03]} />
            <meshStandardMaterial color="#1f2937" roughness={0.7} metalness={0.3} />
          </mesh>
        </group>
        {/* Reject bin */}
        <mesh position={[0.3, baseY + 0.1, -0.3]} castShadow>
          <boxGeometry args={[0.3, 0.2, 0.3]} />
          <meshStandardMaterial color="#991b1b" roughness={0.7} metalness={0.3} />
        </mesh>
        {/* "REJECT" sign */}
        <mesh position={[0.3, baseY + 0.25, -0.16]}>
          <planeGeometry args={[0.2, 0.06]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* â•â•â•â•â•â• CONVEYOR GUIDE RAILS between stations â•â•â•â•â•â• */}
      {[-0.15, 0.15].map((z, i) => (
        <mesh key={`rail${i}`} position={[midX, baseY + 0.12, midZ + z]}>
          <boxGeometry args={[4.5, 0.02, 0.02]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* â•â•â•â•â•â• STATUS LIGHTS (green running indicators) â•â•â•â•â•â• */}
      {[-1.8, -0.5, 0.8].map((dx, i) => (
        <mesh key={`sled${i}`} position={[midX + dx, baseY + 1.35 + (i === 0 ? 0.45 : 0), midZ + 0.25]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
};

export default BottleProcessing3D;
