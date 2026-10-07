"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STAGE_POSITIONS } from "./digitalTwinLayout";

const S = { metalness: 0.8, roughness: 0.2 };

/* ── Animated Truck — drives along a path, parks, idles, departs ── */
const AnimatedTruckWrapper: React.FC<{
  parkPos: [number, number, number];
  parkRotation: number;
  approachFrom: [number, number, number];
  departTo: [number, number, number];
  cabColor?: string;
  cargoColor?: string;
  cycleDuration?: number; // total cycle in seconds
}> = ({ parkPos, parkRotation, approachFrom, departTo, cabColor = "#1e40af", cargoColor = "#e2e8f0", cycleDuration = 60 }) => {
  const wrapperRef = useRef<THREE.Group>(null);
  const headlightLRef = useRef<THREE.Mesh>(null);
  const headlightRRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!wrapperRef.current) return;
    const t = clock.elapsedTime;
    const phase = (t % cycleDuration) / cycleDuration; // 0-1

    let x: number, y: number, z: number, rot: number;
    const idle = 0.003 * Math.sin(t * 12);

    if (phase < 0.15) {
      // Driving in (0-15%)
      const p = phase / 0.15;
      const ease = p * p * (3 - 2 * p); // smoothstep
      x = approachFrom[0] + (parkPos[0] - approachFrom[0]) * ease;
      y = idle;
      z = approachFrom[2] + (parkPos[2] - approachFrom[2]) * ease;
      rot = Math.atan2(parkPos[0] - approachFrom[0], parkPos[2] - approachFrom[2]);
    } else if (phase < 0.75) {
      // Parked & idling (15-75%)
      x = parkPos[0]; y = idle; z = parkPos[2]; rot = parkRotation;
    } else if (phase < 0.9) {
      // Departing (75-90%)
      const p = (phase - 0.75) / 0.15;
      const ease = p * p * (3 - 2 * p);
      x = parkPos[0] + (departTo[0] - parkPos[0]) * ease;
      y = idle;
      z = parkPos[2] + (departTo[2] - parkPos[2]) * ease;
      rot = Math.atan2(departTo[0] - parkPos[0], departTo[2] - parkPos[2]);
    } else {
      // Offscreen, about to return (90-100%)
      const p = (phase - 0.9) / 0.1;
      const ease = p * p * (3 - 2 * p);
      x = approachFrom[0] + (departTo[0] - approachFrom[0]) * (1 - ease);
      y = idle; z = approachFrom[2]; rot = parkRotation;
      // Hide offscreen during transition
      x = approachFrom[0]; z = approachFrom[2];
    }

    wrapperRef.current.position.set(x, y, z);
    wrapperRef.current.rotation.y = rot;

    // Headlights on when moving
    const moving = phase < 0.15 || (phase >= 0.75 && phase < 0.9);
    if (headlightLRef.current) {
      (headlightLRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = moving ? 0.8 : 0.2;
    }
    if (headlightRRef.current) {
      (headlightRRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = moving ? 0.8 : 0.2;
    }
  });

  return (
    <group ref={wrapperRef}>
      <TruckBody cabColor={cabColor} cargoColor={cargoColor} headlightLRef={headlightLRef} headlightRRef={headlightRRef} />
    </group>
  );
};

/* ── Truck Body (static geometry, no animation) ── */
const TruckBody: React.FC<{
  cabColor: string;
  cargoColor: string;
  headlightLRef: React.RefObject<THREE.Mesh | null>;
  headlightRRef: React.RefObject<THREE.Mesh | null>;
}> = ({ cabColor, cargoColor, headlightLRef, headlightRRef }) => {

  return (
    <group>
      <group>
        {/* Chassis */}
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[1.4, 0.08, 4.0]} />
          <meshStandardMaterial color="#1f2937" {...S} />
        </mesh>
        {/* Cab lower */}
        <mesh position={[0, 0.55, 1.5]} castShadow>
          <boxGeometry args={[1.4, 0.5, 1.0]} />
          <meshStandardMaterial color={cabColor} metalness={0.5} roughness={0.35} />
        </mesh>
        {/* Cab upper */}
        <mesh position={[0, 0.95, 1.4]} castShadow>
          <boxGeometry args={[1.35, 0.3, 0.85]} />
          <meshStandardMaterial color={cabColor} metalness={0.5} roughness={0.35} />
        </mesh>
        {/* Roof */}
        <mesh position={[0, 1.12, 1.35]}>
          <boxGeometry args={[1.4, 0.04, 0.9]} />
          <meshStandardMaterial color={cabColor} metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Windshield */}
        <mesh position={[0, 0.85, 1.93]} rotation={[-0.15, 0, 0]}>
          <planeGeometry args={[1.15, 0.45]} />
          <meshStandardMaterial color="#93c5fd" transparent opacity={0.5} emissive="#60a5fa" emissiveIntensity={0.08} />
        </mesh>
        {/* Side windows */}
        {[-0.71, 0.71].map((x, i) => (
          <mesh key={`sw${i}`} position={[x, 0.85, 1.4]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.6, 0.35]} />
            <meshStandardMaterial color="#93c5fd" transparent opacity={0.35} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {/* Headlights */}
        <mesh ref={headlightLRef} position={[-0.5, 0.5, 2.01]}>
          <boxGeometry args={[0.2, 0.1, 0.02]} />
          <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={0.5} />
        </mesh>
        <mesh ref={headlightRRef} position={[0.5, 0.5, 2.01]}>
          <boxGeometry args={[0.2, 0.1, 0.02]} />
          <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={0.5} />
        </mesh>
        {/* Tail lights */}
        {[-0.55, 0.55].map((x, i) => (
          <mesh key={`tl${i}`} position={[x, 0.5, -1.99]}>
            <boxGeometry args={[0.15, 0.08, 0.02]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
          </mesh>
        ))}
        {/* Mirrors */}
        {[-0.8, 0.8].map((x, i) => (
          <group key={`mir${i}`}>
            <mesh position={[x, 0.85, 1.7]}>
              <boxGeometry args={[0.03, 0.02, 0.15]} />
              <meshStandardMaterial color="#374151" {...S} />
            </mesh>
            <mesh position={[x + (x > 0 ? 0.04 : -0.04), 0.85, 1.75]}>
              <boxGeometry args={[0.02, 0.1, 0.08]} />
              <meshStandardMaterial color="#374151" {...S} />
            </mesh>
          </group>
        ))}
        {/* Bumper */}
        <mesh position={[0, 0.28, 2.05]}>
          <boxGeometry args={[1.5, 0.12, 0.06]} />
          <meshStandardMaterial color="#4b5563" {...S} />
        </mesh>
        {/* Cargo floor */}
        <mesh position={[0, 0.3, -0.4]} castShadow>
          <boxGeometry args={[1.5, 0.06, 2.8]} />
          <meshStandardMaterial color="#6b7280" {...S} />
        </mesh>
        {/* Cargo walls */}
        {[-0.75, 0.75].map((x, i) => (
          <mesh key={`cw${i}`} position={[x, 0.85, -0.4]} castShadow>
            <boxGeometry args={[0.04, 1.05, 2.8]} />
            <meshStandardMaterial color={cargoColor} roughness={0.6} metalness={0.2} />
          </mesh>
        ))}
        <mesh position={[0, 0.85, 0.95]} castShadow>
          <boxGeometry args={[1.5, 1.05, 0.04]} />
          <meshStandardMaterial color={cargoColor} roughness={0.6} metalness={0.2} />
        </mesh>
        {/* Cargo roof */}
        <mesh position={[0, 1.38, -0.4]}>
          <boxGeometry args={[1.54, 0.04, 2.84]} />
          <meshStandardMaterial color={cargoColor} roughness={0.6} metalness={0.2} />
        </mesh>
        {/* Rear doors (open) */}
        <mesh position={[-0.4, 0.85, -1.82]} rotation={[0, 0.15, 0]} castShadow>
          <boxGeometry args={[0.7, 1.0, 0.04]} />
          <meshStandardMaterial color={cargoColor} roughness={0.6} metalness={0.2} />
        </mesh>
        <mesh position={[0.4, 0.85, -1.85]} rotation={[0, -0.1, 0]} castShadow>
          <boxGeometry args={[0.7, 1.0, 0.04]} />
          <meshStandardMaterial color={cargoColor} roughness={0.6} metalness={0.2} />
        </mesh>
        {/* Logo stripe */}
        {[-0.76, 0.76].map((x, i) => (
          <mesh key={`str${i}`} position={[x, 0.7, -0.4]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[2.7, 0.12]} />
            <meshStandardMaterial color={cabColor} emissive={cabColor} emissiveIntensity={0.1} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {/* Wheels: 2 front, 4 rear dual */}
        {[-0.65, 0.65].map((x, i) => (
          <group key={`fw${i}`} position={[x, 0.15, 1.3]}>
            <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.18, 0.18, 0.12, 12]} /><meshStandardMaterial color="#1f2937" roughness={0.95} metalness={0.05} /></mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 0.13, 8]} /><meshStandardMaterial color="#9ca3af" {...S} /></mesh>
          </group>
        ))}
        {[-0.8, -1.2].map((z) =>
          [-0.6, -0.72, 0.6, 0.72].map((x, i) => (
            <mesh key={`rw${z}${i}`} position={[x, 0.15, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.18, 0.18, 0.08, 12]} />
              <meshStandardMaterial color="#1f2937" roughness={0.95} metalness={0.05} />
            </mesh>
          ))
        )}
      </group>
    </group>
  );
};

/* ── Animated Forklift ── */
const AnimatedForklift: React.FC<{ center: [number, number, number]; pathRadius?: number }> = ({
  center, pathRadius = 2.5,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const forkRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.3;
    if (groupRef.current) {
      const phase = t % 4;
      let x: number, z: number, rot: number;
      if (phase < 1) {
        x = center[0] + phase * pathRadius; z = center[2] + 1.5; rot = -Math.PI / 2;
      } else if (phase < 1.5) {
        const p = (phase - 1) * 2;
        x = center[0] + pathRadius; z = center[2] + 1.5 - p * 3; rot = -Math.PI / 2 - p * Math.PI / 2;
      } else if (phase < 2.5) {
        const p = phase - 1.5;
        x = center[0] + pathRadius - p * pathRadius; z = center[2] - 1.5; rot = Math.PI;
      } else if (phase < 3) {
        const p = (phase - 2.5) * 2;
        x = center[0]; z = center[2] - 1.5 + p * 3; rot = Math.PI + p * Math.PI / 2;
      } else {
        x = center[0]; z = center[2] + 1.5; rot = -Math.PI / 2;
      }
      groupRef.current.position.set(x, 0, z);
      groupRef.current.rotation.y = rot;
    }
    if (forkRef.current) {
      const lp = (t * 2) % 4;
      forkRef.current.position.y = lp < 1 ? lp * 0.3 : lp < 3 ? 0.3 : 0.3 - (lp - 3) * 0.3;
    }
    if (beaconRef.current) {
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(clock.elapsedTime * 6) > 0 ? 1.0 : 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[0.8, 0.55, 1.0]} /><meshStandardMaterial color="#f59e0b" roughness={0.35} metalness={0.3} /></mesh>
      <mesh position={[0, 0.35, -0.55]} castShadow><boxGeometry args={[0.75, 0.4, 0.15]} /><meshStandardMaterial color="#374151" metalness={0.6} roughness={0.4} /></mesh>
      {[[-0.35, -0.4], [0.35, -0.4], [-0.35, 0.4], [0.35, 0.4]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.9, z]}><cylinderGeometry args={[0.025, 0.025, 0.5, 4]} /><meshStandardMaterial color="#374151" {...S} /></mesh>
      ))}
      <mesh position={[0, 1.15, 0]}><boxGeometry args={[0.8, 0.04, 1.0]} /><meshStandardMaterial color="#374151" {...S} /></mesh>
      <mesh position={[0, 0.55, -0.1]}><boxGeometry args={[0.3, 0.15, 0.3]} /><meshStandardMaterial color="#1f2937" roughness={0.8} /></mesh>
      <mesh position={[0, 0.65, 0.25]} rotation={[-0.6, 0, 0]}><torusGeometry args={[0.08, 0.012, 4, 12]} /><meshStandardMaterial color="#1f2937" roughness={0.7} /></mesh>
      {[-0.2, 0.2].map((x, i) => (
        <mesh key={`m${i}`} position={[x, 0.65, 0.55]}><boxGeometry args={[0.05, 1.1, 0.05]} /><meshStandardMaterial color="#374151" {...S} /></mesh>
      ))}
      <group ref={forkRef}>
        <mesh position={[0, 0.2, 0.6]}><boxGeometry args={[0.45, 0.12, 0.06]} /><meshStandardMaterial color="#6b7280" {...S} /></mesh>
        {[-0.15, 0.15].map((x, i) => (
          <mesh key={`f${i}`} position={[x, 0.1, 0.9]}><boxGeometry args={[0.08, 0.03, 0.6]} /><meshStandardMaterial color="#9ca3af" {...S} /></mesh>
        ))}
        <mesh position={[0, 0.2, 0.85]}><boxGeometry args={[0.45, 0.04, 0.45]} /><meshStandardMaterial color="#92400e" roughness={0.9} /></mesh>
        <mesh position={[0, 0.35, 0.85]}><boxGeometry args={[0.4, 0.2, 0.4]} /><meshStandardMaterial color="#bfdbfe" transparent opacity={0.35} /></mesh>
      </group>
      {[[-0.35, -0.35], [0.35, -0.35], [-0.25, 0.4], [0.25, 0.4]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.12, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.12, 0.12, 0.08, 10]} /><meshStandardMaterial color="#1f2937" roughness={0.9} /></mesh>
      ))}
      <mesh ref={beaconRef} position={[0.25, 1.2, -0.3]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} /></mesh>
    </group>
  );
};

/* ── Bulk Silo ── */
const BulkSilo: React.FC<{ position: [number, number, number]; height?: number; color?: string }> = ({
  position, height = 2.5, color = "#71717a",
}) => (
  <group position={position}>
    <mesh position={[0, height / 2, 0]} castShadow><cylinderGeometry args={[0.5, 0.5, height, 12]} /><meshStandardMaterial color={color} {...S} /></mesh>
    <mesh position={[0, height + 0.15, 0]}><coneGeometry args={[0.52, 0.3, 12]} /><meshStandardMaterial color={color} {...S} /></mesh>
    <mesh position={[0, 0.15, 0]}><coneGeometry args={[0.2, 0.3, 10]} /><meshStandardMaterial color="#52525b" {...S} /></mesh>
    {[0.5, 1.0, 1.5, 2.0].filter(y => y < height).map((y, i) => (
      <mesh key={i} position={[0, y, 0]}><torusGeometry args={[0.51, 0.015, 4, 12]} /><meshStandardMaterial color="#52525b" metalness={0.9} roughness={0.1} /></mesh>
    ))}
    {[[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0, z]}><boxGeometry args={[0.05, 0.3, 0.05]} /><meshStandardMaterial color="#374151" {...S} /></mesh>
    ))}
    <mesh position={[0.52, height * 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.02, 0.02, height * 0.5, 6]} />
      <meshStandardMaterial color="#22c55e" transparent opacity={0.5} emissive="#22c55e" emissiveIntensity={0.3} />
    </mesh>
  </group>
);

/* ── Screw Conveyor ── */
const ScrewConveyor: React.FC<{ from: [number, number, number]; to: [number, number, number] }> = ({ from, to }) => {
  const screwRef = useRef<THREE.Mesh>(null);
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const mx = (from[0] + to[0]) / 2, my = (from[1] + to[1]) / 2, mz = (from[2] + to[2]) / 2;
  const rotY = Math.atan2(dx, dz);
  const rotX = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
  useFrame(({ clock }) => { if (screwRef.current) screwRef.current.rotation.y = clock.elapsedTime * 3; });
  return (
    <group>
      <mesh position={[mx, my, mz]} rotation={[rotX, rotY, 0]}><cylinderGeometry args={[0.08, 0.08, len, 8, 1, true]} /><meshStandardMaterial color="#6b7280" {...S} transparent opacity={0.6} side={THREE.DoubleSide} /></mesh>
      <mesh ref={screwRef} position={[mx, my, mz]} rotation={[rotX, rotY, 0]}><cylinderGeometry args={[0.06, 0.06, len - 0.1, 6]} /><meshStandardMaterial color="#a1a1aa" metalness={0.9} roughness={0.1} /></mesh>
      <mesh position={from}><cylinderGeometry args={[0.1, 0.1, 0.15, 8]} /><meshStandardMaterial color="#059669" metalness={0.6} roughness={0.3} /></mesh>
      <mesh position={from}><sphereGeometry args={[0.09, 8, 8]} /><meshStandardMaterial color="#6b7280" {...S} /></mesh>
      <mesh position={to}><sphereGeometry args={[0.09, 8, 8]} /><meshStandardMaterial color="#6b7280" {...S} /></mesh>
    </group>
  );
};

/* ── Pellet Stream ── */
const PelletStream: React.FC<{ from: [number, number, number]; to: [number, number, number] }> = ({ from, to }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 12;
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    for (let i = 0; i < COUNT; i++) {
      const progress = ((clock.elapsedTime * 0.5 + i / COUNT) % 1);
      tempMatrix.makeTranslation(
        from[0] + (to[0] - from[0]) * progress,
        from[1] + (to[1] - from[1]) * progress - Math.sin(progress * Math.PI) * 0.1,
        from[2] + (to[2] - from[2]) * progress,
      );
      ref.current.setMatrixAt(i, tempMatrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[0.025, 4, 4]} />
      <meshStandardMaterial color="#e2e8f0" roughness={0.8} metalness={0.05} />
    </instancedMesh>
  );
};

/* ── Main ── */
const MaterialSourceDest3D: React.FC = () => {
  const intake = STAGE_POSITIONS.intake;

  return (
    <group>
      {/* ══ RAW MATERIAL DELIVERY ══ */}
      {/* Tallest silo painted Pepsi blue so the brand is visible behind the
          intake stage. The other two stay grey/tan for visual variety. */}
      <BulkSilo position={[intake[0] - 2.0, 0, intake[2] - 2.0]} height={2.8} color="#004B93" />
      <BulkSilo position={[intake[0] - 0.5, 0, intake[2] - 2.0]} height={2.2} color="#78716c" />
      <BulkSilo position={[intake[0] + 1.0, 0, intake[2] - 2.0]} height={1.8} color="#6b7280" />
      {/* Silo bands */}
      <mesh position={[intake[0] - 2.0, 1.8, intake[2] - 2.0]}><torusGeometry args={[0.52, 0.03, 4, 12]} /><meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.2} /></mesh>
      <mesh position={[intake[0] - 0.5, 1.4, intake[2] - 2.0]}><torusGeometry args={[0.52, 0.03, 4, 12]} /><meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.2} /></mesh>
      <mesh position={[intake[0] + 1.0, 1.2, intake[2] - 2.0]}><torusGeometry args={[0.52, 0.03, 4, 12]} /><meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.2} /></mesh>
      <ScrewConveyor from={[intake[0] - 2.0, 0.3, intake[2] - 1.5]} to={[intake[0], 0.8, intake[2] - 0.8]} />
      <PelletStream from={[intake[0], 1.2, intake[2] - 0.8]} to={[intake[0], 0.5, intake[2] - 0.3]} />
      <mesh position={[intake[0] - 2.8, 1.5, intake[2] + 1.0]} rotation={[Math.PI / 4, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 3.5, 6]} /><meshStandardMaterial color="#94a3b8" {...S} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[intake[0] - 1.5, 0.006, intake[2] + 0.5]}>
        <planeGeometry args={[6, 5]} /><meshBasicMaterial color="#3b82f6" transparent opacity={0.03} />
      </mesh>

      {/* ══ DISPATCH ══
          Removed the off-floor truck-loading bay (truck, forklift, staged
          pallets) — they sat outside the factory floor and looked detached.
          The dispatch stage's own palletizer + Pepsi crates inside the factory
          floor (rendered by StageEquipment3D) tell the shipping story now. */}

      {/* ══ SIGNS ══ */}
      {[
        { pos: [intake[0] - 1.5, 3.0, intake[2] + 0.5] as [number, number, number], color: "#3b82f6" },
      ].map(({ pos, color }, i) => (
        <group key={`sign-${i}`} position={pos}>
          <mesh><boxGeometry args={[1.5, 0.3, 0.04]} /><meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.7} /></mesh>
          <mesh position={[0, 0, 0.025]}><planeGeometry args={[1.4, 0.2]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} /></mesh>
          {[-0.65, 0.65].map((x, j) => (
            <mesh key={j} position={[x, -1.5, 0]}><cylinderGeometry args={[0.02, 0.02, 3.0, 4]} /><meshStandardMaterial color="#6b7280" {...S} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
};

export default MaterialSourceDest3D;
