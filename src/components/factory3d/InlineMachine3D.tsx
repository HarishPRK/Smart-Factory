"use no memo";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
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
export const BlowMolderTunnel: React.FC<TunnelProps> = ({
  position,
  rotationY,
}) => {
  const upperDieRef1 = useRef<THREE.Group>(null);
  const upperDieRef2 = useRef<THREE.Group>(null);
  const ramRef1 = useRef<THREE.Group>(null);
  const ramRef2 = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Slow pressing cycle: 4 seconds per cycle for smoother motion
    const cycle = (t * 0.25) % 1.0;

    // Smooth easing function (ease-in-out cubic)
    const easeInOutCubic = (t: number) => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    // Pressing animation:
    // 0.0 - 0.3: descend (close mold) - smooth easing
    // 0.3 - 0.7: hold closed (molding happens)
    // 0.7 - 1.0: ascend (open mold) - smooth easing
    let yOffset = 0;
    if (cycle < 0.3) {
      // Descending with smooth easing
      const t = cycle / 0.3;
      const eased = easeInOutCubic(t);
      yOffset = -eased * 0.35; // 0 to -0.35 smoothly
    } else if (cycle < 0.7) {
      // Holding closed
      yOffset = -0.35;
    } else {
      // Ascending with smooth easing
      const t = (cycle - 0.7) / 0.3;
      const eased = easeInOutCubic(t);
      yOffset = -0.35 + eased * 0.35; // -0.35 to 0 smoothly
    }

    if (upperDieRef1.current) upperDieRef1.current.position.y = 0.85 + yOffset;
    if (upperDieRef2.current) upperDieRef2.current.position.y = 0.85 + yOffset;
    if (ramRef1.current) ramRef1.current.position.y = 1.5 + yOffset;
    if (ramRef2.current) ramRef2.current.position.y = 1.5 + yOffset;
  });

  return (
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
          <meshStandardMaterial
            color="#1e40af"
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* Top cross beams (X direction) — front + back */}
      {[-0.8, 0.8].map((z, i) => (
        <mesh key={`xbeam-${i}`} position={[0, 1.15, z]}>
          <boxGeometry args={[1.1, 0.06, 0.06]} />
          <meshStandardMaterial
            color="#1e40af"
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      ))}
      {/* Top cross beams (Z direction) — left + right */}
      {[-0.5, 0.5].map((x, i) => (
        <mesh key={`zbeam-${i}`} position={[x, 1.15, 0]}>
          <boxGeometry args={[0.06, 0.06, 1.7]} />
          <meshStandardMaterial
            color="#1e40af"
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* 2 hydraulic rams on top - animated */}
      <group ref={ramRef1} position={[-0.25, 1.5, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.5, 10]} />
          <meshStandardMaterial
            color="#a1a1aa"
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.45, 6]} />
          <meshStandardMaterial
            color="#e4e4e7"
            metalness={0.95}
            roughness={0.05}
          />
        </mesh>
      </group>
      <group ref={ramRef2} position={[0.25, 1.5, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.5, 10]} />
          <meshStandardMaterial
            color="#a1a1aa"
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.45, 6]} />
          <meshStandardMaterial
            color="#e4e4e7"
            metalness={0.95}
            roughness={0.05}
          />
        </mesh>
      </group>

      {/* ── BOTTLE-SHAPED MOLD DIES ── */}
      {/* Upper die (bottle-shaped cavity) - descends from hydraulic rams - ANIMATED */}
      <group ref={upperDieRef1} position={[-0.25, 0.85, 0]}>
        {/* Die block housing */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.25, 0.4, 0.35]} />
          <meshStandardMaterial
            color="#1e40af"
            metalness={0.8}
            roughness={0.3}
            emissive="#3b82f6"
            emissiveIntensity={0.1}
          />
        </mesh>

        {/* Glass viewing window showing bottle cavity */}
        <mesh position={[0, -0.05, 0.18]}>
          <boxGeometry args={[0.18, 0.3, 0.02]} />
          <meshPhysicalMaterial
            color="#87ceeb"
            transparent
            opacity={0.25}
            metalness={0.1}
            roughness={0.05}
            transmission={0.85}
            thickness={0.5}
          />
        </mesh>

        {/* Bottle-shaped cavity silhouette visible through window */}
        <mesh position={[0, -0.05, 0.17]}>
          <boxGeometry args={[0.08, 0.28, 0.01]} />
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#60a5fa"
            emissiveIntensity={0.4}
            transparent
            opacity={0.6}
          />
        </mesh>
      </group>
      <group ref={upperDieRef2} position={[0.25, 0.85, 0]}>
        {/* Die block housing */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.25, 0.4, 0.35]} />
          <meshStandardMaterial
            color="#1e40af"
            metalness={0.8}
            roughness={0.3}
            emissive="#3b82f6"
            emissiveIntensity={0.1}
          />
        </mesh>

        {/* Glass viewing window showing bottle cavity */}
        <mesh position={[0, -0.05, 0.18]}>
          <boxGeometry args={[0.18, 0.3, 0.02]} />
          <meshPhysicalMaterial
            color="#87ceeb"
            transparent
            opacity={0.25}
            metalness={0.1}
            roughness={0.05}
            transmission={0.85}
            thickness={0.5}
          />
        </mesh>

        {/* Bottle-shaped cavity silhouette visible through window */}
        <mesh position={[0, -0.05, 0.17]}>
          <boxGeometry args={[0.08, 0.28, 0.01]} />
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#60a5fa"
            emissiveIntensity={0.4}
            transparent
            opacity={0.6}
          />
        </mesh>
      </group>

      {/* Lower die (bottle-shaped cavity) - fixed at belt level */}
      {[-0.25, 0.25].map((x, i) => (
        <group key={`lower-die-${i}`} position={[x, 0.18, 0]}>
          {/* Die block base */}
          <mesh castShadow>
            <boxGeometry args={[0.25, 0.35, 0.35]} />
            <meshStandardMaterial
              color="#1e40af"
              metalness={0.8}
              roughness={0.3}
              emissive="#3b82f6"
              emissiveIntensity={0.1}
            />
          </mesh>

          {/* Glass viewing window */}
          <mesh position={[0, 0, 0.18]}>
            <boxGeometry args={[0.18, 0.3, 0.02]} />
            <meshPhysicalMaterial
              color="#87ceeb"
              transparent
              opacity={0.25}
              metalness={0.1}
              roughness={0.05}
              transmission={0.85}
              thickness={0.5}
            />
          </mesh>

          {/* Bottle-shaped cavity silhouette */}
          <mesh position={[0, 0, 0.17]}>
            <boxGeometry args={[0.08, 0.28, 0.01]} />
            <meshStandardMaterial
              color="#3b82f6"
              emissive="#60a5fa"
              emissiveIntensity={0.4}
              transparent
              opacity={0.6}
            />
          </mesh>

          {/* Air inlet ports */}
          <mesh position={[0.1, -0.1, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.05, 6]} />
            <meshStandardMaterial
              color="#f59e0b"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
        </group>
      ))}

      {/* Heating elements (IR lamps) visible on sides */}
      {[-0.45, 0.45].map((x, i) => (
        <group key={`heater-${i}`} position={[x, 0.5, 0]}>
          <mesh>
            <cylinderGeometry args={[0.04, 0.04, 0.8, 6]} />
            <meshStandardMaterial
              color="#ff4500"
              emissive="#ff6347"
              emissiveIntensity={0.6}
              metalness={0.3}
              roughness={0.4}
            />
          </mesh>
        </group>
      ))}

      {/* Internal blue glow strip on ceiling */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.8, 0.02, 1.4]} />
        <meshStandardMaterial
          color="#60a5fa"
          emissive="#3b82f6"
          emissiveIntensity={0.9}
        />
      </mesh>

      {/* Yellow safety stripes on the two front/back bottom edges */}
      {[-0.82, 0.82].map((z, i) => (
        <mesh key={`stripe-${i}`} position={[0, 0.04, z]}>
          <boxGeometry args={[1.05, 0.04, 0.04]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}

      {/* Status sphere on top */}
      <mesh position={[0, 2.0, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial
          color="#60a5fa"
          emissive="#3b82f6"
          emissiveIntensity={1.0}
        />
      </mesh>

      {/* Air pipe stub */}
      <mesh position={[0.55, 0.9, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 6]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
};

/* ── Cooling Tunnel (curing stage) ──
   Compact enclosed tunnel with open front/back. Belt runs through the middle. */
export const CoolingTunnelInline: React.FC<TunnelProps> = ({
  position,
  rotationY,
}) => (
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
          <meshStandardMaterial
            color="#94a3b8"
            metalness={0.6}
            roughness={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      )),
    )}

    {/* Ceiling cyan glow strip */}
    <mesh position={[0, 1.0, 0]}>
      <boxGeometry args={[0.8, 0.02, 1.8]} />
      <meshStandardMaterial
        color="#22d3ee"
        emissive="#06b6d4"
        emissiveIntensity={0.9}
      />
    </mesh>
    {/* Floor glow */}
    <mesh position={[0, 0.04, 0]}>
      <boxGeometry args={[0.8, 0.01, 1.8]} />
      <meshStandardMaterial
        color="#22d3ee"
        emissive="#06b6d4"
        emissiveIntensity={0.5}
      />
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
      <meshStandardMaterial
        color="#22d3ee"
        emissive="#06b6d4"
        emissiveIntensity={1.0}
      />
    </mesh>
  </group>
);
