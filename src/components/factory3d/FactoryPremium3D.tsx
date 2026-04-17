"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";

/**
 * FactoryPremium3D — Premium visual features
 *
 * 1. CCTV cameras on poles
 * 2. Digital clock + uptime timer
 * 3. Smoke stack exhaust from curing
 * 4. Floor LED strips pulsing along conveyor
 * 5. Waste/recycling bins
 * 6. IoT antenna tower
 * 7. Sound wave rings around noisy machines
 * 8. Conveyor turn tables at corners
 */

const SMOKE_COUNT = 20;
const LED_COUNT = 30;
const WAVE_RING_COUNT = 12;

const FactoryPremium3D: React.FC = () => {
  const smokeRef = useRef<THREE.InstancedMesh>(null);
  const ledRef = useRef<THREE.InstancedMesh>(null);
  const waveRingsRef = useRef<THREE.InstancedMesh>(null);
  const cctvRefs = useRef<(THREE.Group | null)[]>([]);
  const clockRef = useRef<HTMLDivElement>(null);
  const uptimeRef = useRef<HTMLDivElement>(null);
  const antennaBlinkRef = useRef<THREE.Mesh>(null);
  const turntableRefs = useRef<(THREE.Mesh | null)[]>([]);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  const curing = STAGE_POSITIONS.curing;
  const forming = STAGE_POSITIONS.forming;

  // LED positions along conveyor path
  const ledPositions = useMemo(() => {
    const pts: [number, number, number, number][] = [];
    // Row 1
    for (let i = 0; i < 10; i++) pts.push([-7 + i * 1.5, 0.003, 4, 0]);
    // Row 2
    for (let i = 0; i < 8; i++) pts.push([4 - i * 1.2, 0.003, 0, Math.PI]);
    // Row 3
    for (let i = 0; i < 12; i++) pts.push([-5 + i * 1.2, 0.003, -4, 0]);
    return pts.slice(0, LED_COUNT);
  }, []);

  // CCTV positions
  const cctvPositions: { pos: [number, number, number]; lookAt: [number, number, number] }[] = useMemo(() => [
    { pos: [-9, 3.5, 6], lookAt: [-2, 0, 4] },
    { pos: [7, 3.5, 6], lookAt: [2, 0, 0] },
    { pos: [-7, 3.5, -6], lookAt: [0, 0, -4] },
    { pos: [9, 3.5, -6], lookAt: [5, 0, -4] },
  ], []);

  // Turntable positions (at conveyor corners)
  const turntablePositions: [number, number, number][] = useMemo(() => [
    [5, 0.52, 2],    // Turn 1
    [-5, 0.52, -2],  // Turn 2
  ], []);

  // Wave ring sources (noisy machines)
  const waveSources = useMemo(() => [
    STAGE_POSITIONS.forming,
    STAGE_POSITIONS.curing,
    STAGE_POSITIONS.packaging,
  ], []);

  const lastClockUpdate = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const now = performance.now();

    // ── 1. CCTV cameras — slow pan ──
    for (let i = 0; i < cctvRefs.current.length; i++) {
      const cam = cctvRefs.current[i];
      if (!cam) continue;
      // Gentle panning rotation
      cam.rotation.y = Math.sin(t * 0.3 + i * 1.5) * 0.8;
    }

    // ── 2. Clock update (every 1 second) ──
    if (now - lastClockUpdate.current > 1000) {
      lastClockUpdate.current = now;
      if (clockRef.current) {
        const d = new Date();
        clockRef.current.textContent = d.toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }
      if (uptimeRef.current) {
        const hrs = Math.floor(t / 3600);
        const mins = Math.floor((t % 3600) / 60);
        const secs = Math.floor(t % 60);
        uptimeRef.current.textContent = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      }
    }

    // ── 3. Smoke stack particles ──
    if (smokeRef.current) {
      for (let i = 0; i < SMOKE_COUNT; i++) {
        const phase = (t * 0.3 + i * 0.5) % 3.0;
        const life = phase / 3.0;
        const x = curing[0] + Math.sin(i * 2.3 + t * 0.2) * 0.2 * (1 + life);
        const y = curing[1] + 2.0 + life * 3.0;
        const z = curing[2] - 0.6 + Math.cos(i * 1.7 + t * 0.15) * 0.15 * (1 + life);
        const s = (0.1 + life * 0.4) * (1 - life * 0.3);
        tempPos.set(x, y, z);
        tempScale.set(s, s, s);
        tempMatrix.compose(tempPos, tempQuat, tempScale);
        smokeRef.current.setMatrixAt(i, tempMatrix);
      }
      smokeRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── 4. Floor LED strips — sequential pulse ──
    if (ledRef.current) {
      for (let i = 0; i < LED_COUNT && i < ledPositions.length; i++) {
        const [x, y, z] = ledPositions[i];
        const wave = Math.sin(t * 2 - i * 0.3);
        const brightness = Math.max(0.2, 0.5 + wave * 0.5);
        tempPos.set(x, y, z);
        tempScale.set(1, 1, 1);
        tempMatrix.compose(tempPos, tempQuat, tempScale);
        ledRef.current.setMatrixAt(i, tempMatrix);
        tempColor.setRGB(0.06 * brightness, 0.73 * brightness, 0.51 * brightness);
        ledRef.current.setColorAt(i, tempColor);
      }
      ledRef.current.instanceMatrix.needsUpdate = true;
      if (ledRef.current.instanceColor) ledRef.current.instanceColor.needsUpdate = true;
    }

    // ── 6. Antenna blink ──
    if (antennaBlinkRef.current) {
      const mat = antennaBlinkRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = Math.sin(t * 2) > 0.9 ? 2.0 : 0.1;
    }

    // ── 7. Sound wave rings — expanding + fading ──
    if (waveRingsRef.current) {
      let idx = 0;
      for (let s = 0; s < waveSources.length; s++) {
        const src = waveSources[s];
        for (let r = 0; r < 4; r++) {
          if (idx >= WAVE_RING_COUNT) break;
          const phase = (t * 0.8 + r * 0.8 + s * 0.3) % 3.0;
          const life = phase / 3.0;
          const scale = 0.3 + life * 1.5;
          const opacity = (1 - life) * 0.15;
          tempPos.set(src[0], src[1] + 0.5, src[2]);
          tempScale.set(scale, 0.01, scale);
          tempQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
          tempMatrix.compose(tempPos, tempQuat, tempScale);
          waveRingsRef.current.setMatrixAt(idx, tempMatrix);
          tempColor.setRGB(opacity * 3, opacity * 6, opacity * 10);
          waveRingsRef.current.setColorAt(idx, tempColor);
          idx++;
        }
      }
      waveRingsRef.current.instanceMatrix.needsUpdate = true;
      if (waveRingsRef.current.instanceColor) waveRingsRef.current.instanceColor.needsUpdate = true;
    }

    // ── 8. Turntables spinning ──
    for (let i = 0; i < turntableRefs.current.length; i++) {
      const tt = turntableRefs.current[i];
      if (tt) tt.rotation.y += 0.01;
    }
  });

  return (
    <group>
      {/* ══════ 1. CCTV CAMERAS ══════ */}
      {cctvPositions.map((cctv, i) => (
        <group key={`cctv-${i}`} position={cctv.pos}>
          {/* Floor base plate — so the pole looks planted, not floating */}
          <mesh position={[0, -cctv.pos[1] + 0.04, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.14, 0.16, 0.08, 12]} />
            <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.4} />
          </mesh>
          {/* Anchor bolts on the base */}
          {[0, 1, 2, 3].map((b) => {
            const a = (b / 4) * Math.PI * 2;
            return (
              <mesh key={b} position={[Math.cos(a) * 0.1, -cctv.pos[1] + 0.09, Math.sin(a) * 0.1]}>
                <cylinderGeometry args={[0.012, 0.012, 0.03, 6]} />
                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
              </mesh>
            );
          })}
          {/* Pole — full length from floor up to camera */}
          <mesh position={[0, -cctv.pos[1] / 2 + 0.04, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.04, cctv.pos[1] - 0.08, 8]} />
            <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Horizontal arm reaching out to the camera head */}
          <mesh position={[0, -0.02, 0.08]}>
            <boxGeometry args={[0.04, 0.04, 0.2]} />
            <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Camera housing (panning) */}
          <group ref={(el) => { cctvRefs.current[i] = el; }}>
            {/* Body */}
            <mesh castShadow>
              <boxGeometry args={[0.12, 0.08, 0.18]} />
              <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.5} />
            </mesh>
            {/* Lens */}
            <mesh position={[0, 0, 0.1]}>
              <cylinderGeometry args={[0.025, 0.02, 0.05, 8]} />
              <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* IR LEDs ring */}
            <mesh position={[0, 0, 0.09]}>
              <torusGeometry args={[0.035, 0.005, 4, 8]} />
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
            </mesh>
            {/* Recording indicator */}
            <mesh position={[0.05, 0.035, 0.05]}>
              <sphereGeometry args={[0.008, 4, 4]} />
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
            </mesh>
          </group>
          {/* Mount bracket */}
          <mesh position={[0, -0.08, -0.06]}>
            <boxGeometry args={[0.04, 0.06, 0.08]} />
            <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* ══════ 3. SMOKE STACK EXHAUST ══════ */}
      {/* Chimney on curing oven */}
      <mesh position={[curing[0], curing[1] + 2.2, curing[2] - 0.6]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 0.6, 8]} />
        <meshStandardMaterial color="#52525b" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[curing[0], curing[1] + 2.55, curing[2] - 0.6]}>
        <cylinderGeometry args={[0.18, 0.18, 0.06, 8]} />
        <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Smoke particles */}
      <instancedMesh ref={smokeRef} args={[undefined, undefined, SMOKE_COUNT]}>
        <sphereGeometry args={[0.15, 6, 6]} />
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.08} />
      </instancedMesh>

      {/* ══════ 4. FLOOR LED STRIPS ══════ */}
      <instancedMesh ref={ledRef} args={[undefined, undefined, LED_COUNT]}>
        <boxGeometry args={[0.4, 0.005, 0.04]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.4} />
      </instancedMesh>

      {/* ══════ 5. WASTE/RECYCLING BINS ══════ */}
      {[
        { pos: [-4, 0, 5.5] as [number, number, number], color: "#22c55e", label: "RECYCLE" },
        { pos: [3, 0, 5.5] as [number, number, number], color: "#3b82f6", label: "GENERAL" },
        { pos: [-6, 0, -5.5] as [number, number, number], color: "#ef4444", label: "HAZMAT" },
        { pos: [5, 0, -5.5] as [number, number, number], color: "#f59e0b", label: "SCRAP" },
      ].map(({ pos, color, label }, i) => (
        <group key={`bin-${i}`} position={pos}>
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.2, 0.5, 8]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.52, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.03, 8]} />
            <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Label */}
          <mesh position={[0, 0.25, 0.21]}>
            <planeGeometry args={[0.2, 0.08]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
          </mesh>
        </group>
      ))}

      {/* ══════ 7. SOUND WAVE RINGS ══════ */}
      <instancedMesh ref={waveRingsRef} args={[undefined, undefined, WAVE_RING_COUNT]}>
        <torusGeometry args={[1, 0.01, 4, 24]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.1} />
      </instancedMesh>

    </group>
  );
};

export default FactoryPremium3D;
