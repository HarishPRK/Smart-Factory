"use no memo";
import React from "react";
import * as THREE from "three";

/**
 * In-line machines that the conveyor belt threads THROUGH.
 * Belt enters local -Z, exits local +Z. The caller computes
 * position + rotationY from the conveyor curve so each tunnel
 * aligns perfectly with the belt direction at its conveyorT.
 */

interface TunnelProps {
  position: [number, number, number];
  rotationY: number;
}

/* ── Blow Molder Tunnel (forming stage) ──
   Open skeletal frame — 4 corner posts + top cross beams + hydraulic rams.
   NOT solid walls — you can see the belt and bottles through the frame. */
export const BlowMolderTunnel: React.FC<TunnelProps> = ({ position, rotationY }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    {/* 4 corner posts */}
    {[
      [-0.5, -0.8],
      [0.5, -0.8],
      [-0.5, 0.8],
      [0.5, 0.8],
    ].map(([x, z], i) => (
      <mesh key={`post-${i}`} position={[x, 0.55, z]} castShadow>
        <boxGeometry args={[0.06, 1.1, 0.06]} />
        <meshStandardMaterial color="#1e40af" metalness={0.7} roughness={0.3} />
      </mesh>
    ))}

    {/* Top cross beams (X direction) — front + back */}
    {[-0.8, 0.8].map((z, i) => (
      <mesh key={`xbeam-${i}`} position={[0, 1.15, z]}>
        <boxGeometry args={[1.1, 0.06, 0.06]} />
        <meshStandardMaterial color="#1e40af" metalness={0.7} roughness={0.3} />
      </mesh>
    ))}
    {/* Top cross beams (Z direction) — left + right */}
    {[-0.5, 0.5].map((x, i) => (
      <mesh key={`zbeam-${i}`} position={[x, 1.15, 0]}>
        <boxGeometry args={[0.06, 0.06, 1.7]} />
        <meshStandardMaterial color="#1e40af" metalness={0.7} roughness={0.3} />
      </mesh>
    ))}

    {/* 2 hydraulic rams on top */}
    {[-0.25, 0.25].map((x, i) => (
      <group key={`ram-${i}`} position={[x, 1.5, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.5, 10]} />
          <meshStandardMaterial color="#a1a1aa" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.45, 6]} />
          <meshStandardMaterial color="#e4e4e7" metalness={0.95} roughness={0.05} />
        </mesh>
      </group>
    ))}

    {/* Internal blue glow strip on ceiling */}
    <mesh position={[0, 1.1, 0]}>
      <boxGeometry args={[0.8, 0.02, 1.4]} />
      <meshStandardMaterial color="#60a5fa" emissive="#3b82f6" emissiveIntensity={0.9} />
    </mesh>

    {/* Yellow safety stripes on the two front/back bottom edges */}
    {[-0.82, 0.82].map((z, i) => (
      <mesh key={`stripe-${i}`} position={[0, 0.04, z]}>
        <boxGeometry args={[1.05, 0.04, 0.04]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} />
      </mesh>
    ))}

    {/* Status sphere on top */}
    <mesh position={[0, 2.0, 0]}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshStandardMaterial color="#60a5fa" emissive="#3b82f6" emissiveIntensity={1.0} />
    </mesh>

    {/* Air pipe stub */}
    <mesh position={[0.55, 0.9, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.04, 0.04, 0.3, 6]} />
      <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
    </mesh>
  </group>
);

/* ── Cooling Tunnel (curing stage) ──
   Compact enclosed tunnel with open front/back. Belt runs through the middle. */
export const CoolingTunnelInline: React.FC<TunnelProps> = ({ position, rotationY }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    {/* Side walls */}
    {[-0.5, 0.5].map((x, i) => (
      <mesh key={`wall-${i}`} position={[x, 0.5, 0]} castShadow>
        <boxGeometry args={[0.08, 1.0, 2.0]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.4} />
      </mesh>
    ))}

    {/* Roof */}
    <mesh position={[0, 1.05, 0]} castShadow>
      <boxGeometry args={[1.1, 0.08, 2.0]} />
      <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.4} />
    </mesh>

    {/* Corner posts for strength */}
    {[
      [-0.45, -0.9],
      [0.45, -0.9],
      [-0.45, 0.9],
      [0.45, 0.9],
    ].map(([x, z], i) => (
      <mesh key={`tp-${i}`} position={[x, 0.5, z]}>
        <cylinderGeometry args={[0.03, 0.03, 1.0, 6]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>
    ))}

    {/* Fan grilles — 2 per side */}
    {[-0.55, 0.55].map((x) =>
      [-0.4, 0.4].map((z, fi) => (
        <mesh
          key={`fan-${x}-${fi}`}
          position={[x, 0.6, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <circleGeometry args={[0.18, 10]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
      )),
    )}

    {/* Ceiling cyan glow strip */}
    <mesh position={[0, 1.0, 0]}>
      <boxGeometry args={[0.8, 0.02, 1.8]} />
      <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={0.9} />
    </mesh>
    {/* Floor glow */}
    <mesh position={[0, 0.04, 0]}>
      <boxGeometry args={[0.8, 0.01, 1.8]} />
      <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={0.5} />
    </mesh>

    {/* Exhaust stack */}
    <mesh position={[0, 1.4, 0]} castShadow>
      <cylinderGeometry args={[0.12, 0.1, 0.4, 8]} />
      <meshStandardMaterial color="#52525b" metalness={0.8} roughness={0.2} />
    </mesh>
    <mesh position={[0, 1.65, 0]}>
      <cylinderGeometry args={[0.15, 0.15, 0.04, 8]} />
      <meshStandardMaterial color="#27272a" metalness={0.85} roughness={0.15} />
    </mesh>

    {/* Status sphere */}
    <mesh position={[0, 1.85, 0]}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={1.0} />
    </mesh>
  </group>
);
