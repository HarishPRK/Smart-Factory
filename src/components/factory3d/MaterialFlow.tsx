"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface MaterialFlowProps {
  path: [number, number, number][];
  active: boolean;
}

const PARTICLE_COUNT = 10;
const FLOW_SPEED = 1.5;

const MaterialFlow: React.FC<MaterialFlowProps> = ({ path, active }) => {
  const instanceRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const progressRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT));

  const pathLength = useMemo(() => {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i][0] - path[i - 1][0];
      const dz = path[i][2] - path[i - 1][2];
      len += Math.sqrt(dx * dx + dz * dz);
    }
    return len;
  }, [path]);

  useMemo(() => {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      progressRef.current[i] = i / PARTICLE_COUNT;
    }
  }, []);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const glowMatrix = useMemo(() => new THREE.Matrix4(), []);
  const zeroMatrix = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);

  const getPathPosition = (t: number): [number, number, number] => {
    const clampedT = ((t % 1) + 1) % 1;
    const totalT = clampedT * (path.length - 1);
    const segIdx = Math.min(Math.floor(totalT), path.length - 2);
    const segT = totalT - segIdx;
    const a = path[segIdx];
    const b = path[segIdx + 1];
    return [
      a[0] + (b[0] - a[0]) * segT,
      a[1] + (b[1] - a[1]) * segT + 0.2,
      a[2] + (b[2] - a[2]) * segT,
    ];
  };

  useFrame((_, delta) => {
    if (!instanceRef.current || !glowRef.current) return;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (active) {
        progressRef.current[i] = (progressRef.current[i] + (delta * FLOW_SPEED) / pathLength) % 1;
        const pos = getPathPosition(progressRef.current[i]);
        tempMatrix.makeTranslation(pos[0], pos[1], pos[2]);
        glowMatrix.makeTranslation(pos[0], pos[1], pos[2]);
        glowMatrix.scale(new THREE.Vector3(2.5, 2.5, 2.5));
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
      <instancedMesh ref={instanceRef} args={[undefined, undefined, PARTICLE_COUNT]}>
        <boxGeometry args={[0.12, 0.08, 0.12]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1.2} metalness={0.9} roughness={0.1} />
      </instancedMesh>
      {/* Glow halos */}
      <instancedMesh ref={glowRef} args={[undefined, undefined, PARTICLE_COUNT]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.25} />
      </instancedMesh>
    </group>
  );
};

export default MaterialFlow;
