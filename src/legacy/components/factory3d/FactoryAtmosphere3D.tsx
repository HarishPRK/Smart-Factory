"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STAGE_POSITIONS } from "./digitalTwinLayout";

/**
 * FactoryAtmosphere3D — Animated environmental effects
 *
 * - Steam rising from curing oven
 * - Spark particles at forming press
 * - Glowing liquid in mixing tank
 * - Heat shimmer at curing
 * All in a single component with minimal useFrame cost.
 */

const STEAM_COUNT = 25;
const SPARK_COUNT = 15;

const FactoryAtmosphere3D: React.FC = () => {
  const steamRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const mixGlowRef = useRef<THREE.Mesh>(null);
  const curingGlowRef = useRef<THREE.Mesh>(null);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);

  const curing = STAGE_POSITIONS.curing;
  const forming = STAGE_POSITIONS.forming;
  const mixing = STAGE_POSITIONS.mixing;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // ── Steam particles rising from curing oven ──
    if (steamRef.current) {
      for (let i = 0; i < STEAM_COUNT; i++) {
        const phase = (t * 0.4 + i * 1.3) % 4.0;
        const life = phase / 4.0;
        const x = curing[0] + Math.sin(i * 2.1 + t * 0.3) * 0.3;
        const y = curing[1] + 1.0 + life * 2.5;
        const z = curing[2] - 0.6 + Math.cos(i * 1.7 + t * 0.2) * 0.2;
        const s = (0.3 + life * 0.8) * (1 - life * 0.5);

        tempPos.set(x, y, z);
        tempScale.set(s, s, s);
        tempMatrix.compose(tempPos, tempQuat, tempScale);
        steamRef.current.setMatrixAt(i, tempMatrix);
      }
      steamRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── Spark particles at forming press ──
    if (sparkRef.current) {
      for (let i = 0; i < SPARK_COUNT; i++) {
        const phase = (t * 3 + i * 0.8) % 1.5;
        const life = phase / 1.5;
        if (life > 0.9) {
          // Hide expired sparks
          tempMatrix.makeTranslation(0, -100, 0);
        } else {
          const angle = i * (Math.PI * 2 / SPARK_COUNT) + t * 2;
          const speed = 0.3 + (i % 5) * 0.1;
          const x = forming[0] + Math.cos(angle) * life * speed;
          const y = forming[1] + 0.5 + life * 0.8 - life * life * 1.5;
          const z = forming[2] - 0.3 + Math.sin(angle) * life * speed;
          const s = (1 - life) * 0.5;

          tempPos.set(x, y, z);
          tempScale.set(s, s, s);
          tempMatrix.compose(tempPos, tempQuat, tempScale);
        }
        sparkRef.current.setMatrixAt(i, tempMatrix);
      }
      sparkRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── Mixing tank liquid glow ──
    if (mixGlowRef.current) {
      const mat = mixGlowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.3 + Math.sin(t * 1.5) * 0.15;
    }

    // ── Curing oven interior glow pulse ──
    if (curingGlowRef.current) {
      const mat = curingGlowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.4 + Math.sin(t * 2) * 0.2;
    }
  });

  return (
    <group>
      {/* Steam particles — white translucent spheres */}
      <instancedMesh ref={steamRef} args={[undefined, undefined, STEAM_COUNT]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshBasicMaterial color="#cbd5e1" transparent opacity={0.12} />
      </instancedMesh>

      {/* Spark particles — orange/yellow dots */}
      <instancedMesh ref={sparkRef} args={[undefined, undefined, SPARK_COUNT]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshBasicMaterial color="#f59e0b" />
      </instancedMesh>

      {/* Mixing tank liquid surface glow */}
      <mesh ref={mixGlowRef} position={[mixing[0], mixing[1] + 0.6, mixing[2] - 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 16]} />
        <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={0.3} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Curing oven interior glow */}
      <mesh ref={curingGlowRef} position={[curing[0], curing[1] + 0.15, curing[2] - 0.15]}>
        <boxGeometry args={[0.8, 0.7, 0.02]} />
        <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={0.4} transparent opacity={0.6} />
      </mesh>
      {/* Heat shimmer light at curing */}
      <pointLight position={[curing[0], curing[1] + 0.3, curing[2] - 0.2]} color="#f97316" intensity={0.4} distance={3} decay={2} />

      {/* Forming press active light */}
      <pointLight position={[forming[0], forming[1] + 0.5, forming[2] - 0.3]} color="#60a5fa" intensity={0.3} distance={3} decay={2} />

      {/* Mixing tank liquid glow light */}
      <pointLight position={[mixing[0], mixing[1] + 0.8, mixing[2] - 0.8]} color="#22d3ee" intensity={0.3} distance={3} decay={2} />
    </group>
  );
};

export default FactoryAtmosphere3D;
