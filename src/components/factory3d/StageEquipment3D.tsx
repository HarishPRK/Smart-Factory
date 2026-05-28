"use no memo";
import React from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { StageId } from "../../types/digitalTwin";
import pepsicoLogo from "../../assets/pepsico-logo.png";

/**
 * StageEquipment3D — Large-scale PET bottle manufacturing equipment
 *
 * Scaled 1.8x from original. Each station has:
 *  - Primary machine (large, detailed)
 *  - Control cabinet with screen
 *  - Safety barriers (yellow/black)
 *  - Utility connections (pipes, cables, conduit)
 *  - Floor-level details (drip trays, cable routing)
 */

const S = { metalness: 0.8, roughness: 0.2 };
const DS = { color: "#374151", ...S };
const LS = { color: "#9ca3af", ...S };
const YELLOW = { color: "#fbbf24", roughness: 0.4, metalness: 0.3 };
const PANEL = { color: "#1e293b", metalness: 0.3, roughness: 0.7 };

/* ── Shared: Control Cabinet ── */
const ControlCabinet: React.FC<{ position: [number, number, number]; rotation?: [number, number, number] }> = ({
  position, rotation = [0, 0, 0],
}) => (
  <group position={position} rotation={rotation}>
    <mesh castShadow>
      <boxGeometry args={[0.3, 0.7, 0.18]} />
      <meshStandardMaterial color="#1f2937" metalness={0.4} roughness={0.6} />
    </mesh>
    {/* Door handle */}
    <mesh position={[0.1, 0, 0.1]}>
      <boxGeometry args={[0.02, 0.08, 0.02]} />
      <meshStandardMaterial {...LS} />
    </mesh>
    {/* Status screen */}
    <mesh position={[0, 0.15, 0.095]}>
      <planeGeometry args={[0.18, 0.12]} />
      <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.25} />
    </mesh>
    {/* Warning label */}
    <mesh position={[0, -0.2, 0.095]}>
      <planeGeometry args={[0.12, 0.04]} />
      <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.1} />
    </mesh>
    {/* Cable entry (bottom) */}
    <mesh position={[0, -0.38, 0]}>
      <cylinderGeometry args={[0.04, 0.04, 0.04, 8]} />
      <meshStandardMaterial {...DS} />
    </mesh>
  </group>
);

/* ── Shared: Safety Barrier Post ── */
const SafetyPost: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh castShadow>
      <cylinderGeometry args={[0.025, 0.03, 0.7, 6]} />
      <meshStandardMaterial {...YELLOW} />
    </mesh>
    <mesh position={[0, 0.35, 0]}>
      <sphereGeometry args={[0.035, 6, 6]} />
      <meshStandardMaterial {...YELLOW} />
    </mesh>
    {/* Base plate */}
    <mesh position={[0, -0.34, 0]}>
      <cylinderGeometry args={[0.06, 0.06, 0.02, 8]} />
      <meshStandardMaterial {...DS} />
    </mesh>
  </group>
);

/* ── Shared: Pipe Run ── */
const PipeRun: React.FC<{ from: [number, number, number]; to: [number, number, number]; color?: string; radius?: number }> = ({
  from, to, color = "#6b7280", radius = 0.02,
}) => {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const mx = (from[0] + to[0]) / 2, my = (from[1] + to[1]) / 2, mz = (from[2] + to[2]) / 2;
  const rotY = Math.atan2(dx, dz);
  const rotX = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
  return (
    <group>
      <mesh position={[mx, my, mz]} rotation={[rotX, rotY, 0]}>
        <cylinderGeometry args={[radius, radius, len, 6]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={from}><sphereGeometry args={[radius * 1.5, 6, 6]} /><meshStandardMaterial color={color} {...S} /></mesh>
      <mesh position={to}><sphereGeometry args={[radius * 1.5, 6, 6]} /><meshStandardMaterial color={color} {...S} /></mesh>
    </group>
  );
};

/* ── Intake: Large PET Resin Silo + Vibratory Feeder ── */
const IntakeEquipment: React.FC = () => (
  <group>
    {/* Main silo — Pepsi blue */}
    <mesh position={[0, 1.4, -1.0]} castShadow>
      <cylinderGeometry args={[0.7, 0.7, 1.8, 16]} />
      <meshStandardMaterial color="#004B93" {...S} />
    </mesh>
    <mesh position={[0, 2.35, -1.0]}>
      <coneGeometry args={[0.7, 0.3, 16]} />
      <meshStandardMaterial color="#004B93" {...S} />
    </mesh>
    {/* PepsiCo logo sign on silo — the official PNG, mounted on a clean white
        plate so the colourful mark + navy wordmark read against the dark silo
        (faces camera via drei <Html>) */}
    <Html
      position={[0, 1.4, -0.3]}
      center
      distanceFactor={6}
      style={{ pointerEvents: "none", willChange: "transform" }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "10px",
          padding: "8px 12px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
        }}
      >
        <img
          src={pepsicoLogo}
          alt="PepsiCo"
          style={{ height: "70px", width: "auto", display: "block" }}
        />
      </div>
    </Html>
    <mesh position={[0, 0.4, -1.0]}>
      <coneGeometry args={[0.25, 0.4, 12]} />
      <meshStandardMaterial color="#52525b" {...S} />
    </mesh>
    {/* Silo bands */}
    {[0.8, 1.2, 1.6, 2.0].map((y, i) => (
      <mesh key={i} position={[0, y, -1.0]}>
        <torusGeometry args={[0.71, 0.02, 4, 16]} />
        <meshStandardMaterial color="#52525b" metalness={0.9} roughness={0.1} />
      </mesh>
    ))}
    {/* Support frame */}
    {[[-0.5, -0.7], [0.5, -0.7], [-0.5, -1.3], [0.5, -1.3]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.25, z]} castShadow>
        <boxGeometry args={[0.06, 0.5, 0.06]} />
        <meshStandardMaterial {...DS} />
      </mesh>
    ))}
    {/* Vibratory feeder trough */}
    <mesh position={[0, 0.15, -0.4]} castShadow>
      <boxGeometry args={[0.5, 0.08, 0.8]} />
      <meshStandardMaterial {...LS} />
    </mesh>
    <mesh position={[0, 0.2, -0.4]}>
      <boxGeometry args={[0.45, 0.04, 0.75]} />
      <meshStandardMaterial color="#52525b" {...S} />
    </mesh>
    {/* Vibrator motor */}
    <mesh position={[0.3, 0.05, -0.4]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.06, 0.06, 0.12, 8]} />
      <meshStandardMaterial color="#059669" metalness={0.6} roughness={0.3} />
    </mesh>
    {/* Resin bags on pallet */}
    <mesh position={[-1.0, 0.08, -0.6]} castShadow>
      <boxGeometry args={[0.5, 0.06, 0.5]} />
      <meshStandardMaterial color="#92400e" roughness={0.9} metalness={0.05} />
    </mesh>
    {[0, 1, 2].map((i) => (
      <mesh key={`bag${i}`} position={[-1.0, 0.2 + i * 0.15, -0.6]} castShadow>
        <boxGeometry args={[0.4, 0.12, 0.4]} />
        <meshStandardMaterial color={i % 2 === 0 ? "#e2e8f0" : "#cbd5e1"} roughness={0.9} metalness={0.05} />
      </mesh>
    ))}
    <ControlCabinet position={[0.8, 0.35, 0.5]} rotation={[0, -Math.PI / 4, 0]} />
    <SafetyPost position={[-0.8, -0.15, 0.6]} />
    <SafetyPost position={[0.8, -0.15, 0.8]} />
  </group>
);

/* ── Mixing (now "Filling"): replaced by RotaryFiller in ProcessPipeline3D ── */
const MixingEquipment: React.FC = () => null;

/* ── Mixing: Large Compounding Reactor (legacy, no longer rendered) ── */
const _MixingEquipmentLegacy: React.FC = () => (
  <group>
    {/* Main reactor vessel */}
    <mesh position={[0, 1.0, -0.8]} castShadow>
      <cylinderGeometry args={[0.65, 0.65, 1.6, 20]} />
      <meshStandardMaterial color="#dc2626" {...S} />
    </mesh>
    <mesh position={[0, 1.82, -0.8]}>
      <cylinderGeometry args={[0.67, 0.67, 0.06, 20]} />
      <meshStandardMaterial color="#52525b" metalness={0.9} roughness={0.1} />
    </mesh>
    <mesh position={[0, 0.18, -0.8]}>
      <sphereGeometry args={[0.65, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#dc2626" {...S} />
    </mesh>
    {/* Pressure bands */}
    {[0.5, 0.8, 1.1, 1.4].map((y, i) => (
      <mesh key={i} position={[0, y, -0.8]}>
        <torusGeometry args={[0.66, 0.018, 4, 20]} />
        <meshStandardMaterial color="#52525b" metalness={0.9} roughness={0.1} />
      </mesh>
    ))}
    {/* Agitator motor */}
    <mesh position={[0, 2.0, -0.8]} castShadow>
      <cylinderGeometry args={[0.12, 0.12, 0.25, 10]} />
      <meshStandardMaterial color="#059669" metalness={0.6} roughness={0.3} />
    </mesh>
    <mesh position={[0, 2.15, -0.8]}>
      <cylinderGeometry args={[0.05, 0.05, 0.08, 8]} />
      <meshStandardMaterial {...LS} />
    </mesh>
    {/* Sight glasses */}
    {[0, Math.PI / 2].map((angle, i) => (
      <mesh key={i} position={[Math.cos(angle) * 0.66, 0.8, -0.8 + Math.sin(angle) * 0.66]} rotation={[0, -angle, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.03, 12]} />
        <meshStandardMaterial color="#22d3ee" transparent opacity={0.5} emissive="#22d3ee" emissiveIntensity={0.2} />
      </mesh>
    ))}
    {/* Input/output pipes */}
    <PipeRun from={[-0.5, 1.5, -0.3]} to={[-0.5, 1.5, -0.8]} color="#ef4444" radius={0.03} />
    <PipeRun from={[0.5, 0.5, -0.5]} to={[0.5, 0.5, -0.8]} color="#3b82f6" radius={0.025} />
    <PipeRun from={[0, 0.5, -0.15]} to={[0, 0.5, -0.4]} color="#3b82f6" radius={0.025} />
    {/* Valves */}
    {[[0.5, 0.5, -0.5], [-0.5, 1.5, -0.3]].map(([x, y, z], i) => (
      <mesh key={`v${i}`} position={[x, y, z]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={i === 0 ? "#3b82f6" : "#ef4444"} roughness={0.4} metalness={0.5} />
      </mesh>
    ))}
    {/* Secondary tank (additive) */}
    <mesh position={[-0.8, 0.5, -1.2]} castShadow>
      <cylinderGeometry args={[0.2, 0.2, 0.6, 10]} />
      <meshStandardMaterial color="#78716c" {...S} />
    </mesh>
    <PipeRun from={[-0.8, 0.8, -1.2]} to={[-0.3, 1.2, -0.8]} color="#f59e0b" radius={0.015} />
    <ControlCabinet position={[0.9, 0.35, 0.4]} rotation={[0, -Math.PI / 3, 0]} />
    <SafetyPost position={[-0.9, -0.15, 0.6]} />
    <SafetyPost position={[0.9, -0.15, 0.7]} />
  </group>
);

/* ── Forming: handled by in-line BlowMolderTunnel in ProcessPipeline3D ── */
const FormingEquipment: React.FC = () => null;

/* ── Forming: Injection + Blow Molding Press (legacy, no longer rendered) ── */
const _FormingEquipmentLegacy: React.FC = () => (
  <group>
    {/* Main press frame */}
    <mesh position={[0, 0.9, -0.8]} castShadow>
      <boxGeometry args={[1.2, 1.8, 0.2]} />
      <meshStandardMaterial color="#1e40af" metalness={0.7} roughness={0.25} />
    </mesh>
    {/* Upper platen */}
    <mesh position={[0, 1.6, -0.4]} castShadow>
      <boxGeometry args={[1.0, 0.12, 0.6]} />
      <meshStandardMaterial {...DS} />
    </mesh>
    {/* Lower platen */}
    <mesh position={[0, 0.3, -0.4]} castShadow>
      <boxGeometry args={[1.0, 0.15, 0.6]} />
      <meshStandardMaterial {...DS} />
    </mesh>
    {/* Tie bars (4 corner rods) */}
    {[[-0.4, -0.5], [0.4, -0.5], [-0.4, -0.25], [0.4, -0.25]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.95, z]}>
        <cylinderGeometry args={[0.03, 0.03, 1.4, 8]} />
        <meshStandardMaterial color="#e4e4e7" metalness={0.95} roughness={0.05} />
      </mesh>
    ))}
    {/* Hydraulic rams */}
    {[-0.3, 0.3].map((x, i) => (
      <group key={i}>
        <mesh position={[x, 1.2, -0.4]}>
          <cylinderGeometry args={[0.06, 0.06, 0.6, 10]} />
          <meshStandardMaterial color="#a1a1aa" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[x, 0.8, -0.4]}>
          <cylinderGeometry args={[0.025, 0.025, 0.6, 6]} />
          <meshStandardMaterial color="#e4e4e7" metalness={0.95} roughness={0.05} />
        </mesh>
      </group>
    ))}
    {/* Mold (bottle cavity) */}
    <mesh position={[0, 0.85, -0.35]}>
      <cylinderGeometry args={[0.12, 0.18, 0.6, 12]} />
      <meshStandardMaterial color="#334155" transparent opacity={0.5} metalness={0.5} roughness={0.3} />
    </mesh>
    {/* Blow air manifold */}
    <mesh position={[0, 1.7, -0.3]} castShadow>
      <boxGeometry args={[0.6, 0.08, 0.12]} />
      <meshStandardMaterial color="#52525b" {...S} />
    </mesh>
    <PipeRun from={[0, 1.7, -0.24]} to={[0, 1.7, 0.1]} color="#f59e0b" radius={0.02} />
    {/* Preform feeder */}
    <mesh position={[-0.8, 1.0, -0.2]} rotation={[0, 0, -0.3]} castShadow>
      <boxGeometry args={[0.4, 0.06, 0.2]} />
      <meshStandardMaterial {...LS} />
    </mesh>
    {/* Hydraulic power unit */}
    <mesh position={[0.8, 0.25, -0.8]} castShadow>
      <boxGeometry args={[0.4, 0.5, 0.3]} />
      <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
    </mesh>
    <mesh position={[0.8, 0.55, -0.8]}>
      <cylinderGeometry args={[0.08, 0.08, 0.1, 8]} />
      <meshStandardMaterial color="#059669" metalness={0.6} roughness={0.3} />
    </mesh>
    {/* Safety light curtain (yellow pillars) */}
    {[-0.65, 0.65].map((x, i) => (
      <mesh key={i} position={[x, 0.9, 0.15]} castShadow>
        <boxGeometry args={[0.04, 1.8, 0.04]} />
        <meshStandardMaterial {...YELLOW} />
      </mesh>
    ))}
    {/* Guard mesh */}
    <mesh position={[0, 0.9, 0.18]}>
      <planeGeometry args={[1.26, 1.7]} />
      <meshStandardMaterial color="#fbbf24" transparent opacity={0.06} side={THREE.DoubleSide} />
    </mesh>
    <ControlCabinet position={[1.0, 0.35, 0.5]} rotation={[0, -Math.PI / 3, 0]} />
    <SafetyPost position={[-1.0, -0.15, 0.6]} />
  </group>
);

/* ── Curing: handled by in-line CoolingTunnelInline in ProcessPipeline3D ── */
const CuringEquipment: React.FC = () => null;

/* ── Curing: Cooling Tunnel with Fans (legacy, no longer rendered) ── */
const _CuringEquipmentLegacy: React.FC = () => (
  <group>
    {/* Main tunnel body */}
    <mesh position={[0, 0.65, -0.6]} castShadow>
      <boxGeometry args={[1.6, 1.2, 1.0]} />
      <meshStandardMaterial color="#44403c" metalness={0.6} roughness={0.4} />
    </mesh>
    {/* Front opening */}
    <mesh position={[0, 0.65, -0.08]}>
      <boxGeometry args={[0.9, 0.8, 0.04]} />
      <meshStandardMaterial color="#1c1917" metalness={0.4} roughness={0.6} />
    </mesh>
    {/* Interior glow */}
    <mesh position={[0, 0.65, -0.15]}>
      <boxGeometry args={[0.8, 0.7, 0.02]} />
      <meshStandardMaterial color="#ea580c" emissive="#ea580c" emissiveIntensity={0.5} />
    </mesh>
    {/* Heat coils */}
    {[0.35, 0.55, 0.75, 0.95].map((y, i) => (
      <mesh key={i} position={[0, y, -0.6]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.25, 0.008, 4, 24]} />
        <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.3} />
      </mesh>
    ))}
    {/* Exhaust stack */}
    <mesh position={[0, 1.45, -0.6]} castShadow>
      <cylinderGeometry args={[0.15, 0.12, 0.4, 8]} />
      <meshStandardMaterial color="#78716c" metalness={0.7} roughness={0.3} />
    </mesh>
    <mesh position={[0, 1.7, -0.6]}>
      <cylinderGeometry args={[0.2, 0.2, 0.05, 8]} />
      <meshStandardMaterial {...DS} />
    </mesh>
    {/* Cooling fan banks (both sides) */}
    {[-0.85, 0.85].map((x, i) => (
      <group key={i}>
        <mesh position={[x, 0.65, -0.6]} castShadow>
          <boxGeometry args={[0.08, 0.6, 0.6]} />
          <meshStandardMaterial color="#52525b" {...S} />
        </mesh>
        {/* Fan grilles */}
        {[0.45, 0.65, 0.85].map((y, j) => (
          <mesh key={j} position={[x > 0 ? x + 0.05 : x - 0.05, y, -0.6]} rotation={[0, 0, Math.PI / 2]}>
            <circleGeometry args={[0.1, 12]} />
            <meshStandardMaterial color="#6b7280" metalness={0.5} roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    ))}
    {/* Temperature display panel */}
    <mesh position={[0.6, 1.0, -0.08]} castShadow>
      <boxGeometry args={[0.2, 0.12, 0.03]} />
      <meshStandardMaterial {...PANEL} />
    </mesh>
    <mesh position={[0.6, 1.0, -0.06]}>
      <planeGeometry args={[0.16, 0.08]} />
      <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.4} />
    </mesh>
    {/* Warning stripes at entrance */}
    {[-0.45, 0.45].map((x, i) => (
      <mesh key={i} position={[x, 0.25, -0.06]}>
        <boxGeometry args={[0.05, 0.8, 0.02]} />
        <meshStandardMaterial {...YELLOW} />
      </mesh>
    ))}
    <ControlCabinet position={[-1.0, 0.35, 0.3]} rotation={[0, Math.PI / 4, 0]} />
    <PipeRun from={[-0.4, 1.3, -0.1]} to={[-0.4, 1.3, -0.6]} color="#3b82f6" radius={0.02} />
    <PipeRun from={[0.4, 1.3, -0.1]} to={[0.4, 1.3, -0.6]} color="#ef4444" radius={0.02} />
  </group>
);

/* ── Quality: Multi-Camera Inspection Cell ── */
const QualityEquipment: React.FC = () => (
  <group>
    {/* Enclosure frame (open front) */}
    {[[-0.6, -0.7], [0.6, -0.7], [-0.6, 0.3], [0.6, 0.3]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.7, z]} castShadow>
        <boxGeometry args={[0.05, 1.4, 0.05]} />
        <meshStandardMaterial color="#1e293b" {...S} />
      </mesh>
    ))}
    {/* Top frame */}
    <mesh position={[0, 1.4, -0.2]}>
      <boxGeometry args={[1.25, 0.05, 1.05]} />
      <meshStandardMaterial color="#1e293b" {...S} />
    </mesh>
    {/* Camera array — 3 cameras */}
    {[[-0.3, 1.3, -0.5], [0, 1.35, -0.6], [0.3, 1.3, -0.5]].map(([x, y, z], i) => (
      <group key={i} position={[x, y, z]} rotation={[0.4, i === 1 ? 0 : i === 0 ? 0.3 : -0.3, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.12, 0.08, 0.1]} />
          <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.02, 0.06]}>
          <cylinderGeometry args={[0.025, 0.02, 0.05, 10]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, -0.02, 0.09]}>
          <circleGeometry args={[0.02, 10]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.6} transparent opacity={0.7} />
        </mesh>
        {/* Camera LED */}
        <mesh position={[0.04, 0.03, 0.055]}>
          <sphereGeometry args={[0.008, 6, 6]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.8} />
        </mesh>
      </group>
    ))}
    {/* Backlight panel */}
    <mesh position={[0, 0.5, -0.68]}>
      <boxGeometry args={[0.8, 0.8, 0.04]} />
      <meshStandardMaterial color="#f8fafc" emissive="#f8fafc" emissiveIntensity={0.35} />
    </mesh>
    {/* Laser measurement grid */}
    {[-0.3, -0.15, 0, 0.15, 0.3].map((x, i) => (
      <mesh key={`lh${i}`} position={[x, -0.44, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.002, 0.6, 0.001]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.0} transparent opacity={0.3} />
      </mesh>
    ))}
    {[-0.2, 0, 0.2].map((z, i) => (
      <mesh key={`lv${i}`} position={[0, -0.44, -0.2 + z]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <boxGeometry args={[0.002, 0.7, 0.001]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.0} transparent opacity={0.3} />
      </mesh>
    ))}
    {/* Reject chute + bin */}
    <mesh position={[0.7, 0.2, 0.3]} rotation={[0, 0, -0.4]} castShadow>
      <boxGeometry args={[0.35, 0.03, 0.2]} />
      <meshStandardMaterial color="#ef4444" roughness={0.4} metalness={0.5} />
    </mesh>
    <mesh position={[0.9, 0.12, 0.3]} castShadow>
      <boxGeometry args={[0.25, 0.24, 0.25]} />
      <meshStandardMaterial color="#dc2626" roughness={0.6} metalness={0.3} />
    </mesh>
    {/* Monitor on arm */}
    <mesh position={[-0.8, 0.8, -0.2]}>
      <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
      <meshStandardMaterial {...DS} />
    </mesh>
    <mesh position={[-0.8, 1.1, -0.1]} rotation={[0.1, 0.3, 0]}>
      <boxGeometry args={[0.35, 0.22, 0.03]} />
      <meshStandardMaterial {...PANEL} />
    </mesh>
    <mesh position={[-0.8, 1.1, -0.08]} rotation={[0.1, 0.3, 0]}>
      <planeGeometry args={[0.3, 0.18]} />
      <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.2} />
    </mesh>
    <ControlCabinet position={[1.0, 0.35, -0.5]} rotation={[0, -Math.PI / 2, 0]} />
    <SafetyPost position={[-0.8, -0.15, 0.5]} />
    <SafetyPost position={[0.8, -0.15, 0.5]} />
  </group>
);

/* ── Packaging: Shrink Wrapper + Case Packer ── */
const PackagingEquipment: React.FC = () => (
  <group>
    {/* Main wrapper frame */}
    <mesh position={[0, 0.8, -0.6]} castShadow>
      <boxGeometry args={[1.2, 1.4, 0.08]} />
      <meshStandardMaterial color="#52525b" {...S} />
    </mesh>
    {[-0.62, 0.62].map((x, i) => (
      <mesh key={i} position={[x, 0.8, -0.3]} castShadow>
        <boxGeometry args={[0.06, 1.4, 0.55]} />
        <meshStandardMaterial color="#6b7280" {...S} />
      </mesh>
    ))}
    {/* Top cross beam */}
    <mesh position={[0, 1.45, -0.3]}>
      <boxGeometry args={[1.3, 0.08, 0.08]} />
      <meshStandardMaterial {...DS} />
    </mesh>
    {/* Heat seal bar */}
    <mesh position={[0, 1.3, -0.3]}>
      <boxGeometry args={[0.9, 0.04, 0.06]} />
      <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.3} metalness={0.7} roughness={0.2} />
    </mesh>
    {/* Shrink tunnel (heated section) */}
    <mesh position={[0, 0.5, -0.3]} castShadow>
      <boxGeometry args={[1.1, 0.7, 0.5]} />
      <meshStandardMaterial color="#44403c" metalness={0.5} roughness={0.5} />
    </mesh>
    <mesh position={[0, 0.5, -0.04]}>
      <boxGeometry args={[0.7, 0.5, 0.02]} />
      <meshStandardMaterial color="#ea580c" emissive="#ea580c" emissiveIntensity={0.2} />
    </mesh>
    {/* Film rolls (both sides) */}
    {[-0.8, 0.8].map((x, i) => (
      <group key={i}>
        <mesh position={[x, 0.9, -0.3]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
          <meshStandardMaterial color="#e2e8f0" transparent opacity={0.25} roughness={0.9} metalness={0.05} />
        </mesh>
        <mesh position={[x, 0.9, -0.3]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.11, 10]} />
          <meshStandardMaterial {...LS} />
        </mesh>
      </group>
    ))}
    {/* Case packer output */}
    <mesh position={[0.6, 0.15, 0.5]} castShadow>
      <boxGeometry args={[0.4, 0.3, 0.3]} />
      <meshStandardMaterial color="#e2e8f0" transparent opacity={0.3} roughness={0.6} metalness={0.1} />
    </mesh>
    <mesh position={[-0.6, 0.15, 0.5]} castShadow>
      <boxGeometry args={[0.35, 0.25, 0.3]} />
      <meshStandardMaterial color="#e2e8f0" transparent opacity={0.3} roughness={0.6} metalness={0.1} />
    </mesh>
    <ControlCabinet position={[1.0, 0.35, 0.4]} rotation={[0, -Math.PI / 3, 0]} />
    <SafetyPost position={[-0.9, -0.15, 0.6]} />
    <SafetyPost position={[0.9, -0.15, 0.6]} />
  </group>
);

/* ── Dispatch: Loading Dock + Palletizer ── */
const DispatchEquipment: React.FC = () => (
  <group>
    {/* Palletizer frame */}
    <mesh position={[0, 0.9, -0.8]} castShadow>
      <boxGeometry args={[1.0, 1.6, 0.08]} />
      <meshStandardMaterial color="#374151" {...S} />
    </mesh>
    {[[-0.5, -0.5], [0.5, -0.5]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.85, z]} castShadow>
        <boxGeometry args={[0.06, 1.5, 0.06]} />
        <meshStandardMaterial {...DS} />
      </mesh>
    ))}
    {/* Loading ramp */}
    <mesh position={[0.4, 0.02, -0.7]} rotation={[0, 0, -0.12]} castShadow>
      <boxGeometry args={[1.0, 0.05, 0.8]} />
      <meshStandardMaterial color="#52525b" metalness={0.6} roughness={0.4} />
    </mesh>
    {/* Non-slip strips */}
    {[-0.3, -0.15, 0, 0.15, 0.3].map((x, i) => (
      <mesh key={i} position={[x + 0.4, 0.05, -0.7]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.04, 0.008, 0.75]} />
        <meshStandardMaterial {...YELLOW} />
      </mesh>
    ))}
    {/* Gate barrier */}
    <mesh position={[-0.6, 0.5, -0.5]} castShadow>
      <cylinderGeometry args={[0.03, 0.035, 1.0, 6]} />
      <meshStandardMaterial color="#dc2626" {...S} />
    </mesh>
    <mesh position={[-0.2, 1.0, -0.5]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.02, 0.02, 0.8, 6]} />
      <meshStandardMaterial {...YELLOW} />
    </mesh>
    {/* Pallets with stacked Pepsi cartons */}
    {[0, 1, 2].map((i) => (
      <group key={i} position={[-0.1 + i * 0.5, 0, -1.2]}>
        {/* Wooden pallet */}
        <mesh position={[0, 0.05, 0]} castShadow>
          <boxGeometry args={[0.4, 0.05, 0.4]} />
          <meshStandardMaterial color="#92400e" roughness={0.9} metalness={0.05} />
        </mesh>
        {[0, 1].map((j) => (
          <group key={j} position={[0, 0.2 + j * 0.2, 0]}>
            {/* Cardboard carton — opaque so it doesn't read as a robot */}
            <mesh castShadow>
              <boxGeometry args={[0.35, 0.18, 0.35]} />
              <meshStandardMaterial
                color={j === 0 ? "#a16207" : "#92400e"}
                roughness={0.85}
                metalness={0.05}
              />
            </mesh>
            {/* Blue Pepsi label panel — front */}
            <mesh position={[0, 0, 0.176]}>
              <planeGeometry args={[0.32, 0.12]} />
              <meshStandardMaterial color="#004B93" emissive="#001f4d" emissiveIntensity={0.15} roughness={0.5} />
            </mesh>
            {/* White wave stripe across label */}
            <mesh position={[0, 0, 0.177]}>
              <planeGeometry args={[0.28, 0.025]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.4} />
            </mesh>
          </group>
        ))}
      </group>
    ))}
    {/* Barcode scanner */}
    <mesh position={[-0.7, 1.1, -0.3]} castShadow>
      <boxGeometry args={[0.1, 0.15, 0.08]} />
      <meshStandardMaterial {...PANEL} />
    </mesh>
    <mesh position={[-0.7, 1.1, -0.255]}>
      <planeGeometry args={[0.06, 0.05]} />
      <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
    </mesh>
    {/* Dock bumpers */}
    {[-0.3, 0.3].map((x, i) => (
      <mesh key={i} position={[0.9, 0.15, -1.0 + x]}>
        <boxGeometry args={[0.12, 0.3, 0.15]} />
        <meshStandardMaterial color="#1f2937" roughness={0.9} metalness={0.2} />
      </mesh>
    ))}
    <ControlCabinet position={[-0.9, 0.35, 0.3]} rotation={[0, Math.PI / 4, 0]} />
    <SafetyPost position={[0.8, -0.15, 0.5]} />
  </group>
);

/* ── Main component ── */
const EQUIPMENT: Record<StageId, React.FC> = {
  intake: IntakeEquipment,
  mixing: MixingEquipment,
  forming: FormingEquipment,
  curing: CuringEquipment,
  quality: QualityEquipment,
  packaging: PackagingEquipment,
  dispatch: DispatchEquipment,
};

interface StageEquipment3DProps {
  stageId: StageId;
}

const StageEquipment3D: React.FC<StageEquipment3DProps> = ({ stageId }) => {
  const Equipment = EQUIPMENT[stageId];
  if (!Equipment) return null;
  return <Equipment />;
};

export default StageEquipment3D;
