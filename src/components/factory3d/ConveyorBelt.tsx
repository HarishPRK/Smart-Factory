"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";

interface ConveyorBeltProps {
  path: [number, number, number][];
  running: boolean;
}

const SEGMENT_COUNT = 24;
const BELT_SPEED = 2;

const ConveyorBelt: React.FC<ConveyorBeltProps> = ({ path, running }) => {
  const instanceRef = useRef<THREE.InstancedMesh>(null);
  const progressRef = useRef<Float32Array>(new Float32Array(SEGMENT_COUNT));
  const rollerRef = useRef<THREE.Group>(null);

  const pathLength = useMemo(() => {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i][0] - path[i - 1][0];
      const dy = path[i][1] - path[i - 1][1];
      const dz = path[i][2] - path[i - 1][2];
      len += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return len;
  }, [path]);

  useMemo(() => {
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      progressRef.current[i] = i / SEGMENT_COUNT;
    }
  }, []);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);

  const getPathPosition = (t: number): [number, number, number] => {
    const clampedT = ((t % 1) + 1) % 1;
    const totalT = clampedT * (path.length - 1);
    const segIdx = Math.min(Math.floor(totalT), path.length - 2);
    const segT = totalT - segIdx;
    const a = path[segIdx];
    const b = path[segIdx + 1];
    return [
      a[0] + (b[0] - a[0]) * segT,
      a[1] + (b[1] - a[1]) * segT,
      a[2] + (b[2] - a[2]) * segT,
    ];
  };

  useFrame((_, delta) => {
    if (!instanceRef.current) return;

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      if (running) {
        const speedMul = useDigitalTwinStore.getState().conveyorSpeedMultiplier;
        progressRef.current[i] = (progressRef.current[i] + (delta * BELT_SPEED * speedMul) / pathLength) % 1;
      }
      const pos = getPathPosition(progressRef.current[i]);
      tempPos.set(pos[0], pos[1], pos[2]);
      tempMatrix.makeTranslation(tempPos.x, tempPos.y, tempPos.z);
      instanceRef.current.setMatrixAt(i, tempMatrix);
    }
    instanceRef.current.instanceMatrix.needsUpdate = true;

    // Spin rollers
    if (running && rollerRef.current) {
      rollerRef.current.children.forEach((child) => {
        child.rotation.z += delta * 5;
      });
    }
  });

  // Roller positions
  const rollerPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let t = 0; t <= 1; t += 0.15) {
      const pos = getPathPosition(t);
      positions.push(pos);
    }
    return positions;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return (
    <group>
      {/* Side rails — green industrial color */}
      {[-0.4, 0.4].map((offset) => {
        const points = path.map((p) => new THREE.Vector3(p[0], p[1] + 0.08, p[2] + offset));
        const curve = new THREE.CatmullRomCurve3(points, false);
        return (
          <mesh key={offset}>
            <tubeGeometry args={[curve, 32, 0.035, 6, false]} />
            <meshStandardMaterial color="#5a5a5a" metalness={0.8} roughness={0.2} />
          </mesh>
        );
      })}

      {/* Belt segments (instanced) — dark rubber with green tint */}
      <instancedMesh ref={instanceRef} args={[undefined, undefined, SEGMENT_COUNT]} castShadow>
        <boxGeometry args={[0.25, 0.04, 0.72]} />
        <meshStandardMaterial color="#1f2937" metalness={0.15} roughness={0.85} emissive="#059669" emissiveIntensity={running ? 0.08 : 0} />
      </instancedMesh>

      {/* Rollers */}
      <group ref={rollerRef}>
        {rollerPositions.map((p, i) => (
          <mesh key={i} position={[p[0], p[1] - 0.05, p[2]]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.75, 8]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.1} />
          </mesh>
        ))}
      </group>

      {/* Support legs — sturdier with feet */}
      {path.map((p, i) => (
        <group key={i}>
          <mesh position={[p[0], p[1] / 2, p[2] - 0.35]}>
            <boxGeometry args={[0.06, p[1], 0.06]} />
            <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[p[0], p[1] / 2, p[2] + 0.35]}>
            <boxGeometry args={[0.06, p[1], 0.06]} />
            <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Cross brace */}
          <mesh position={[p[0], p[1] * 0.3, p[2]]}>
            <boxGeometry args={[0.04, 0.04, 0.65]} />
            <meshStandardMaterial color="#6b7280" metalness={0.5} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* End caps with green accent */}
      {[path[0], path[path.length - 1]].map((p, i) => (
        <mesh key={`cap-${i}`} position={[p[0] + (i === 0 ? -0.15 : 0.15), p[1], p[2]]}>
          <boxGeometry args={[0.08, 0.2, 0.85]} />
          <meshStandardMaterial color="#d4a017" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}

      {/* Status indicator lights along belt */}
      {rollerPositions.filter((_, i) => i % 2 === 0).map((p, i) => (
        <mesh key={`light-${i}`} position={[p[0], p[1] + 0.12, p[2] - 0.45]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial
            color={running ? "#22c55e" : "#6b7280"}
            emissive={running ? "#22c55e" : "#333"}
            emissiveIntensity={running ? 0.8 : 0.1}
          />
        </mesh>
      ))}
    </group>
  );
};

export default ConveyorBelt;
