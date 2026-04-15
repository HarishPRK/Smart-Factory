"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface MaterialFlowProps {
  path: [number, number, number][];
  active: boolean;
}

const PARTICLE_COUNT = 15;
const FLOW_SPEED = 2;

const MaterialFlow: React.FC<MaterialFlowProps> = ({ path, active }) => {
  const instanceRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const progressRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT));

  // Smooth curve through waypoints
  const curve = useMemo(() => {
    const points = path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.3);
  }, [path]);

  const curveLength = useMemo(() => curve.getLength(), [curve]);

  useMemo(() => {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      progressRef.current[i] = i / PARTICLE_COUNT;
    }
  }, []);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const glowMatrix = useMemo(() => new THREE.Matrix4(), []);
  const zeroMatrix = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  const glowScale = useMemo(() => new THREE.Vector3(2.5, 2.5, 2.5), []);

  useFrame((_, delta) => {
    if (!instanceRef.current || !glowRef.current) return;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (active) {
        progressRef.current[i] =
          (progressRef.current[i] + (delta * FLOW_SPEED) / curveLength) % 1;
        curve.getPointAt(progressRef.current[i], tempPos);
        tempPos.y += 0.2; // Slightly above belt
        tempMatrix.makeTranslation(tempPos.x, tempPos.y, tempPos.z);
        glowMatrix.makeTranslation(tempPos.x, tempPos.y, tempPos.z);
        glowMatrix.scale(glowScale);
      } else {
        tempMatrix.copy(zeroMatrix);
        glowMatrix.copy(zeroMatrix);
      }
      instanceRef.current.setMatrixAt(i, tempMatrix);
      glowRef.current.setMatrixAt(i, glowMatrix);
    }
    instanceRef.current.instanceMatrix.needsUpdate = true;
    glowRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Core particles */}
      <instancedMesh
        ref={instanceRef}
        args={[undefined, undefined, PARTICLE_COUNT]}
      >
        <boxGeometry args={[0.12, 0.08, 0.12]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#f59e0b"
          emissiveIntensity={1.2}
          metalness={0.9}
          roughness={0.1}
        />
      </instancedMesh>
      {/* Glow halos */}
      <instancedMesh
        ref={glowRef}
        args={[undefined, undefined, PARTICLE_COUNT]}
      >
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.25} />
      </instancedMesh>
    </group>
  );
};

export default MaterialFlow;
