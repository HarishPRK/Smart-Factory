"use no memo";
import React from "react";
import * as THREE from "three";

/**
 * FactoryInfrastructure3D — Ground-level industrial details
 *
 * Static geometry — zero per-frame cost.
 * Adds pipe racks, walkway markings, fire extinguishers, signage,
 * electrical conduit, drain grates, and safety equipment.
 */

const S = { metalness: 0.8, roughness: 0.2 };

/* ── Pipe Rack Section ── */
const PipeRack: React.FC<{ position: [number, number, number]; length: number; rotation?: number }> = ({
  position, length, rotation = 0,
}) => (
  <group position={position} rotation={[0, rotation, 0]}>
    {/* Uprights */}
    {[0, length].map((z, i) => (
      <group key={i}>
        <mesh position={[0, 0.5, z]}>
          <boxGeometry args={[0.05, 1.0, 0.05]} />
          <meshStandardMaterial color="#4b5563" {...S} />
        </mesh>
        <mesh position={[0.4, 0.5, z]}>
          <boxGeometry args={[0.05, 1.0, 0.05]} />
          <meshStandardMaterial color="#4b5563" {...S} />
        </mesh>
      </group>
    ))}
    {/* Cross beams */}
    {[0.3, 0.7].map((y, i) => (
      <mesh key={`beam${i}`} position={[0.2, y, length / 2]}>
        <boxGeometry args={[0.35, 0.03, length + 0.1]} />
        <meshStandardMaterial color="#6b7280" {...S} />
      </mesh>
    ))}
    {/* Pipes on rack — horizontal along Z axis */}
    <mesh position={[0.1, 0.35, length / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.025, 0.025, length + 0.2, 6]} />
      <meshStandardMaterial color="#ef4444" {...S} />
    </mesh>
    <mesh position={[0.2, 0.35, length / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.02, 0.02, length + 0.2, 6]} />
      <meshStandardMaterial color="#3b82f6" {...S} />
    </mesh>
    <mesh position={[0.3, 0.35, length / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.015, 0.015, length + 0.2, 6]} />
      <meshStandardMaterial color="#f59e0b" {...S} />
    </mesh>
    <mesh position={[0.15, 0.75, length / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.03, 0.03, length + 0.2, 6]} />
      <meshStandardMaterial color="#6b7280" {...S} />
    </mesh>
  </group>
);

/* ── Fire Extinguisher ── */
const FireExtinguisher: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 0.2, 0]} castShadow>
      <cylinderGeometry args={[0.04, 0.04, 0.35, 8]} />
      <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.4} />
    </mesh>
    <mesh position={[0, 0.4, 0]}>
      <cylinderGeometry args={[0.015, 0.015, 0.06, 6]} />
      <meshStandardMaterial color="#1f2937" {...S} />
    </mesh>
    <mesh position={[0, 0.42, 0.02]}>
      <boxGeometry args={[0.025, 0.04, 0.03]} />
      <meshStandardMaterial color="#1f2937" {...S} />
    </mesh>
    {/* Wall mount bracket */}
    <mesh position={[0, 0.2, -0.05]}>
      <boxGeometry args={[0.06, 0.12, 0.02]} />
      <meshStandardMaterial color="#374151" {...S} />
    </mesh>
  </group>
);

/* ── Floor Sign ── */
const FloorSign: React.FC<{ position: [number, number, number]; text?: string; color?: string }> = ({
  position, color = "#10b981",
}) => (
  <group position={position}>
    {/* Sign base */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
      <circleGeometry args={[0.2, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.15} />
    </mesh>
    {/* Arrow / direction indicator */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
      <coneGeometry args={[0.08, 0.15, 3]} />
      <meshBasicMaterial color={color} transparent opacity={0.25} />
    </mesh>
  </group>
);

const FactoryInfrastructure3D: React.FC = () => (
  <group>
    {/* Pipe racks removed — cluttered the view */}

    {/* ── Walkway markings — painted lanes on floor ── */}
    {/* Main walkway along Row 1 (front) */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 6.5]}>
      <planeGeometry args={[22, 0.04]} />
      <meshBasicMaterial color="#fbbf24" transparent opacity={0.3} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 6.0]}>
      <planeGeometry args={[22, 0.04]} />
      <meshBasicMaterial color="#fbbf24" transparent opacity={0.3} />
    </mesh>
    {/* Walkway between Row 1 and Row 2 */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 2]}>
      <planeGeometry args={[16, 0.04]} />
      <meshBasicMaterial color="#fbbf24" transparent opacity={0.25} />
    </mesh>
    {/* Walkway between Row 2 and Row 3 */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -2]}>
      <planeGeometry args={[16, 0.04]} />
      <meshBasicMaterial color="#fbbf24" transparent opacity={0.25} />
    </mesh>
    {/* Walkway along Row 3 (back) */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -6.0]}>
      <planeGeometry args={[22, 0.04]} />
      <meshBasicMaterial color="#fbbf24" transparent opacity={0.3} />
    </mesh>

    {/* ── Pedestrian crossing hatching ── */}
    {[[-7, 2], [-7, -2], [6, 2], [6, -2]].map(([x, z], i) => (
      <group key={`cross-${i}`}>
        {[0, 1, 2, 3].map((j) => (
          <mesh key={j} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.004, z + j * 0.15 - 0.2]}>
            <planeGeometry args={[0.6, 0.06]} />
            <meshBasicMaterial color="#f8fafc" transparent opacity={0.2} />
          </mesh>
        ))}
      </group>
    ))}

    {/* ── Floor drainage grates ── */}
    {[[-3, 3], [3, 3], [0, -1], [-2, -5], [4, -5]].map(([x, z], i) => (
      <mesh key={`drain-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.003, z]}>
        <planeGeometry args={[0.4, 0.4]} />
        <meshStandardMaterial color="#2d3748" metalness={0.7} roughness={0.3} />
      </mesh>
    ))}

    {/* ── Fire Extinguishers ── */}
    <FireExtinguisher position={[-8, 0, 3]} />
    <FireExtinguisher position={[6, 0, 1.5]} />
    <FireExtinguisher position={[-6, 0, -3]} />
    <FireExtinguisher position={[8, 0, -3]} />

    {/* ── Floor direction signs ── */}
    <FloorSign position={[-7, 0, 5.5]} color="#10b981" />
    <FloorSign position={[5, 0, 1.5]} color="#3b82f6" />
    <FloorSign position={[-5, 0, -2.5]} color="#8b5cf6" />
    <FloorSign position={[7, 0, -5.5]} color="#10b981" />

    {/* ── Electrical Distribution Boxes (wall-mount style) ── */}
    {[
      [-9, 0.6, 3], [7.5, 0.6, -2], [-4, 0.6, -6],
    ].map(([x, y, z], i) => (
      <group key={`elec-${i}`} position={[x, y, z]}>
        <mesh castShadow>
          <boxGeometry args={[0.25, 0.35, 0.12]} />
          <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.08, 0.065]}>
          <planeGeometry args={[0.12, 0.06]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.15} />
        </mesh>
        {/* Warning triangle */}
        <mesh position={[0, -0.06, 0.065]}>
          <planeGeometry args={[0.06, 0.06]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.1} />
        </mesh>
        {/* Conduit pipe down */}
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.25, 6]} />
          <meshStandardMaterial color="#6b7280" {...S} />
        </mesh>
      </group>
    ))}

    {/* ── Safety bollards at row transitions ── */}
    {[
      [5.5, 2], [-5.5, -2], [5.5, -2],
    ].map(([x, z], i) => (
      <group key={`bollard-${i}`}>
        <mesh position={[x, 0.25, z]} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 0.5, 8]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Black stripe */}
        <mesh position={[x, 0.3, z]}>
          <torusGeometry args={[0.061, 0.015, 4, 8]} />
          <meshStandardMaterial color="#1f2937" roughness={0.8} metalness={0.1} />
        </mesh>
        {/* Base plate */}
        <mesh position={[x, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.1, 8]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
    ))}

    {/* Utility risers removed — cluttered the view */}
  </group>
);

export default FactoryInfrastructure3D;
