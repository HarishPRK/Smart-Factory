"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STAGE_POSITIONS } from "./digitalTwinLayout";

/**
 * AnimatedMachinery3D — Moving parts overlaid on static stage equipment
 *
 * Single component, one useFrame, drives ALL animated machinery:
 *  - Mixing: spinning agitator blade + bubbling liquid
 *  - Forming: hydraulic ram pressing up/down
 *  - Curing: rotating exhaust fan + heat shimmer particles
 *  - Quality: scanning beam sweep
 *  - Packaging: seal bar pressing + film unwinding
 *  - Dispatch: gate barrier lifting
 *  - Floor: glowing directional arrows along conveyor path
 *  - Status: blinking lights on all control cabinets
 */

const BUBBLE_COUNT = 8;
const ARROW_COUNT = 20;
const HEAT_COUNT = 15;

const AnimatedMachinery3D: React.FC = () => {
  // Animated refs
  const agitatorRef = useRef<THREE.Mesh>(null);
  const ramRef = useRef<THREE.Mesh>(null);
  const exhaustFanRef = useRef<THREE.Group>(null);
  const sealBarRef = useRef<THREE.Mesh>(null);
  const gateArmRef = useRef<THREE.Mesh>(null);
  const scanBeamRef = useRef<THREE.Mesh>(null);
  const bubblesRef = useRef<THREE.InstancedMesh>(null);
  const arrowsRef = useRef<THREE.InstancedMesh>(null);
  const heatRef = useRef<THREE.InstancedMesh>(null);
  const statusLightsRef = useRef<(THREE.Mesh | null)[]>([]);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);

  const mixing = STAGE_POSITIONS.mixing;
  const forming = STAGE_POSITIONS.forming;
  const curing = STAGE_POSITIONS.curing;
  const quality = STAGE_POSITIONS.quality;
  const packaging = STAGE_POSITIONS.packaging;
  const dispatch = STAGE_POSITIONS.dispatch;

  // Arrow positions along conveyor path
  const arrowPath = useMemo(() => {
    const points: [number, number, number, number][] = []; // x, z, angle, row
    // Row 1: left to right
    for (let i = 0; i < 7; i++) { const x = -7 + i * 2; points.push([x, 4, 0, 0]); }
    // Turn 1
    points.push([5, 2, Math.PI / 2, 1]);
    // Row 2: right to left
    for (let i = 0; i < 5; i++) { const x = 4 - i * 2; points.push([x, 0, Math.PI, 1]); }
    // Turn 2
    points.push([-5, -2, Math.PI / 2, 2]);
    // Row 3: left to right
    for (let i = 0; i < 7; i++) { const x = -4 + i * 2; points.push([x, -4, 0, 2]); }
    return points;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // ── Mixing agitator rotation ──
    if (agitatorRef.current) {
      agitatorRef.current.rotation.y = t * 2;
    }

    // ── Mixing bubbles ──
    if (bubblesRef.current) {
      for (let i = 0; i < BUBBLE_COUNT; i++) {
        const phase = (t * 0.6 + i * 0.8) % 2.0;
        const life = phase / 2.0;
        const x = mixing[0] + Math.sin(i * 2.3 + t * 0.5) * 0.3;
        const y = mixing[1] + 0.2 + life * 0.8;
        const z = mixing[2] - 0.8 + Math.cos(i * 1.9 + t * 0.3) * 0.3;
        const s = (1 - life) * 0.6 + 0.2;
        tempPos.set(x, y, z);
        tempScale.set(s, s, s);
        tempMatrix.compose(tempPos, tempQuat, tempScale);
        bubblesRef.current.setMatrixAt(i, tempMatrix);
      }
      bubblesRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── Forming hydraulic ram ──
    if (ramRef.current) {
      const press = Math.sin(t * 1.5);
      ramRef.current.position.y = forming[1] + 1.0 + press * 0.25;
    }

    // ── Curing exhaust fan rotation ──
    if (exhaustFanRef.current) {
      exhaustFanRef.current.rotation.y = t * 4;
    }

    // ── Curing heat shimmer particles ──
    if (heatRef.current) {
      for (let i = 0; i < HEAT_COUNT; i++) {
        const phase = (t * 0.3 + i * 0.5) % 3.0;
        const life = phase / 3.0;
        const x = curing[0] + Math.sin(i * 1.7) * 0.5;
        const y = curing[1] + 1.5 + life * 1.5;
        const z = curing[2] - 0.6 + Math.cos(i * 2.1) * 0.3;
        const s = (0.5 + life * 0.5) * (1 - life * 0.3);
        tempPos.set(x, y, z);
        tempScale.set(s, s * 0.3, s);
        tempMatrix.compose(tempPos, tempQuat, tempScale);
        heatRef.current.setMatrixAt(i, tempMatrix);
      }
      heatRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── Quality scan beam sweep ──
    if (scanBeamRef.current) {
      scanBeamRef.current.position.x = quality[0] + Math.sin(t * 2) * 0.4;
      const mat = scanBeamRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 + Math.abs(Math.sin(t * 3)) * 0.1;
    }

    // ── Packaging seal bar press ──
    if (sealBarRef.current) {
      const press = Math.max(0, Math.sin(t * 2));
      sealBarRef.current.position.y = packaging[1] + 1.0 - press * 0.15;
    }

    // ── Dispatch gate arm ──
    if (gateArmRef.current) {
      const cycle = (t * 0.2) % 2;
      const angle = cycle < 1 ? cycle * Math.PI / 3 : (2 - cycle) * Math.PI / 3;
      gateArmRef.current.rotation.z = angle;
    }

    // ── Floor direction arrows — sequential glow ──
    if (arrowsRef.current) {
      for (let i = 0; i < Math.min(arrowPath.length, ARROW_COUNT); i++) {
        const [x, z, angle] = arrowPath[i];
        const wave = Math.sin(t * 2 - i * 0.4);
        const brightness = 0.5 + wave * 0.5;
        tempPos.set(x, 0.01, z);
        tempScale.set(brightness * 0.8 + 0.4, 1, brightness * 0.8 + 0.4);
        tempQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        const yQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle);
        tempQuat.multiply(yQuat);
        tempMatrix.compose(tempPos, tempQuat, tempScale);
        arrowsRef.current.setMatrixAt(i, tempMatrix);
      }
      // Hide extras
      for (let i = arrowPath.length; i < ARROW_COUNT; i++) {
        tempMatrix.makeTranslation(0, -100, 0);
        arrowsRef.current.setMatrixAt(i, tempMatrix);
      }
      arrowsRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── Status lights blink ──
    for (let i = 0; i < statusLightsRef.current.length; i++) {
      const light = statusLightsRef.current[i];
      if (!light) continue;
      const mat = light.material as THREE.MeshStandardMaterial;
      const phase = (t * 1.5 + i * 0.7) % 2;
      mat.emissiveIntensity = phase < 1.5 ? 0.8 : 0.1;
    }
  });

  return (
    <group>
      {/* ── Mixing: Animated agitator ── */}
      <mesh ref={agitatorRef} position={[mixing[0], mixing[1] + 0.5, mixing[2] - 0.8]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.6, 0.03, 0.08]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Second blade perpendicular */}
      <mesh ref={(el) => { if (agitatorRef.current && el) el.parent = agitatorRef.current; }}>
        {/* Handled by parent rotation */}
      </mesh>

      {/* Mixing bubbles */}
      <instancedMesh ref={bubblesRef} args={[undefined, undefined, BUBBLE_COUNT]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.25} />
      </instancedMesh>

      {/* ── Forming: Animated hydraulic ram ── */}
      <mesh ref={ramRef} position={[forming[0], forming[1] + 1.0, forming[2] - 0.4]} castShadow>
        <boxGeometry args={[0.5, 0.1, 0.4]} />
        <meshStandardMaterial color="#6b7280" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Ram glow ring */}
      <mesh position={[forming[0], forming[1] + 0.5, forming[2] - 0.4]}>
        <torusGeometry args={[0.15, 0.01, 4, 16]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.4} />
      </mesh>

      {/* ── Curing: Exhaust fan ── */}
      <group ref={exhaustFanRef} position={[curing[0], curing[1] + 1.6, curing[2] - 0.6]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, (i * Math.PI) / 2, 0]} position={[0.06, 0, 0]}>
            <boxGeometry args={[0.12, 0.01, 0.03]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* Heat shimmer particles above curing */}
      <instancedMesh ref={heatRef} args={[undefined, undefined, HEAT_COUNT]}>
        <planeGeometry args={[0.15, 0.04]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.08} side={THREE.DoubleSide} />
      </instancedMesh>

      {/* ── Quality: Scan beam ── */}
      <mesh ref={scanBeamRef} position={[quality[0], quality[1] + 0.3, quality[2] - 0.2]}>
        <planeGeometry args={[0.03, 0.8]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Packaging: Animated seal bar ── */}
      <mesh ref={sealBarRef} position={[packaging[0], packaging[1] + 1.0, packaging[2] - 0.3]} castShadow>
        <boxGeometry args={[0.7, 0.04, 0.06]} />
        <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.4} metalness={0.7} roughness={0.2} />
      </mesh>

      {/* ── Dispatch: Animated gate arm ── */}
      <group position={[dispatch[0] - 0.6, dispatch[1] + 0.5, dispatch[2] - 0.5]}>
        <mesh>
          <cylinderGeometry args={[0.03, 0.035, 1.0, 6]} />
          <meshStandardMaterial color="#dc2626" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh ref={gateArmRef} position={[0.4, 0.5, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.8, 0.04, 0.04]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.4} metalness={0.3} />
        </mesh>
      </group>

      {/* ── Floor direction arrows — animated sequential glow ── */}
      <instancedMesh ref={arrowsRef} args={[undefined, undefined, ARROW_COUNT]}>
        <coneGeometry args={[0.12, 0.25, 3]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.2} />
      </instancedMesh>

      {/* ── Blinking status lights on machines ── */}
      {[
        [mixing[0] + 0.9, mixing[1] + 0.6, mixing[2] + 0.4],
        [forming[0] + 1.0, forming[1] + 0.6, forming[2] + 0.5],
        [curing[0] - 1.0, curing[1] + 0.6, curing[2] + 0.3],
        [quality[0] + 1.0, quality[1] + 0.6, quality[2] - 0.5],
        [packaging[0] + 1.0, packaging[1] + 0.6, packaging[2] + 0.4],
        [dispatch[0] - 0.9, dispatch[1] + 0.6, dispatch[2] + 0.3],
      ].map(([x, y, z], i) => (
        <mesh
          key={`sl${i}`}
          ref={(el) => { statusLightsRef.current[i] = el; }}
          position={[x, y, z]}
        >
          <sphereGeometry args={[0.03, 6, 6]} />
          <meshStandardMaterial
            color="#22c55e"
            emissive="#22c55e"
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
};

export default AnimatedMachinery3D;
