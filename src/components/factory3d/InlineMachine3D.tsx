"use no memo";
import React from "react";
import * as THREE from "three";

/**
 * In-line machines that the conveyor belt threads THROUGH (rather than
 * sitting beside the belt). Belt enters local -Z, exits local +Z. The
 * caller computes position + rotationY from the conveyor curve so each
 * tunnel is perfectly aligned with the belt direction at its conveyorT.
 *
 * Local coordinate convention (after applying rotationY around world Y):
 *   +Z = downstream belt direction
 *   ±X = perpendicular to belt (sides)
 *   +Y = up
 *
 * Position should be at world belt height (y ≈ 0.5) so local y=0 is at
 * belt level — both side walls rise straight up from the belt surface.
 */

interface TunnelProps {
  position: [number, number, number];
  rotationY: number;
}

/* ── Blow Molder Tunnel (forming stage) ── */
export const BlowMolderTunnel: React.FC<TunnelProps> = ({ position, rotationY }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    {/* Side walls — outside belt's ~0.7-unit width so the belt passes through cleanly */}
    {[-0.6, 0.6].map((x, i) => (
      <mesh key={`wall-${i}`} position={[x, 0.7, 0]} castShadow>
        <boxGeometry args={[0.1, 1.4, 3.0]} />
        <meshStandardMaterial color="#1e40af" metalness={0.7} roughness={0.3} />
      </mesh>
    ))}

    {/* Top roof */}
    <mesh position={[0, 1.5, 0]} castShadow>
      <boxGeometry args={[1.4, 0.1, 3.0]} />
      <meshStandardMaterial color="#1e40af" metalness={0.7} roughness={0.3} />
    </mesh>

    {/* Lintels above the open ends (front + back) */}
    {[-1.55, 1.55].map((z, i) => (
      <mesh key={`lintel-${i}`} position={[0, 1.4, z]}>
        <boxGeometry args={[1.45, 0.18, 0.12]} />
        <meshStandardMaterial color="#1e3a8a" metalness={0.7} roughness={0.3} />
      </mesh>
    ))}

    {/* Tie bars — 4 vertical rods at the corners */}
    {[
      [-0.55, -1.3],
      [0.55, -1.3],
      [-0.55, 1.3],
      [0.55, 1.3],
    ].map(([x, z], i) => (
      <mesh key={`tie-${i}`} position={[x, 0.7, z]}>
        <cylinderGeometry args={[0.04, 0.04, 1.5, 8]} />
        <meshStandardMaterial color="#e4e4e7" metalness={0.95} roughness={0.05} />
      </mesh>
    ))}

    {/* Hydraulic rams on top — 4 vertical cylinders above the roof */}
    {[
      [-0.4, -0.9],
      [0.4, -0.9],
      [-0.4, 0.9],
      [0.4, 0.9],
    ].map(([x, z], i) => (
      <group key={`ram-${i}`} position={[x, 1.85, z]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.5, 12]} />
          <meshStandardMaterial color="#a1a1aa" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Inner shaft */}
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.5, 8]} />
          <meshStandardMaterial color="#e4e4e7" metalness={0.95} roughness={0.05} />
        </mesh>
      </group>
    ))}

    {/* Internal blue glow strip — visible through open ends, looks like the
        mold heating up */}
    <mesh position={[0, 1.4, 0]}>
      <boxGeometry args={[1.0, 0.04, 2.7]} />
      <meshStandardMaterial color="#60a5fa" emissive="#3b82f6" emissiveIntensity={0.9} />
    </mesh>

    {/* Yellow safety stripes near the bottom of each side wall */}
    {[-0.61, 0.61].map((x, i) => (
      <mesh key={`stripe-${i}`} position={[x, 0.15, 0]}>
        <boxGeometry args={[0.025, 0.06, 2.85]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} />
      </mesh>
    ))}

    {/* "Active" status sphere on top */}
    <mesh position={[0, 2.4, 0]}>
      <sphereGeometry args={[0.07, 10, 10]} />
      <meshStandardMaterial
        color="#60a5fa"
        emissive="#3b82f6"
        emissiveIntensity={1.0}
      />
    </mesh>

    {/* Pipe stub on top (compressed-air feed for blow molding) */}
    <mesh position={[0, 1.7, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
      <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
    </mesh>

    {/* Identifier plate on the side */}
    <mesh position={[0.66, 0.85, 0]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[0.6, 0.18]} />
      <meshStandardMaterial
        color="#0f172a"
        emissive="#3b82f6"
        emissiveIntensity={0.4}
      />
    </mesh>
  </group>
);

/* ── Cooling Tunnel (curing stage) ── */
export const CoolingTunnelInline: React.FC<TunnelProps> = ({ position, rotationY }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    {/* Side walls */}
    {[-0.6, 0.6].map((x, i) => (
      <mesh key={`wall-${i}`} position={[x, 0.7, 0]} castShadow>
        <boxGeometry args={[0.1, 1.4, 3.5]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.4} />
      </mesh>
    ))}

    {/* Top roof — slightly darker than walls, with a raised exhaust spine */}
    <mesh position={[0, 1.5, 0]} castShadow>
      <boxGeometry args={[1.4, 0.1, 3.5]} />
      <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.4} />
    </mesh>

    {/* Lintels above the open ends */}
    {[-1.8, 1.8].map((z, i) => (
      <mesh key={`lintel-${i}`} position={[0, 1.4, z]}>
        <boxGeometry args={[1.45, 0.18, 0.12]} />
        <meshStandardMaterial color="#0c4a6e" metalness={0.7} roughness={0.3} />
      </mesh>
    ))}

    {/* Cooling fan grilles — 3 per side wall, facing outward */}
    {[-0.66, 0.66].map((x, side) =>
      [-1.0, 0, 1.0].map((z, fi) => (
        <mesh
          key={`fan-${side}-${fi}`}
          position={[x, 0.85, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <circleGeometry args={[0.22, 12]} />
          <meshStandardMaterial
            color="#94a3b8"
            metalness={0.6}
            roughness={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      )),
    )}

    {/* Tie bars — 4 vertical rods at corners */}
    {[
      [-0.55, -1.5],
      [0.55, -1.5],
      [-0.55, 1.5],
      [0.55, 1.5],
    ].map(([x, z], i) => (
      <mesh key={`tie-${i}`} position={[x, 0.7, z]}>
        <cylinderGeometry args={[0.035, 0.035, 1.5, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>
    ))}

    {/* Internal cyan glow strip on the ceiling — "cooling lights" */}
    <mesh position={[0, 1.4, 0]}>
      <boxGeometry args={[1.0, 0.04, 3.2]} />
      <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={0.9} />
    </mesh>
    {/* Floor glow — gives "cool light from below" look */}
    <mesh position={[0, 0.06, 0]}>
      <boxGeometry args={[1.0, 0.01, 3.2]} />
      <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={0.5} />
    </mesh>

    {/* Exhaust stack on top */}
    <mesh position={[0, 2.0, 0]} castShadow>
      <cylinderGeometry args={[0.18, 0.15, 0.5, 10]} />
      <meshStandardMaterial color="#52525b" metalness={0.8} roughness={0.2} />
    </mesh>
    <mesh position={[0, 2.3, 0]}>
      <cylinderGeometry args={[0.22, 0.22, 0.05, 10]} />
      <meshStandardMaterial color="#27272a" metalness={0.85} roughness={0.15} />
    </mesh>

    {/* Status sphere on top */}
    <mesh position={[0, 2.5, 0]}>
      <sphereGeometry args={[0.07, 10, 10]} />
      <meshStandardMaterial
        color="#22d3ee"
        emissive="#06b6d4"
        emissiveIntensity={1.0}
      />
    </mesh>

    {/* Identifier plate */}
    <mesh position={[0.66, 0.85, 0]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[0.6, 0.18]} />
      <meshStandardMaterial
        color="#0f172a"
        emissive="#06b6d4"
        emissiveIntensity={0.4}
      />
    </mesh>
  </group>
);
