"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

/**
 * FactoryCompound3D — Outer compound / campus features
 *
 * 1. Employee parking lot with parked cars
 * 2. Weather station (wind sock + anemometer)
 * 3. Solar panel array with energy display
 * 4. EV charging stations
 * 5. Emergency assembly point
 * 6. Compressed air tank farm
 * 7. Cooling water circuit (pumps + cooling tower)
 * 8. Guard booth at entrance
 * 9. Perimeter fencing
 * 10. Flag poles
 */

const S = { metalness: 0.8, roughness: 0.2 };

/* ── Parked Car ── */
const Car: React.FC<{ position: [number, number, number]; color: string; rotation?: number }> = ({
  position, color, rotation = 0,
}) => (
  <group position={position} rotation={[0, rotation, 0]}>
    {/* Body */}
    <mesh position={[0, 0.15, 0]} castShadow>
      <boxGeometry args={[0.5, 0.15, 1.0]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
    </mesh>
    {/* Cabin */}
    <mesh position={[0, 0.28, -0.05]} castShadow>
      <boxGeometry args={[0.42, 0.13, 0.55]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
    </mesh>
    {/* Windows */}
    <mesh position={[0, 0.3, -0.05]}>
      <boxGeometry args={[0.44, 0.1, 0.5]} />
      <meshStandardMaterial color="#93c5fd" transparent opacity={0.4} />
    </mesh>
    {/* Wheels */}
    {[[-0.22, 0.3], [0.22, 0.3], [-0.22, -0.3], [0.22, -0.3]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.06, z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 8]} />
        <meshStandardMaterial color="#1f2937" roughness={0.9} />
      </mesh>
    ))}
    {/* Headlights */}
    {[-0.18, 0.18].map((x, i) => (
      <mesh key={`h${i}`} position={[x, 0.15, 0.51]}>
        <boxGeometry args={[0.08, 0.04, 0.01]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={0.2} />
      </mesh>
    ))}
    {/* Tail lights */}
    {[-0.18, 0.18].map((x, i) => (
      <mesh key={`t${i}`} position={[x, 0.15, -0.51]}>
        <boxGeometry args={[0.06, 0.04, 0.01]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.15} />
      </mesh>
    ))}
  </group>
);

const FactoryCompound3D: React.FC = () => {
  const windSockRef = useRef<THREE.Mesh>(null);
  const anemometerRef = useRef<THREE.Group>(null);
  const solarValueRef = useRef<HTMLDivElement>(null);
  const evLedRefs = useRef<(THREE.Mesh | null)[]>([]);
  const flagRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pumpRef = useRef<THREE.Mesh>(null);
  const lastUpdate = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const now = performance.now();

    // Wind sock flutter
    if (windSockRef.current) {
      windSockRef.current.rotation.z = Math.sin(t * 2) * 0.3 + 0.4;
      windSockRef.current.rotation.y = Math.sin(t * 0.5) * 0.2;
    }

    // Anemometer spin
    if (anemometerRef.current) {
      anemometerRef.current.rotation.y += 0.05;
    }

    // EV charging LED pulse
    for (let i = 0; i < evLedRefs.current.length; i++) {
      const led = evLedRefs.current[i];
      if (led) {
        const mat = led.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.3 + Math.sin(t * 1.5 + i * 2) * 0.5;
      }
    }

    // Flags waving
    for (let i = 0; i < flagRefs.current.length; i++) {
      const flag = flagRefs.current[i];
      if (flag) {
        flag.rotation.y = Math.sin(t * 1.5 + i) * 0.15;
        flag.position.x = Math.sin(t * 2 + i) * 0.02;
      }
    }

    // Pump pulsing
    if (pumpRef.current) {
      pumpRef.current.scale.x = 1 + Math.sin(t * 4) * 0.02;
      pumpRef.current.scale.z = 1 + Math.sin(t * 4) * 0.02;
    }

    // Solar value update
    if (now - lastUpdate.current > 2000 && solarValueRef.current) {
      lastUpdate.current = now;
      const kw = (12 + Math.sin(t * 0.1) * 3).toFixed(1);
      solarValueRef.current.textContent = `${kw} kW`;
    }
  });

  const CAR_COLORS = ["#dc2626", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#e2e8f0", "#1f2937", "#0891b2", "#be123c", "#65a30d"];

  return (
    <group>
      {/* ══════ 2. WEATHER STATION ══════ */}
      <group position={[12, 0, 8]}>
        {/* Mast */}
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.02, 0.025, 3.0, 6]} />
          <meshStandardMaterial color="#9ca3af" {...S} />
        </mesh>
        {/* Wind sock */}
        <mesh ref={windSockRef} position={[0.2, 2.8, 0]} rotation={[0, 0, 0.4]}>
          <coneGeometry args={[0.06, 0.4, 6, 1, true]} />
          <meshStandardMaterial color="#ef4444" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
        {/* Anemometer */}
        <group ref={anemometerRef} position={[0, 2.5, 0]}>
          {[0, 1, 2].map((i) => {
            const angle = (i / 3) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(angle) * 0.12, 0, Math.sin(angle) * 0.12]}>
                <sphereGeometry args={[0.025, 6, 6, 0, Math.PI]} />
                <meshStandardMaterial color="#e2e8f0" {...S} />
              </mesh>
            );
          })}
        </group>
        {/* Temperature sensor */}
        <mesh position={[0, 2.0, 0.1]}>
          <boxGeometry args={[0.05, 0.15, 0.03]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
        </mesh>
      </group>

      {/* ══════ 4. EV CHARGING STATIONS ══════ */}
      {[[-12, 0, -6], [-12, 0, -4.5]].map(([x, y, z], i) => (
        <group key={`ev-${i}`} position={[x, y, z]}>
          {/* Charger unit */}
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[0.2, 0.8, 0.12]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.5} metalness={0.3} />
          </mesh>
          {/* Screen */}
          <mesh position={[0, 0.6, 0.07]}>
            <planeGeometry args={[0.12, 0.1]} />
            <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.2} />
          </mesh>
          {/* Cable */}
          <mesh position={[0.12, 0.3, 0]} rotation={[0.5, 0, 0.3]}>
            <cylinderGeometry args={[0.01, 0.01, 0.5, 4]} />
            <meshStandardMaterial color="#1f2937" roughness={0.8} />
          </mesh>
          {/* Status LED */}
          <mesh ref={(el) => { evLedRefs.current[i] = el; }} position={[0, 0.92, 0.06]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
          </mesh>
          {/* Green stripe */}
          <mesh position={[0, 0.5, 0.065]}>
            <boxGeometry args={[0.2, 0.02, 0.005]} />
            <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.1} />
          </mesh>
        </group>
      ))}


    </group>
  );
};

export default FactoryCompound3D;
