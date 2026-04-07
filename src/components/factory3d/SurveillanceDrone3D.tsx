"use no memo";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * SurveillanceDrone3D — Animated quadcopter patrolling the factory
 *
 * Flies a figure-8 patrol pattern over the production line.
 * Spinning rotors, blinking red/green nav lights, camera gimbal.
 */
const SurveillanceDrone3D: React.FC = () => {
  const droneRef = useRef<THREE.Group>(null);
  const rotorsRef = useRef<THREE.Group[]>([]);
  const cameraGimbalRef = useRef<THREE.Group>(null);
  const navLightRef = useRef<THREE.Mesh>(null);
  const searchLightRef = useRef<THREE.SpotLight>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (droneRef.current) {
      // Figure-8 patrol path
      const speed = 0.15;
      const x = Math.sin(t * speed) * 10;
      const z = Math.sin(t * speed * 2) * 5;
      const y = 4.5 + Math.sin(t * 0.5) * 0.3; // gentle bob

      droneRef.current.position.set(x, y, z);

      // Face movement direction
      const dx = Math.cos(t * speed) * 10 * speed;
      const dz = Math.cos(t * speed * 2) * 5 * speed * 2;
      droneRef.current.rotation.y = Math.atan2(dx, dz);

      // Slight banking on turns
      droneRef.current.rotation.z = -dx * 0.03;
      droneRef.current.rotation.x = dz * 0.02;
    }

    // Spin all rotors
    for (const rotor of rotorsRef.current) {
      if (rotor) rotor.rotation.y += 0.8;
    }

    // Camera gimbal tracks downward
    if (cameraGimbalRef.current) {
      cameraGimbalRef.current.rotation.x = -0.3 + Math.sin(t * 0.3) * 0.1;
    }

    // Nav light blink
    if (navLightRef.current) {
      const mat = navLightRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = Math.sin(t * 4) > 0.8 ? 2.0 : 0.05;
    }

    // Searchlight follows drone
    if (searchLightRef.current && droneRef.current) {
      searchLightRef.current.position.copy(droneRef.current.position);
      searchLightRef.current.position.y -= 0.2;
    }
  });

  const ROTOR_POSITIONS: [number, number, number][] = [
    [-0.25, 0.05, -0.25],
    [0.25, 0.05, -0.25],
    [-0.25, 0.05, 0.25],
    [0.25, 0.05, 0.25],
  ];

  return (
    <group>
      <group ref={droneRef} position={[0, 4.5, 0]}>
        {/* Central body */}
        <mesh castShadow>
          <boxGeometry args={[0.15, 0.06, 0.2]} />
          <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.3} />
        </mesh>

        {/* Arms */}
        {ROTOR_POSITIONS.map(([x, , z], i) => (
          <mesh key={`arm${i}`} position={[x / 2, 0, z / 2]} rotation={[0, Math.atan2(x, z), 0]}>
            <boxGeometry args={[0.03, 0.02, 0.35]} />
            <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}

        {/* Rotor assemblies */}
        {ROTOR_POSITIONS.map(([x, y, z], i) => (
          <group key={`rotor${i}`} position={[x, y, z]}>
            {/* Motor */}
            <mesh>
              <cylinderGeometry args={[0.025, 0.025, 0.04, 6]} />
              <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Spinning blades */}
            <group ref={(el) => { if (el) rotorsRef.current[i] = el; }}>
              <mesh position={[0, 0.015, 0]}>
                <boxGeometry args={[0.18, 0.003, 0.02]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.3} transparent opacity={0.6} />
              </mesh>
              <mesh position={[0, 0.015, 0]} rotation={[0, Math.PI / 2, 0]}>
                <boxGeometry args={[0.18, 0.003, 0.02]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.3} transparent opacity={0.6} />
              </mesh>
            </group>
          </group>
        ))}

        {/* Landing gear */}
        {[-0.1, 0.1].map((x, i) => (
          <mesh key={`gear${i}`} position={[x, -0.06, 0]}>
            <boxGeometry args={[0.01, 0.04, 0.2]} />
            <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}

        {/* Camera gimbal */}
        <group ref={cameraGimbalRef} position={[0, -0.06, 0.05]}>
          <mesh>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.5} />
          </mesh>
          {/* Lens */}
          <mesh position={[0, -0.01, 0.02]}>
            <circleGeometry args={[0.012, 8]} />
            <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} />
          </mesh>
        </group>

        {/* Nav lights */}
        <mesh position={[-0.25, 0.02, -0.25]}>
          <sphereGeometry args={[0.01, 4, 4]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.25, 0.02, -0.25]}>
          <sphereGeometry args={[0.01, 4, 4]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
        </mesh>
        {/* Tail strobe */}
        <mesh ref={navLightRef} position={[0, 0.02, -0.1]}>
          <sphereGeometry args={[0.008, 4, 4]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* Searchlight cone (visible beam) */}
      <spotLight
        ref={searchLightRef}
        position={[0, 4.3, 0]}
        target-position={[0, 0, 0]}
        color="#93c5fd"
        intensity={0.3}
        angle={0.3}
        penumbra={0.8}
        distance={6}
        decay={2}
      />
    </group>
  );
};

export default SurveillanceDrone3D;
