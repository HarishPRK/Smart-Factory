"use no memo";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface LidarScanner3DProps {
  position: [number, number, number];
}

/**
 * LidarScanner3D — Animated scanning laser plane + point cloud effect
 *
 * A vertical green laser plane sweeps left-right over the bottle position.
 * Floating point-cloud dots appear in the scan zone.
 * Single useFrame drives both the sweep and the points.
 */
const LidarScanner3D: React.FC<LidarScanner3DProps> = ({ position }) => {
  const scanPlaneRef = useRef<THREE.Mesh>(null);
  const pointsRef = useRef<THREE.InstancedMesh>(null);

  const POINT_COUNT = 30;
  const tempMatrix = React.useMemo(() => new THREE.Matrix4(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // Sweep the scan plane left-right
    if (scanPlaneRef.current) {
      const sweep = Math.sin(t * 1.5) * 0.3;
      scanPlaneRef.current.position.x = sweep;
      // Pulse opacity for scanning effect
      const mat = scanPlaneRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.08 + Math.abs(Math.sin(t * 3)) * 0.07;
    }

    // Animate point cloud dots
    if (pointsRef.current) {
      for (let i = 0; i < POINT_COUNT; i++) {
        const phase = t * 2 + i * 0.7;
        const x = Math.sin(phase * 0.4 + i) * 0.25;
        const y = 0.1 + (i / POINT_COUNT) * 0.5 + Math.sin(phase) * 0.02;
        const z = Math.cos(phase * 0.3 + i * 0.5) * 0.15;
        // Fade in/out cyclically
        const life = (Math.sin(phase) + 1) / 2;
        const scale = life * 0.8 + 0.2;
        tempMatrix.makeTranslation(x, y, z);
        tempMatrix.scale(new THREE.Vector3(scale, scale, scale));
        pointsRef.current.setMatrixAt(i, tempMatrix);
      }
      pointsRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      {/* Scanning laser plane — vertical, semi-transparent green */}
      <mesh ref={scanPlaneRef} position={[0, 0.35, 0]}>
        <planeGeometry args={[0.02, 0.7]} />
        <meshBasicMaterial
          color="#22c55e"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Scanning beam from camera down to belt */}
      <mesh position={[0, 0.6, -0.1]} rotation={[0.3, 0, 0]}>
        <coneGeometry args={[0.15, 0.8, 12, 1, true]} />
        <meshBasicMaterial
          color="#22c55e"
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Point cloud particles — tiny green dots */}
      <instancedMesh ref={pointsRef} args={[undefined, undefined, POINT_COUNT]}>
        <sphereGeometry args={[0.008, 4, 4]} />
        <meshBasicMaterial
          color="#4ade80"
          transparent
          opacity={0.7}
        />
      </instancedMesh>

      {/* Horizontal scan line on belt surface */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.003]} />
        <meshBasicMaterial
          color="#22c55e"
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  );
};

export default LidarScanner3D;
