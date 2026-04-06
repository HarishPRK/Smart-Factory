"use no memo";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ZoneId } from "../../types";

interface ZoneFloorProps {
  selectedZone: ZoneId | "all";
}

/* ── Concrete Floor ──────────────────────────────────── */

const ConcreteFloor: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0.5]} receiveShadow>
    <planeGeometry args={[28, 16]} />
    <meshStandardMaterial color="#3a3a3a" roughness={0.95} metalness={0.05} />
  </mesh>
);

/* ── Safety Line (yellow floor marking) ──────────────── */

const SafetyLine: React.FC<{ points: [number, number][]; width?: number }> = ({ points, width = 0.08 }) => (
  <group>
    {points.slice(1).map((p, i) => {
      const prev = points[i];
      const dx = p[0] - prev[0];
      const dz = p[1] - prev[1];
      const len = Math.sqrt(dx * dx + dz * dz);
      const cx = (prev[0] + p[0]) / 2;
      const cz = (prev[1] + p[1]) / 2;
      const angle = Math.atan2(dx, dz);
      return (
        <mesh key={i} position={[cx, 0.005, cz]} rotation={[-Math.PI / 2, 0, -angle]}>
          <planeGeometry args={[width, len]} />
          <meshBasicMaterial color="#d4a017" transparent opacity={0.7} />
        </mesh>
      );
    })}
  </group>
);

/* ── Zone Floor Plate ────────────────────────────────── */

const ZonePlate: React.FC<{
  zoneId: ZoneId;
  cx: number;
  cz: number;
  w: number;
  d: number;
  selected: boolean;
}> = ({ cx, cz, w, d, selected }) => {
  const borderRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (borderRef.current) {
      const mat = borderRef.current.material as THREE.MeshBasicMaterial;
      const target = selected ? 0.35 : 0.08;
      mat.opacity += (target - mat.opacity) * 0.06;
    }
  });

  return (
    <group position={[cx, 0, cz]}>
      {/* Slightly raised zone plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
        <planeGeometry args={[w - 0.3, d - 0.3]} />
        <meshStandardMaterial color="#444444" roughness={0.9} metalness={0.08} />
      </mesh>
      {/* Zone border */}
      <mesh ref={borderRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
        <ringGeometry args={[Math.min(w, d) / 2 - 0.5, Math.min(w, d) / 2 - 0.35, 4]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.08} />
      </mesh>
    </group>
  );
};

/* ── Safety Barriers (yellow/black posts) ────────────── */

const SafetyPost: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    {/* Post */}
    <mesh position={[0, 0.35, 0]}>
      <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
      <meshStandardMaterial color="#d4a017" metalness={0.5} roughness={0.4} />
    </mesh>
    {/* Black stripe */}
    <mesh position={[0, 0.45, 0]}>
      <cylinderGeometry args={[0.045, 0.045, 0.12, 8]} />
      <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.6} />
    </mesh>
    {/* Base plate */}
    <mesh position={[0, 0.01, 0]}>
      <cylinderGeometry args={[0.08, 0.08, 0.02, 8]} />
      <meshStandardMaterial color="#555" metalness={0.6} roughness={0.3} />
    </mesh>
  </group>
);

/* ── Main Component ──────────────────────────────────── */

const ZONE_CONFIG: { id: ZoneId; cx: number; cz: number; w: number; d: number }[] = [
  { id: 1, cx: -7, cz: 0.5, w: 8, d: 12 },
  { id: 2, cx: 0, cz: 0.5, w: 8, d: 12 },
  { id: 3, cx: 7, cz: 0.5, w: 8, d: 12 },
];

const ZoneFloor: React.FC<ZoneFloorProps> = ({ selectedZone }) => {
  return (
    <group>
      <ConcreteFloor />

      {/* Zone plates */}
      {ZONE_CONFIG.map((z) => (
        <ZonePlate
          key={z.id}
          zoneId={z.id}
          cx={z.cx}
          cz={z.cz}
          w={z.w}
          d={z.d}
          selected={selectedZone === "all" || selectedZone === z.id}
        />
      ))}

      {/* Yellow safety lines — zone dividers */}
      {[-3.5, 3.5].map((x) => (
        <SafetyLine key={x} points={[[x, -5], [x, 6.5]]} width={0.06} />
      ))}

      {/* Yellow safety perimeter */}
      <SafetyLine points={[[-11.5, -5.5], [11.5, -5.5], [11.5, 6.5], [-11.5, 6.5], [-11.5, -5.5]]} width={0.1} />

      {/* Walkway lines (dashed effect via segments) */}
      {Array.from({ length: 20 }).map((_, i) => {
        const x = -10 + i * 1.1;
        return (
          <mesh key={`walk-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.004, -4.5]}>
            <planeGeometry args={[0.5, 0.06]} />
            <meshBasicMaterial color="#d4a017" transparent opacity={0.4} />
          </mesh>
        );
      })}

      {/* Safety posts along walkway */}
      {[-10, -6, -2, 2, 6, 10].map((x) => (
        <SafetyPost key={x} position={[x, 0, -5]} />
      ))}

      {/* Corner safety posts */}
      {[[-11, -5], [11, -5], [-11, 6.5], [11, 6.5]].map(([x, z], i) => (
        <SafetyPost key={`corner-${i}`} position={[x, 0, z]} />
      ))}
    </group>
  );
};

export default ZoneFloor;
