"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import type { StageId } from "../../types/digitalTwin";

/**
 * FactoryExtras3D — Additional immersive factory details
 *
 * 1. Water reservoir with animated level
 * 2. Per-stage bottle counters
 * 3. Energy consumption meter
 * 4. Shift change animation (workers swap)
 * 5. Forklift loading truck at dispatch
 * 6. QR scanner at dispatch
 *
 * Single useFrame for all animations.
 */

const STAGE_LABELS: [StageId, string][] = [
  ["intake", "IN"],
  ["mixing", "MIX"],
  ["forming", "FORM"],
  ["curing", "CURE"],
  ["quality", "QC"],
  ["packaging", "PACK"],
  ["dispatch", "OUT"],
];

const FactoryExtras3D: React.FC = () => {
  const waterLevelRef = useRef<THREE.Mesh>(null);
  const energyNeedleRef = useRef<THREE.Mesh>(null);
  const energyValueRef = useRef<HTMLDivElement>(null);
  const qrBeamRef = useRef<THREE.Mesh>(null);
  const qrScreenRef = useRef<HTMLDivElement>(null);
  const shiftIndicatorRef = useRef<HTMLDivElement>(null);
  const counterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const loadingForkRef = useRef<THREE.Group>(null);
  const lastCounterUpdate = useRef(0);

  const dispatch = STAGE_POSITIONS.dispatch;
  const quality = STAGE_POSITIONS.quality;
  const packaging = STAGE_POSITIONS.packaging;

  // Water reservoir position — behind the production line, clear of truck paths
  const reservoirPos: [number, number, number] = [
    (quality[0] + packaging[0]) / 2,
    0,
    (quality[2] + packaging[2]) / 2 + 3.0,
  ];

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const now = performance.now();

    // ── 1. Water reservoir level — oscillates slowly ──
    if (waterLevelRef.current) {
      const level = 0.55 + Math.sin(t * 0.2) * 0.15;
      waterLevelRef.current.scale.y = level;
      waterLevelRef.current.position.y = level * 0.7;
    }

    // ── 2. Bottle counters — update every 500ms ──
    if (now - lastCounterUpdate.current > 500) {
      lastCounterUpdate.current = now;
      const state = useDigitalTwinStore.getState();
      const produced = state.totalProduced;
      const stages = state.stages;

      for (let i = 0; i < STAGE_LABELS.length; i++) {
        const el = counterRefs.current[i];
        if (!el) continue;
        const stage = stages.find(s => s.id === STAGE_LABELS[i][0]);
        // Approximate count: produced * stage position fraction
        const frac = (i + 1) / STAGE_LABELS.length;
        const count = Math.floor(produced * frac);
        el.textContent = count.toString();
      }

      // ── 3. Energy meter value ──
      if (energyValueRef.current) {
        // Simulate energy: base 45kW + spikes during blow molding activity
        const blowActive = stages.find(s => s.id === "forming")?.status === "running";
        const baseKW = 45 + Math.sin(t * 0.5) * 5;
        const kw = blowActive ? baseKW + 35 + Math.sin(t * 2) * 10 : baseKW;
        energyValueRef.current.textContent = `${kw.toFixed(0)} kW`;
        energyValueRef.current.style.color = kw > 70 ? "#f59e0b" : "#10b981";
      }

      // ── Shift indicator ──
      if (shiftIndicatorRef.current) {
        const hour = (Math.floor(t / 30) % 3); // Change shift every 30 seconds for demo
        const shifts = ["Morning (6AM-2PM)", "Afternoon (2PM-10PM)", "Night (10PM-6AM)"];
        const colors = ["#fbbf24", "#f97316", "#6366f1"];
        shiftIndicatorRef.current.textContent = shifts[hour];
        shiftIndicatorRef.current.style.color = colors[hour];
      }
    }

    // ── 3. Energy needle rotation ──
    if (energyNeedleRef.current) {
      const baseAngle = -Math.PI * 0.4;
      const kw = 45 + Math.sin(t * 0.5) * 5 + (Math.sin(t * 2) > 0 ? 35 : 0);
      const normalized = Math.min(1, kw / 120);
      energyNeedleRef.current.rotation.z = baseAngle + normalized * Math.PI * 0.8;
    }

    // ── 5. Loading forklift at dispatch — drives between pallets and truck ──
    if (loadingForkRef.current) {
      const cycle = (t * 0.4) % 6;
      let x: number, z: number, rot: number;
      if (cycle < 1.5) {
        // Drive to pallet
        const p = cycle / 1.5;
        x = dispatch[0] + 2.5;
        z = dispatch[2] + 2.5 - p * 4;
        rot = Math.PI;
      } else if (cycle < 2) {
        // Pick up (pause)
        x = dispatch[0] + 2.5; z = dispatch[2] - 1.5; rot = Math.PI;
      } else if (cycle < 3.5) {
        // Drive to truck
        const p = (cycle - 2) / 1.5;
        x = dispatch[0] + 2.5 + p * 2;
        z = dispatch[2] - 1.5 - p * 2;
        rot = Math.PI + p * Math.PI / 3;
      } else if (cycle < 4) {
        // Unload (pause)
        x = dispatch[0] + 4.5; z = dispatch[2] - 3.5; rot = Math.PI * 4 / 3;
      } else {
        // Return
        const p = (cycle - 4) / 2;
        x = dispatch[0] + 4.5 - p * 2;
        z = dispatch[2] - 3.5 + p * 6;
        rot = 0;
      }
      loadingForkRef.current.position.set(x, 0, z);
      loadingForkRef.current.rotation.y = rot;
    }

    // ── 6. QR scanner beam sweep ──
    if (qrBeamRef.current) {
      const sweep = Math.sin(t * 3) * 0.15;
      qrBeamRef.current.position.x = sweep;
      const mat = qrBeamRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + Math.abs(Math.sin(t * 5)) * 0.3;
    }

    // QR screen update
    if (qrScreenRef.current && now - lastCounterUpdate.current < 100) {
      const produced = useDigitalTwinStore.getState().totalProduced;
      const palletNum = Math.floor(produced / 24) + 1;
      qrScreenRef.current.textContent = `PLT-${String(palletNum).padStart(4, "0")}`;
    }
  });

  return (
    <group>
      {/* ══════ 1. WATER RESERVOIR ══════ */}
      <group position={reservoirPos}>
        {/* Tank body — transparent glass so water is visible */}
        <mesh position={[0, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.8, 0.8, 2.2, 20, 1, true]} />
          <meshStandardMaterial color="#a5c4e8" metalness={0.2} roughness={0.05} transparent opacity={0.12} side={THREE.DoubleSide} />
        </mesh>
        {/* Thin bands on outside of tank */}
        {[0.1, 1.2, 2.3].map((y, i) => (
          <mesh key={`band${i}`} position={[0, y, 0]}>
            <cylinderGeometry args={[0.83, 0.83, 0.03, 20, 1, true]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {/* Tank top lid */}
        <mesh position={[0, 2.32, 0]}>
          <cylinderGeometry args={[0.82, 0.82, 0.05, 20]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} transparent opacity={0.5} />
        </mesh>
        {/* Tank bottom */}
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.82, 0.82, 0.05, 20]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Water level inside — clearly visible blue */}
        <mesh ref={waterLevelRef} position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.75, 0.75, 1.4, 20]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.45} emissive="#2563eb" emissiveIntensity={0.2} />
        </mesh>
        {/* Water surface shimmer (top of water) */}
        <mesh position={[0, 1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.74, 20]} />
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.3} emissive="#3b82f6" emissiveIntensity={0.15} />
        </mesh>
        {/* Sight glass (vertical window) */}
        <mesh position={[0.81, 1.2, 0]}>
          <boxGeometry args={[0.03, 1.8, 0.12]} />
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.4} emissive="#3b82f6" emissiveIntensity={0.1} />
        </mesh>
        {/* Level markings on sight glass */}
        {[0.5, 0.8, 1.1, 1.4, 1.7].map((y, i) => (
          <mesh key={i} position={[0.83, y, 0]}>
            <boxGeometry args={[0.01, 0.005, 0.08]} />
            <meshBasicMaterial color="#e2e8f0" transparent opacity={0.5} />
          </mesh>
        ))}
        {/* Inlet pipe */}
        <mesh position={[0.4, 2.0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
          <meshStandardMaterial color="#3b82f6" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Outlet pipe */}
        <mesh position={[0.4, 0.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.5, 6]} />
          <meshStandardMaterial color="#3b82f6" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Label */}
        <Html position={[0, 2.6, 0]} center distanceFactor={12} style={{ pointerEvents: "none", willChange: "transform" }}>
          <div style={{ background: "rgba(10,22,40,0.9)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "4px", padding: "2px 8px", fontSize: "8px", fontWeight: 700, color: "#93c5fd", fontFamily: "'Inter', system-ui", whiteSpace: "nowrap" }}>
            COCA-COLA PROCESS WATER — 5000L
          </div>
        </Html>
        {/* Tank supports */}
        {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.03, z]}>
            <boxGeometry args={[0.08, 0.06, 0.08]} />
            <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* ══════ 2. PER-STAGE BOTTLE COUNTERS ══════ */}
      {STAGE_LABELS.map(([stageId, label], i) => {
        const pos = STAGE_POSITIONS[stageId];
        return (
          <Html key={stageId} position={[pos[0], pos[1] - 0.3, pos[2] + 0.8]} center distanceFactor={14} style={{ pointerEvents: "none", willChange: "transform" }}>
            <div style={{ background: "rgba(10,22,40,0.85)", border: "1px solid rgba(100,116,139,0.2)", borderRadius: "4px", padding: "2px 6px", textAlign: "center", fontFamily: "'Inter', system-ui" }}>
              <div style={{ fontSize: "7px", color: "#64748b", letterSpacing: "0.1em" }}>{label}</div>
              <div ref={(el) => { counterRefs.current[i] = el; }} style={{ fontSize: "11px", fontWeight: 800, color: "#10b981", fontVariantNumeric: "tabular-nums" }}>0</div>
            </div>
          </Html>
        );
      })}

      {/* ══════ 3. ENERGY CONSUMPTION METER ══════ */}
      <group position={[-9, 0, -3]}>
        {/* Meter housing */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[0.8, 1.0, 0.15]} />
          <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.6} />
        </mesh>
        {/* Gauge face */}
        <mesh position={[0, 1.1, 0.08]}>
          <circleGeometry args={[0.25, 24]} />
          <meshStandardMaterial color="#0f172a" metalness={0.2} roughness={0.8} />
        </mesh>
        {/* Gauge markings (arc) */}
        <mesh position={[0, 1.1, 0.085]}>
          <torusGeometry args={[0.22, 0.008, 4, 24, Math.PI * 0.8]} />
          <meshStandardMaterial color="#4b5563" metalness={0.5} roughness={0.5} />
        </mesh>
        {/* Needle */}
        <mesh ref={energyNeedleRef} position={[0, 1.1, 0.09]} rotation={[0, 0, -Math.PI * 0.4]}>
          <boxGeometry args={[0.005, 0.2, 0.005]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
        </mesh>
        {/* Needle center dot */}
        <mesh position={[0, 1.1, 0.09]}>
          <circleGeometry args={[0.02, 8]} />
          <meshStandardMaterial color="#6b7280" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Digital readout */}
        <Html position={[0, 0.7, 0.08]} center distanceFactor={10} style={{ pointerEvents: "none", willChange: "transform" }}>
          <div style={{ textAlign: "center", fontFamily: "'Inter', system-ui" }}>
            <div ref={energyValueRef} style={{ fontSize: "14px", fontWeight: 800, color: "#10b981", fontVariantNumeric: "tabular-nums" }}>45 kW</div>
            <div style={{ fontSize: "7px", color: "#64748b", letterSpacing: "0.1em" }}>POWER</div>
          </div>
        </Html>
        {/* Warning zones on gauge face */}
        <mesh position={[0.12, 1.22, 0.086]}>
          <circleGeometry args={[0.03, 6]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.3} />
        </mesh>
        {/* Stand */}
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.1, 0.5, 0.1]} />
          <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Label */}
        <Html position={[0, 1.7, 0]} center distanceFactor={12} style={{ pointerEvents: "none", willChange: "transform" }}>
          <div style={{ background: "rgba(10,22,40,0.9)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "4px", padding: "2px 8px", fontSize: "8px", fontWeight: 700, color: "#fbbf24", fontFamily: "'Inter', system-ui", whiteSpace: "nowrap" }}>
            ENERGY METER
          </div>
        </Html>
      </group>

      {/* ══════ 4. SHIFT INDICATOR ══════ */}
      <Html position={[8, 3.5, 6]} center distanceFactor={15} style={{ pointerEvents: "none", willChange: "transform" }}>
        <div style={{ background: "rgba(10,22,40,0.9)", border: "1px solid rgba(100,116,139,0.3)", borderRadius: "6px", padding: "6px 12px", textAlign: "center", fontFamily: "'Inter', system-ui" }}>
          <div style={{ fontSize: "7px", color: "#64748b", letterSpacing: "0.12em", marginBottom: "3px" }}>CURRENT SHIFT</div>
          <div ref={shiftIndicatorRef} style={{ fontSize: "11px", fontWeight: 700, color: "#fbbf24" }}>Morning (6AM-2PM)</div>
        </div>
      </Html>

      {/* ══════ 6. QR SCANNER AT DISPATCH ══════ */}
      <group position={[dispatch[0] + 1.0, 0, dispatch[2] - 0.8]}>
        {/* Scanner housing */}
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[0.2, 0.25, 0.15]} />
          <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
        </mesh>
        {/* Scanner window */}
        <mesh position={[0, 0.88, 0.08]}>
          <planeGeometry args={[0.12, 0.08]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
        </mesh>
        {/* Laser scan line */}
        <mesh ref={qrBeamRef} position={[0, 0.75, 0.15]}>
          <planeGeometry args={[0.01, 0.3]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
        {/* Stand */}
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.02, 0.025, 0.8, 6]} />
          <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Screen showing scanned pallet ID */}
        <Html position={[0, 1.15, 0]} center distanceFactor={10} style={{ pointerEvents: "none", willChange: "transform" }}>
          <div style={{ background: "rgba(10,22,40,0.9)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "4px", padding: "3px 8px", textAlign: "center", fontFamily: "'Inter', system-ui" }}>
            <div style={{ fontSize: "6px", color: "#64748b", letterSpacing: "0.1em" }}>SCANNED</div>
            <div ref={qrScreenRef} style={{ fontSize: "10px", fontWeight: 800, color: "#22c55e", fontFamily: "monospace" }}>PLT-0001</div>
          </div>
        </Html>
      </group>
    </group>
  );
};

export default FactoryExtras3D;
