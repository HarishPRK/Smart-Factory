"use no memo";
import React, {
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { usePLCContext } from "../../context/PLCContext";
import { usePLCStore } from "../../stores/plcStore";
import {
  startSimulation,
  stopSimulation,
  runScenario,
  SCENARIOS,
  getActiveScenario,
} from "../../stores/plcSimulation";
import type { PLCParameter } from "../../types";

/* ══════════════════════════════════════════════════════════
   ROOM ENVIRONMENT — walls, ceiling, floor, cable trays
   ══════════════════════════════════════════════════════════ */

const DS = THREE.DoubleSide;

const RoomShell: React.FC = () => (
  <group>
    {/* Floor — light grey industrial tile */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[12, 8]} />
      <meshStandardMaterial
        color="#505860"
        roughness={0.45}
        metalness={0.15}
        side={DS}
      />
    </mesh>
    {/* Floor grid lines */}
    {Array.from({ length: 21 }).map((_, i) => (
      <mesh
        key={`fx${i}`}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-6 + i * 0.6, 0.002, 0]}
      >
        <planeGeometry args={[0.005, 8]} />
        <meshBasicMaterial color="#606870" transparent opacity={0.5} />
      </mesh>
    ))}
    {Array.from({ length: 14 }).map((_, i) => (
      <mesh
        key={`fz${i}`}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.002, -4 + i * 0.6]}
      >
        <planeGeometry args={[12, 0.005]} />
        <meshBasicMaterial color="#606870" transparent opacity={0.5} />
      </mesh>
    ))}

    {/* Walls */}
    {/* Back wall removed for visibility */}
    {/* Side walls removed for visibility */}
    {/* Front walls removed for visibility */}

    {/* Ceiling */}
    <mesh position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[12, 8]} />
      <meshStandardMaterial color="#3a3e44" roughness={0.9} side={DS} />
    </mesh>

    {/* Baseboard */}
    {[
      [0, 0.05, -3.92, 12, 0.1, 0.01],
      [-5.92, 0.05, 0, 0.01, 0.1, 8],
      [5.92, 0.05, 0, 0.01, 0.1, 8],
    ].map(([x, y, z, w, h, d], i) => (
      <mesh key={`bb${i}`} position={[x as number, y as number, z as number]}>
        <boxGeometry args={[w as number, h as number, d as number]} />
        <meshStandardMaterial color="#383c42" metalness={0.3} roughness={0.6} />
      </mesh>
    ))}

    {/* Cable tray along back wall */}
    <mesh position={[0, 3.5, -3.8]}>
      <boxGeometry args={[10, 0.03, 0.2]} />
      <meshStandardMaterial color="#606870" metalness={0.7} roughness={0.3} />
    </mesh>
    {[-5, -3, -1, 1, 3, 5].map((x) => (
      <mesh key={`tray-${x}`} position={[x, 3.5, -3.8]}>
        <boxGeometry args={[0.03, 0.03, 0.22]} />
        <meshStandardMaterial color="#606870" metalness={0.7} roughness={0.3} />
      </mesh>
    ))}
    {/* Cable bundles */}
    {[
      {
        path: [
          [-5, 3.5, -3.8],
          [-3.5, 3.5, -3.8],
          [-3.5, 2.8, -1.2],
        ],
        color: "#ef4444",
      },
      {
        path: [
          [-3, 3.5, -3.8],
          [0, 3.5, -3.8],
          [0, 2.8, -1.9],
        ],
        color: "#3b82f6",
      },
      {
        path: [
          [1, 3.5, -3.8],
          [3.5, 3.5, -3.8],
          [3.5, 2.8, -1.2],
        ],
        color: "#22c55e",
      },
    ].map((cable, i) => {
      const curve = new THREE.CatmullRomCurve3(
        cable.path.map((p) => new THREE.Vector3(...p)),
        false,
      );
      return (
        <mesh key={i}>
          <tubeGeometry args={[curve, 16, 0.015, 4, false]} />
          <meshStandardMaterial
            color={cable.color}
            metalness={0.5}
            roughness={0.4}
            emissive={cable.color}
            emissiveIntensity={0.1}
          />
        </mesh>
      );
    })}
  </group>
);

/* ── Ceiling Light Fixtures ───────────────────────────── */

const CeilingLights: React.FC = () => (
  <group>
    {/* 3 ceiling lights instead of 6 — reduce GPU load */}
    {[
      [-3, 0],
      [0, 0],
      [3, 0],
    ].map(([x, z], i) => (
      <group key={i}>
        <mesh position={[x, 3.96, z]}>
          <boxGeometry args={[1.6, 0.03, 0.5]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={2}
            side={DS}
          />
        </mesh>
        <pointLight
          position={[x, 3.8, z]}
          intensity={3}
          color="#fff5e6"
          distance={12}
          decay={1.5}
        />
      </group>
    ))}
  </group>
);

/* ── Console Desk ─────────────────────────────────────── */

const ConsoleDesk: React.FC<{
  position: [number, number, number];
  rotation?: number;
  width?: number;
  children?: React.ReactNode;
  riserChildren?: React.ReactNode;
}> = ({ position, rotation = 0, width = 2.5, children, riserChildren }) => (
  <group position={position} rotation={[0, rotation, 0]}>
    {/* Desktop surface */}
    <mesh position={[0, 0.9, 0]}>
      <boxGeometry args={[width, 0.04, 0.8]} />
      <meshStandardMaterial color="#606a74" metalness={0.4} roughness={0.3} />
    </mesh>
    {/* Front panel */}
    <mesh position={[0, 0.45, 0.38]}>
      <boxGeometry args={[width, 0.86, 0.04]} />
      <meshStandardMaterial color="#2a2e34" metalness={0.2} roughness={0.7} />
    </mesh>
    {/* Edge trim */}
    <mesh position={[0, 0.92, 0.38]}>
      <boxGeometry args={[width + 0.02, 0.015, 0.045]} />
      <meshStandardMaterial color="#808890" metalness={0.8} roughness={0.15} />
    </mesh>
    {/* Back riser panel — semi-transparent so it doesn't block the view */}
    <mesh position={[0, 1.85, -0.38]}>
      <boxGeometry args={[width, 1.8, 0.04]} />
      <meshStandardMaterial
        color="#1a1e24"
        metalness={0.3}
        roughness={0.6}
        transparent
        opacity={0.4}
        side={DS}
      />
    </mesh>
    {/* Riser edge trim */}
    <mesh position={[0, 2.76, -0.38]}>
      <boxGeometry args={[width + 0.02, 0.02, 0.105]} />
      <meshStandardMaterial color="#808890" metalness={0.8} roughness={0.15} />
    </mesh>
    {/* Desktop content */}
    <group position={[0, 0, 0]}>{children}</group>
    {/* Riser content */}
    <group position={[0, 0, -0.32]}>{riserChildren}</group>
  </group>
);

/* ══════════════════════════════════════════════════════════
   GAUGE — large chrome-bezeled analog gauge
   ══════════════════════════════════════════════════════════ */

const AnalogGauge: React.FC<{
  position: [number, number, number];
  value: number;
  min: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  decimals?: number;
}> = ({ position, value, min, max, label, unit, color, decimals = 1 }) => {
  const needleRef = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const prevValueRef = useRef(value);
  const pulseTimerRef = useRef(0);
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const arcAngle = normalized * Math.PI * 1.5;
  const dangerColor =
    normalized > 0.85 ? "#ef4444" : normalized > 0.7 ? "#f59e0b" : color;

  useFrame((_, delta) => {
    if (needleRef.current) {
      const targetAngle = Math.PI * 0.75 - arcAngle;
      needleRef.current.rotation.z +=
        (targetAngle - needleRef.current.rotation.z) * 0.08;
    }
    // Pulse flash when value changes significantly
    const changePct = Math.abs(value - prevValueRef.current) / (max - min);
    if (changePct > 0.03) {
      pulseTimerRef.current = 0.5; // flash for 0.5s
      prevValueRef.current = value;
    }
    if (pulseRef.current && pulseTimerRef.current > 0) {
      pulseTimerRef.current -= delta;
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity =
        pulseTimerRef.current * 0.4;
    } else if (pulseRef.current) {
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  });

  return (
    <group position={position}>
      {/* Backplate */}
      <mesh>
        <circleGeometry args={[0.42, 48]} />
        <meshStandardMaterial color="#1a1e24" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Face */}
      <mesh position={[0, 0, 0.005]}>
        <circleGeometry args={[0.38, 48]} />
        <meshStandardMaterial color="#0e1218" roughness={0.8} />
      </mesh>
      {/* Chrome bezel */}
      <mesh>
        <torusGeometry args={[0.42, 0.022, 8, 48]} />
        <meshStandardMaterial
          color="#a0a8b0"
          metalness={0.95}
          roughness={0.05}
        />
      </mesh>
      {/* Scale arc BG */}
      <mesh position={[0, 0, 0.008]} rotation={[0, 0, -Math.PI * 0.75]}>
        <torusGeometry args={[0.32, 0.018, 6, 48, Math.PI * 1.5]} />
        <meshStandardMaterial color="#2a3040" metalness={0.2} roughness={0.6} />
      </mesh>
      {/* Value arc */}
      <mesh position={[0, 0, 0.01]} rotation={[0, 0, -Math.PI * 0.75]}>
        <torusGeometry args={[0.32, 0.022, 6, 48, arcAngle]} />
        <meshStandardMaterial
          color={dangerColor}
          emissive={dangerColor}
          emissiveIntensity={1.8}
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>
      {/* Tick marks */}
      {Array.from({ length: 16 }).map((_, i) => {
        const a = Math.PI * 0.75 - (i / 15) * Math.PI * 1.5;
        const major = i % 3 === 0;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.009]}
            rotation={[0, 0, a - Math.PI / 2]}
          >
            <boxGeometry args={[0.006, major ? 0.06 : 0.03, 0.003]} />
            <meshBasicMaterial color={i > 12 ? "#ef4444" : "#889098"} />
          </mesh>
        );
      })}
      {/* Needle */}
      <group
        ref={needleRef}
        position={[0, 0, 0.015]}
        rotation={[0, 0, Math.PI * 0.75]}
      >
        <mesh position={[0.15, 0, 0]}>
          <boxGeometry args={[0.3, 0.006, 0.004]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={dangerColor}
            emissiveIntensity={0.8}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.02, 10, 10]} />
          <meshStandardMaterial
            color="#c0c8d0"
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      </group>
      {/* Glass */}
      <mesh position={[0, 0, 0.02]}>
        <circleGeometry args={[0.38, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.04}
          metalness={0.95}
          roughness={0.02}
        />
      </mesh>
      {/* Value-change pulse ring */}
      <mesh ref={pulseRef} position={[0, 0, 0.018]}>
        <torusGeometry args={[0.4, 0.025, 6, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
      </mesh>
      {/* Glow */}
      <pointLight
        position={[0, 0, 0.15]}
        color={dangerColor}
        intensity={0.4}
        distance={1.5}
        decay={1.5}
      />
      {/* Labels */}
      <Html
        position={[0, -0.12, 0.03]}
        center
        style={{ pointerEvents: "none" }}
      >
        <span
          className="text-[18px] font-mono font-black tabular-nums"
          style={{ color, textShadow: `0 0 10px ${color}50` }}
        >
          {value.toFixed(decimals)}
        </span>
      </Html>
      <Html
        position={[0, -0.22, 0.03]}
        center
        style={{ pointerEvents: "none" }}
      >
        <span className="text-[8px] text-white/40 font-medium">{unit}</span>
      </Html>
      <Html position={[0, 0.5, 0]} center style={{ pointerEvents: "none" }}>
        <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-white/50">
          {label}
        </span>
      </Html>
    </group>
  );
};

/* ── Oscilloscope ─────────────────────────────────────── */

const Oscilloscope: React.FC<{
  position: [number, number, number];
  data: number[];
  color: string;
  label: string;
  min: number;
  max: number;
}> = ({ position, data, color, label, min, max }) => {
  const scanRef = useRef<THREE.Mesh>(null);
  const W = 0.8,
    H = 0.45;

  const wavePoints = useMemo((): [number, number, number][] => {
    if (data.length < 2)
      return [
        [-W / 2, 0, 0.035],
        [W / 2, 0, 0.035],
      ];
    const range = max - min || 1;
    const count = Math.min(data.length, 80);
    return Array.from({ length: count }, (_, i) => {
      const x = (i / (count - 1)) * W - W / 2;
      const y = Math.max(
        -H / 2,
        Math.min(
          H / 2,
          ((data[data.length - count + i] - min) / range) * H - H / 2,
        ),
      );
      return [x, y, 0.035] as [number, number, number];
    });
  }, [data, min, max]);

  useFrame(({ clock }) => {
    if (scanRef.current) {
      scanRef.current.position.x = ((clock.elapsedTime * 0.3) % 1) * W - W / 2;
    }
  });

  return (
    <group position={position}>
      {/* Casing */}
      <mesh>
        <boxGeometry args={[W + 0.12, H + 0.12, 0.1]} />
        <meshStandardMaterial color="#2a2e34" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0, 0.052]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial
          color="#020a08"
          emissive="#041008"
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Phosphor glow */}
      <mesh position={[0, 0, 0.051]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial color={color} transparent opacity={0.04} />
      </mesh>
      {/* Grid */}
      {Array.from({ length: 5 }).map((_, i) => {
        const y = (i / 4) * H - H / 2;
        return (
          <mesh key={`h${i}`} position={[0, y, 0.053]}>
            <planeGeometry args={[W, 0.002]} />
            <meshBasicMaterial color="#0a5535" transparent opacity={0.5} />
          </mesh>
        );
      })}
      {Array.from({ length: 7 }).map((_, i) => {
        const x = (i / 6) * W - W / 2;
        return (
          <mesh key={`v${i}`} position={[x, 0, 0.053]}>
            <planeGeometry args={[0.002, H]} />
            <meshBasicMaterial color="#0a5535" transparent opacity={0.5} />
          </mesh>
        );
      })}
      {/* Waveform */}
      <Line points={wavePoints} color={color} lineWidth={2} />
      {/* Scan line */}
      <mesh ref={scanRef} position={[0, 0, 0.054]}>
        <planeGeometry args={[0.008, H]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
      </mesh>
      {/* Power LED */}
      <mesh position={[W / 2 - 0.03, -(H / 2) - 0.04, 0.052]}>
        <sphereGeometry args={[0.008, 6, 6]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={2}
        />
      </mesh>
      {/* Bezel trim */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[W + 0.01, H + 0.01, 0.002]} />
        <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
      </mesh>
      <Html
        position={[0, -(H / 2) - 0.1, 0]}
        center
        style={{ pointerEvents: "none" }}
      >
        <span
          className="text-[7px] font-bold uppercase tracking-[0.12em]"
          style={{ color }}
        >
          {label}
        </span>
      </Html>
    </group>
  );
};

/* ── Circuit Breaker ──────────────────────────────────── */

const CircuitBreaker: React.FC<{
  position: [number, number, number];
  index: number;
  active: boolean;
  onToggle: (i: number, state: boolean) => void;
}> = ({ position, index, active, onToggle }) => {
  const handleRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const prevActiveRef = useRef(active);
  const flashTimerRef = useRef(0);

  useFrame((_, delta) => {
    if (handleRef.current)
      handleRef.current.rotation.x +=
        ((active ? 0.4 : -0.4) - handleRef.current.rotation.x) * 0.12;
    // Flash on state change
    if (active !== prevActiveRef.current) {
      flashTimerRef.current = 0.4;
      prevActiveRef.current = active;
    }
    if (flashRef.current) {
      flashTimerRef.current = Math.max(0, flashTimerRef.current - delta);
      flashRef.current.intensity =
        flashTimerRef.current > 0 ? flashTimerRef.current * 3 : 0;
    }
  });

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.18, 0.45, 0.09]} />
        <meshStandardMaterial color="#1e1e22" metalness={0.2} roughness={0.6} />
      </mesh>
      {/* Status window — BIG and bright */}
      <mesh position={[0, 0.1, 0.048]}>
        <planeGeometry args={[0.1, 0.05]} />
        <meshStandardMaterial
          color={active ? "#22c55e" : "#ef4444"}
          emissive={active ? "#22c55e" : "#ef4444"}
          emissiveIntensity={active ? 3 : 1}
        />
      </mesh>
      {/* Handle */}
      <mesh
        ref={handleRef}
        position={[0, -0.06, 0.05]}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(index, !active);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[0.08, 0.15, 0.025]} />
        <meshStandardMaterial
          color={active ? "#4ade80" : "#f87171"}
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>
      {/* Terminals */}
      {[0.24, -0.24].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.02, 8]} />
          <meshStandardMaterial
            color="#c0c0c0"
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      ))}
      {active && (
        <pointLight
          position={[0, 0, 0.1]}
          color="#22c55e"
          intensity={0.3}
          distance={0.6}
          decay={1.5}
        />
      )}
      {/* Toggle flash */}
      <pointLight
        ref={flashRef}
        position={[0, 0, 0.15]}
        color="#ffffff"
        intensity={0}
        distance={1}
        decay={1.5}
      />
      <Html position={[0, -0.3, 0]} center style={{ pointerEvents: "none" }}>
        <span className="text-[7px] font-mono font-bold text-white/60">
          CH{index}
        </span>
      </Html>
    </group>
  );
};

/* ── Industrial Button ────────────────────────────────── */

const IndustrialButton: React.FC<{
  position: [number, number, number];
  pressed: boolean;
  label: string;
  color: string;
  size?: number;
  hasGuard?: boolean;
  onPress: () => void;
}> = ({
  position,
  pressed,
  label,
  color,
  size = 1,
  hasGuard = false,
  onPress,
}) => {
  const btnRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (btnRef.current)
      btnRef.current.position.y +=
        ((pressed ? 0.92 : 0.96) - btnRef.current.position.y) * 0.15;
  });

  return (
    <group position={position}>
      {/* Base housing */}
      <mesh position={[0, 0.93, 0]}>
        <cylinderGeometry args={[0.07 * size, 0.07 * size, 0.04, 16]} />
        <meshStandardMaterial color="#333" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Guard ring (for E-Stop) */}
      {hasGuard && (
        <mesh position={[0, 0.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.09 * size, 0.01, 8, 24]} />
          <meshStandardMaterial
            color="#d4a017"
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
      )}
      {/* Button cap */}
      <group
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          onPress();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry
            args={[0.055 * size, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={pressed ? 2 : 0.4}
            metalness={0.4}
            roughness={0.3}
          />
        </mesh>
      </group>
      {pressed && (
        <pointLight
          position={[0, 1.05, 0]}
          color={color}
          intensity={0.5}
          distance={1}
          decay={1.5}
        />
      )}
      <Html position={[0, 0.82, 0]} center style={{ pointerEvents: "none" }}>
        <span className="text-[7px] font-bold uppercase tracking-wider text-white/50 whitespace-nowrap">
          {label}
        </span>
      </Html>
    </group>
  );
};

/* ── Sensor Panel ─────────────────────────────────────── */

const SensorPanel: React.FC<{
  position: [number, number, number];
  active: boolean;
  label: string;
  color: string;
}> = ({ position, active, label, color }) => {
  const ledRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ledRef.current)
      (
        ledRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = active
        ? 2.5 + Math.sin(clock.elapsedTime * 4) * 1
        : 0.05;
  });
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.3, 0.22, 0.025]} />
        <meshStandardMaterial
          color={active ? "#1a1e28" : "#151820"}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[0.32, 0.24, 0.015]} />
        <meshStandardMaterial color="#222" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh ref={ledRef} position={[0.1, 0.065, 0.015]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial
          color={active ? color : "#333"}
          emissive={active ? color : "#000"}
          emissiveIntensity={0.05}
        />
      </mesh>
      {active && (
        <pointLight
          position={[0, 0, 0.08]}
          color={color}
          intensity={0.25}
          distance={0.5}
          decay={1.5}
        />
      )}
      <Html position={[0, -0.17, 0]} center style={{ pointerEvents: "none" }}>
        <span
          className="text-[7px] font-bold uppercase tracking-wider"
          style={{ color: active ? color : "#555" }}
        >
          {label}
        </span>
      </Html>
    </group>
  );
};

/* ── Alarm Annunciator ────────────────────────────────── */

const AlarmCell: React.FC<{
  position: [number, number, number];
  active: boolean;
  label: string;
}> = ({ position, active, label }) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        active ? (Math.sin(clock.elapsedTime * 6) > 0 ? 3.5 : 0.5) : 0.02;
    }
  });
  return (
    <group position={position}>
      <mesh ref={ref}>
        <boxGeometry args={[0.22, 0.18, 0.02]} />
        <meshStandardMaterial
          color={active ? "#3a1010" : "#151518"}
          emissive={active ? "#ef4444" : "#000"}
          emissiveIntensity={0.02}
        />
      </mesh>
      {active && (
        <pointLight
          position={[0, 0, 0.08]}
          color="#ef4444"
          intensity={0.3}
          distance={0.5}
          decay={1.5}
        />
      )}
      <Html position={[0, 0, 0.015]} center style={{ pointerEvents: "none" }}>
        <span
          className={`text-[7px] font-bold uppercase ${active ? "text-red-400" : "text-white/20"}`}
        >
          {label}
        </span>
      </Html>
    </group>
  );
};

/* ── Motor-Fan Assembly (connected unit) ──────────────── */

/* ══════════════════════════════════════════════════════════
   HARDWARE — smooth, rounded, realistic industrial components
   ══════════════════════════════════════════════════════════ */

const MotorFanUnit: React.FC<{
  position: [number, number, number];
  running: boolean;
  sendCommand: (id: string, cmd: Record<string, unknown>) => Promise<void>;
}> = ({ position, running, sendCommand }) => {
  const fanRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    // Read directly from Zustand store — always synchronous, always latest
    const isRunning = usePLCStore.getState().motorFanOn;
    if (isRunning) {
      // Shaft + blades spin together around X (shaft axis)
      if (fanRef.current) fanRef.current.rotation.x += delta * 12;
    }
  });

  return (
    <group position={position}>
      {/* ── Single base plate under motor only ─── */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.08, 24]} />
        <meshStandardMaterial
          color="#707880"
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>

      {/* ── MOTOR — smooth cylinder with rounded caps ── */}
      <group position={[0, 0.5, 0]}>
        {/* Motor body */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.38, 0.38, 0.85, 24]} />
          <meshStandardMaterial
            color="#8898b0"
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
        {/* Rounded end caps */}
        <mesh position={[-0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <sphereGeometry
            args={[0.38, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial
            color="#7888a0"
            metalness={0.65}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0.45, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <sphereGeometry
            args={[0.38, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial
            color="#7888a0"
            metalness={0.65}
            roughness={0.3}
          />
        </mesh>
        {/* Cooling fins — smooth torus rings */}
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh
            key={i}
            rotation={[0, 0, Math.PI / 2]}
            position={[(i - 4.5) * 0.085, 0, 0]}
          >
            <torusGeometry args={[0.4, 0.008, 6, 24]} />
            <meshStandardMaterial
              color="#b0bcc8"
              metalness={0.85}
              roughness={0.12}
            />
          </mesh>
        ))}
        {/* Terminal box on top — rounded */}
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.14, 12]} />
          <meshStandardMaterial
            color="#8898a8"
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
        {/* Conduit */}
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
          <meshStandardMaterial
            color="#a0a8b0"
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        {/* Status LED */}
        <mesh position={[0, 0.4, 0.11]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial
            color={running ? "#22c55e" : "#ef4444"}
            emissive={running ? "#22c55e" : "#ef4444"}
            emissiveIntensity={running ? 4 : 1}
          />
        </mesh>
        {running && (
          <pointLight
            position={[0, 0.45, 0.15]}
            color="#22c55e"
            intensity={0.6}
            distance={2}
            decay={1.5}
          />
        )}
        {/* Mounting feet */}
        {[
          [-0.3, -0.2],
          [-0.3, 0.2],
          [0.3, -0.2],
          [0.3, 0.2],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, -0.42, z]}>
            <cylinderGeometry args={[0.04, 0.05, 0.08, 8]} />
            <meshStandardMaterial
              color="#606870"
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
        ))}
      </group>

      {/* ── SHAFT + BLADES — one connected spinning unit ── */}
      <group ref={fanRef} position={[1.5, 0.5, 0]}>
        {/* Shaft running from motor into fan center */}
        <mesh position={[-1.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 2.1, 12]} />
          <meshStandardMaterial
            color="#d8e0e8"
            metalness={0.95}
            roughness={0.03}
          />
        </mesh>
        {/* Blades */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[0, Math.cos(a) * 0.2, Math.sin(a) * 0.2]}
              rotation={[a + 0.3, 0, 0]}
            >
              <boxGeometry args={[0.01, 0.35, 0.12]} />
              <meshStandardMaterial
                color="#e8ecf0"
                metalness={0.5}
                roughness={0.25}
                side={DS}
              />
            </mesh>
          );
        })}
      </group>

      {/* Outer rim — stationary */}
      <mesh position={[1.5, 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.45, 0.03, 12, 36]} />
        <meshStandardMaterial
          color="#a8b0b8"
          metalness={0.8}
          roughness={0.18}
        />
      </mesh>

      {/* Label — reads from Zustand so it updates across reconciler boundary */}
      <MotorFanLabel sendCommand={sendCommand} />
    </group>
  );
};

const MotorFanLabel: React.FC<{
  sendCommand: (id: string, cmd: Record<string, unknown>) => Promise<void>;
}> = ({ sendCommand }) => {
  const isRunning = usePLCStore((s) => s.motorFanOn);

  const handleToggle = useCallback(
    (turnOn: boolean) => {
      // Update Zustand immediately — no waiting for React render cycle
      usePLCStore.setState({ motorFanOn: turnOn });
      // Also send MQTT command
      sendCommand("motor_fan", {
        _topic: "plc/control",
        _rawPayload: {
          boardA_8ch_relay_motor: turnOn ? 1 : 0,
        },
      }).catch(() => {});
    },
    [sendCommand],
  );

  return (
    <Html position={[0.75, -0.2, 0.7]} center style={{ pointerEvents: "auto" }}>
      <div className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg bg-black/60 border border-cyan-400/25 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200/90">
            Motor-Fan
          </span>
          <span
            className={`text-[10px] font-mono font-bold ${isRunning ? "text-green-400" : "text-red-400"}`}
          >
            {isRunning ? "● RUNNING" : "● STOPPED"}
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => handleToggle(true)}
            className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
              isRunning
                ? "bg-green-500/30 text-green-300 border border-green-500/40 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
                : "bg-green-500/10 text-green-300/50 border border-green-500/15 hover:bg-green-500/20"
            }`}
          >
            ON
          </button>
          <button
            onClick={() => handleToggle(false)}
            className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
              !isRunning
                ? "bg-red-500/30 text-red-300 border border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                : "bg-red-500/10 text-red-300/50 border border-red-500/15 hover:bg-red-500/20"
            }`}
          >
            OFF
          </button>
        </div>
      </div>
    </Html>
  );
};

/* ── Emergency Beacon — floor stand, rotating beacon ──── */

const EmergencyStrobe: React.FC<{
  position: [number, number, number];
  sendCommand: (id: string, cmd: Record<string, unknown>) => Promise<void>;
}> = ({ position, sendCommand }) => {
  const lensRef = useRef<THREE.Mesh>(null);
  const rotorRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const light2Ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }, delta) => {
    if (!lensRef.current || !lightRef.current) return;
    const isActive = usePLCStore.getState().emergencyLightOn;
    if (isActive) {
      // Rotating beacon effect
      if (rotorRef.current) rotorRef.current.rotation.y += delta * 6;
      const flash = Math.sin(clock.elapsedTime * 8) > 0.5 ? 1 : 0;
      (
        lensRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = 1 + flash * 5;
      lightRef.current.intensity = flash * 6;
      if (light2Ref.current) light2Ref.current.intensity = 2;
    } else {
      (
        lensRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = 0.08;
      lightRef.current.intensity = 0;
      if (rotorRef.current) rotorRef.current.rotation.y = 0;
      if (light2Ref.current) light2Ref.current.intensity = 0;
    }
  });

  return (
    <group position={position}>
      {/* Pole stand — tall, visible */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 16]} />
        <meshStandardMaterial
          color="#606870"
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.3, 10]} />
        <meshStandardMaterial
          color="#808890"
          metalness={0.75}
          roughness={0.2}
        />
      </mesh>

      {/* Beacon housing */}
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.15, 16]} />
        <meshStandardMaterial
          color="#505860"
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>

      {/* RED DOME — large transparent dome */}
      <group ref={rotorRef}>
        <mesh ref={lensRef} position={[0, 1.55, 0]}>
          <sphereGeometry
            args={[0.16, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.6]}
          />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={0.08}
            transparent
            opacity={0.85}
          />
        </mesh>
        {/* Inner reflector */}
        <mesh position={[0.05, 1.5, 0]}>
          <cylinderGeometry args={[0.02, 0.06, 0.12, 8]} />
          <meshStandardMaterial
            color="#ffffff"
            metalness={0.95}
            roughness={0.05}
          />
        </mesh>
        <pointLight
          ref={lightRef}
          position={[0.1, 1.55, 0]}
          color="#ef4444"
          intensity={0}
          distance={10}
          decay={1.5}
        />
      </group>

      {/* Constant dim red glow when active */}
      <pointLight
        ref={light2Ref}
        position={[0, 1.55, 0]}
        color="#ef4444"
        intensity={0}
        distance={4}
        decay={1.5}
      />

      {/* Top cap */}
      <mesh position={[0, 1.68, 0]}>
        <sphereGeometry args={[0.08, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#505860"
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>

      <EmergencyLabel sendCommand={sendCommand} />
    </group>
  );
};

const EmergencyLabel: React.FC<{
  sendCommand: (id: string, cmd: Record<string, unknown>) => Promise<void>;
}> = ({ sendCommand }) => {
  const isActive = usePLCStore((s) => s.emergencyLightOn);

  const handleToggle = useCallback(
    (turnOn: boolean) => {
      usePLCStore.setState({ emergencyLightOn: turnOn });
      sendCommand("emergency_light", {
        _topic: "plc/control",
        _rawPayload: {
          boardA_8ch_relay_alarm: turnOn ? 1 : 0,
        },
      }).catch(() => {});
    },
    [sendCommand],
  );

  return (
    <Html position={[0, -0.15, 0.3]} center style={{ pointerEvents: "auto" }}>
      <div className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg bg-black/60 border border-red-500/25 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-200/90">
            Emergency
          </span>
          <span
            className={`text-[10px] font-mono font-bold ${isActive ? "text-red-400" : "text-gray-400"}`}
          >
            {isActive ? "⚠ ACTIVE" : "● OFF"}
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => handleToggle(true)}
            className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
              isActive
                ? "bg-red-500/30 text-red-300 border border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                : "bg-red-500/10 text-red-300/50 border border-red-500/15 hover:bg-red-500/20"
            }`}
          >
            ON
          </button>
          <button
            onClick={() => handleToggle(false)}
            className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
              !isActive
                ? "bg-green-500/30 text-green-300 border border-green-500/40 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
                : "bg-green-500/10 text-green-300/50 border border-green-500/15 hover:bg-green-500/20"
            }`}
          >
            OFF
          </button>
        </div>
      </div>
    </Html>
  );
};

/* ── Photo-E Sensor — cylindrical housings + laser beam ── */

const PhotoESensor3D: React.FC<{
  position: [number, number, number];
  active: boolean;
}> = ({ position, active }) => {
  const beamRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const isActive = usePLCStore.getState().photoESensor;
    if (beamRef.current) {
      (beamRef.current.material as THREE.MeshBasicMaterial).opacity = isActive
        ? 0.4 + Math.sin(clock.elapsedTime * 6) * 0.15
        : 0;
      beamRef.current.visible = isActive;
    }
    if (glowRef.current)
      glowRef.current.intensity = isActive
        ? 0.8 + Math.sin(clock.elapsedTime * 4) * 0.3
        : 0;
  });
  return (
    <group position={position}>
      {/* Mounting bracket — L-shaped poles */}
      {[-0.65, 0.65].map((z) => (
        <group key={z}>
          <mesh position={[0, -0.2, z]}>
            <cylinderGeometry args={[0.035, 0.045, 0.45, 10]} />
            <meshStandardMaterial
              color="#808890"
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
          {/* Bracket arm */}
          <mesh position={[0, 0.02, z + (z > 0 ? -0.08 : 0.08)]}>
            <cylinderGeometry args={[0.02, 0.02, 0.12, 6]} />
            <meshStandardMaterial
              color="#808890"
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
        </group>
      ))}

      {/* Emitter — smooth cylinder */}
      <group position={[0, 0, -0.55]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
          <meshStandardMaterial
            color="#2a8a4a"
            metalness={0.45}
            roughness={0.35}
          />
        </mesh>
        {/* Lens — glowing green dome */}
        <mesh position={[0, 0, 0.08]}>
          <sphereGeometry
            args={[0.06, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial
            color={active ? "#22c55e" : "#556"}
            emissive={active ? "#22c55e" : "#000"}
            emissiveIntensity={active ? 5 : 0}
            transparent
            opacity={0.9}
          />
        </mesh>
        {active && (
          <pointLight
            position={[0, 0, 0.12]}
            color="#22c55e"
            intensity={0.5}
            distance={1.2}
            decay={1.5}
          />
        )}
      </group>

      {/* Receiver — smooth cylinder */}
      <group position={[0, 0, 0.55]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
          <meshStandardMaterial
            color="#2a8a4a"
            metalness={0.45}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, 0, -0.08]} rotation={[0, Math.PI, 0]}>
          <sphereGeometry
            args={[0.06, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial
            color={active ? "#22c55e" : "#556"}
            emissive={active ? "#22c55e" : "#000"}
            emissiveIntensity={active ? 5 : 0}
            transparent
            opacity={0.9}
          />
        </mesh>
      </group>

      {/* LASER BEAM — cylinder, not box */}
      <mesh ref={beamRef}>
        <cylinderGeometry args={[0.008, 0.008, 1.0, 6]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0} />
      </mesh>
      <pointLight
        ref={glowRef}
        color="#22c55e"
        intensity={0}
        distance={2.5}
        decay={1.5}
      />

      <Html position={[0, -0.55, 0]} center style={{ pointerEvents: "none" }}>
        <div className="px-2 py-0.5 rounded-lg bg-black/50 border border-green-500/25 backdrop-blur-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-green-300">
            Photo-Electric Sensor
          </span>
        </div>
      </Html>
    </group>
  );
};

/* ── Metal Detector Gate — smooth arch ────────────────── */

const MetalDetectorGate: React.FC<{
  position: [number, number, number];
  active: boolean;
}> = ({ position, active }) => {
  const archRef = useRef<THREE.Mesh>(null);
  const ledsRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const isActive = usePLCStore.getState().metalSensor;
    if (archRef.current) {
      (
        archRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = isActive
        ? 1.2 + Math.sin(clock.elapsedTime * 5) * 0.8
        : 0.08;
    }
    if (ledsRef.current) {
      ledsRef.current.children.forEach((child, i) => {
        const mat = (child as THREE.Mesh)
          .material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = isActive
          ? 2 + Math.sin(clock.elapsedTime * 6 + i) * 1.5
          : 0;
      });
    }
  });
  return (
    <group position={position}>
      {/* Cylindrical posts */}
      <mesh position={[0, 0.45, -0.45]}>
        <cylinderGeometry args={[0.06, 0.07, 0.9, 12]} />
        <meshStandardMaterial
          color="#c07830"
          metalness={0.5}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 0.45, 0.45]}>
        <cylinderGeometry args={[0.06, 0.07, 0.9, 12]} />
        <meshStandardMaterial
          color="#c07830"
          metalness={0.5}
          roughness={0.35}
        />
      </mesh>
      {/* Smooth arch — torus half-ring */}
      <mesh ref={archRef} position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.05, 12, 24, Math.PI]} />
        <meshStandardMaterial
          color="#f5a020"
          emissive="#f59e0b"
          emissiveIntensity={0.08}
          metalness={0.55}
          roughness={0.3}
        />
      </mesh>
      {/* Detection coil LEDs along the arch */}
      <group ref={ledsRef}>
        {[-0.35, -0.15, 0, 0.15, 0.35].map((z) => {
          const y = 0.9 + Math.sqrt(Math.max(0, 0.45 * 0.45 - z * z));
          return (
            <mesh key={z} position={[0.06, y, z]}>
              <sphereGeometry args={[0.02, 10, 10]} />
              <meshStandardMaterial
                color={active ? "#f59e0b" : "#666"}
                emissive={active ? "#f59e0b" : "#000"}
                emissiveIntensity={0}
              />
            </mesh>
          );
        })}
      </group>
      {active && (
        <pointLight
          position={[0, 1.2, 0]}
          color="#f59e0b"
          intensity={1}
          distance={3}
          decay={1.5}
        />
      )}
      {/* Base plate — rounded */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.12, 0.8, 4, 12]} />
        <meshStandardMaterial color="#707880" metalness={0.5} roughness={0.4} />
      </mesh>
      <Html
        position={[0, -0.12, 0.55]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div className="px-2 py-0.5 rounded-lg bg-black/50 border border-orange-500/25 backdrop-blur-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-orange-300">
            Metal Detector
          </span>
        </div>
      </Html>
    </group>
  );
};

/* ── Operator Chair ───────────────────────────────────── */

const OperatorChair: React.FC<{ position: [number, number, number] }> = ({
  position,
}) => (
  <group position={position}>
    <mesh position={[0, 0.48, 0]}>
      <cylinderGeometry args={[0.25, 0.25, 0.06, 12]} />
      <meshStandardMaterial color="#333840" roughness={0.7} />
    </mesh>
    <mesh position={[0, 0.75, -0.14]} rotation={[0.12, 0, 0]}>
      <boxGeometry args={[0.42, 0.5, 0.04]} />
      <meshStandardMaterial color="#333840" roughness={0.7} />
    </mesh>
    <mesh position={[0, 0.24, 0]}>
      <cylinderGeometry args={[0.04, 0.04, 0.42, 8]} />
      <meshStandardMaterial color="#606870" metalness={0.7} roughness={0.3} />
    </mesh>
    {[0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2;
      return (
        <mesh
          key={i}
          position={[Math.cos(a) * 0.22, 0.03, Math.sin(a) * 0.22]}
          rotation={[0, a, 0]}
        >
          <boxGeometry args={[0.24, 0.025, 0.035]} />
          <meshStandardMaterial
            color="#606870"
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
      );
    })}
  </group>
);

/* ── Simulation Panel (floating in 3D scene) ─────────── */

const SimulationPanel: React.FC = () => {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Poll active scenario
  useFrame(() => {
    const current = getActiveScenario();
    if (current !== activeId) setActiveId(current);
  });

  return (
    <Html position={[0, 3.8, 2]} center style={{ pointerEvents: "auto" }}>
      <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl bg-black/70 border border-cyan-400/20 backdrop-blur-md min-w-[320px]">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
          Simulation Scenarios
        </div>
        <div className="flex gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => runScenario(s.id)}
              className={`flex flex-col items-center px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                activeId === s.id
                  ? "border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.15)]"
                  : "border-white/10 hover:border-white/20"
              }`}
              style={{
                backgroundColor:
                  activeId === s.id ? `${s.color}30` : `${s.color}10`,
                color: s.color,
              }}
            >
              <span>{s.label}</span>
              <span className="text-[7px] text-white/30 mt-0.5 normal-case">
                {s.duration}
              </span>
            </button>
          ))}
        </div>
        {activeId && (
          <div className="text-[8px] text-cyan-200/50 italic">
            {SCENARIOS.find((s) => s.id === activeId)?.description}
          </div>
        )}
      </div>
    </Html>
  );
};

/* ══════════════════════════════════════════════════════════
   MAIN SCENE
   ══════════════════════════════════════════════════════════ */

interface SceneProps {
  params: PLCParameter[];
  motorFanOn: boolean;
  emergencyLightOn: boolean;
  photoESensor: boolean;
  metalSensor: boolean;
  pushButton: boolean;
  relays: boolean[];
  alerts: boolean[];
  sendCommand: (
    deviceId: string,
    command: Record<string, unknown>,
  ) => Promise<void>;
  hV: number[];
  hC: number[];
  hP: number[];
  hT: number[];
}

const Scene: React.FC<SceneProps> = ({
  params,
  motorFanOn,
  emergencyLightOn,
  photoESensor,
  metalSensor,
  pushButton,
  relays,
  alerts,
  sendCommand,
  hV,
  hC,
  hP,
  hT,
}) => {
  const voltage = params.find((p) => p.id === "voltage")?.value ?? 5;
  const current = params.find((p) => p.id === "current")?.value ?? 6;
  const pH = params.find((p) => p.id === "ph")?.value ?? 7;
  const temperature = params.find((p) => p.id === "temperature")?.value ?? 25;

  const handleRelay = useCallback(
    (i: number, s: boolean) => {
      const r = relays.map((v, j) => (j === i ? (s ? 1 : 0) : v ? 1 : 0));
      sendCommand("relay", {
        _topic: "plc/control",
        _rawPayload: { "8ch_relay_1": r },
      }).catch(() => {});
    },
    [relays, sendCommand],
  );

  const toggleMotor = useCallback(() => {
    sendCommand("motor_fan", {
      _topic: "plc/control",
      _rawPayload: {
        boardA_8ch_relay_motor: motorFanOn ? 0 : 1,
      },
    }).catch(() => {});
  }, [motorFanOn, sendCommand]);

  const togglePush = useCallback(() => {
    sendCommand("push_button", { action: "toggle" }).catch(() => {});
  }, [sendCommand]);

  const toggleEStop = useCallback(() => {
    sendCommand("emergency_light", {
      _topic: "plc/control",
      _rawPayload: {
        boardA_8ch_relay_alarm: emergencyLightOn ? 0 : 1,
      },
    }).catch(() => {});
  }, [emergencyLightOn, sendCommand]);

  return (
    <>
      {/* ── LIGHTING — bright but lightweight (no spotlights) ── */}
      <ambientLight intensity={1.2} color="#e8ecf0" />
      <hemisphereLight args={["#fff5e0", "#b0c0d0", 0.6]} />
      <directionalLight position={[3, 8, 5]} intensity={2.0} color="#ffffff" />

      <fog attach="fog" args={["#1a1e24", 25, 50]} />

      <OrbitControls
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3}
        maxDistance={12}
        enableDamping
        dampingFactor={0.05}
        target={[0, 1.5, -0.5]}
      />

      {/* Room */}
      <RoomShell />
      <CeilingLights />

      {/* ── LEFT STATION: MONITORING ─────────────────── */}
      <ConsoleDesk
        position={[-3.5, 0, -0.8]}
        rotation={0.35}
        width={2.5}
        riserChildren={
          <>
            <AnalogGauge
              position={[-0.55, 2.2, 0.06]}
              value={voltage}
              min={0}
              max={12}
              label="Voltage"
              unit="V"
              color="#f59e0b"
            />
            <AnalogGauge
              position={[0.55, 2.2, 0.06]}
              value={current}
              min={0}
              max={10}
              label="Current"
              unit="A"
              color="#06b6d4"
            />
            <AnalogGauge
              position={[-0.55, 1.4, 0.06]}
              value={pH}
              min={0}
              max={14}
              label="pH Level"
              unit="pH"
              color="#a855f7"
            />
            <AnalogGauge
              position={[0.55, 1.4, 0.06]}
              value={temperature}
              min={0}
              max={100}
              label="Temp"
              unit="°C"
              color="#ef4444"
              decimals={0}
            />
          </>
        }
      >
        <Oscilloscope
          position={[-0.5, 0.95, -0.15]}
          data={hV}
          color="#f59e0b"
          label="Voltage"
          min={0}
          max={12}
        />
        <Oscilloscope
          position={[0.5, 0.95, -0.15]}
          data={hC}
          color="#06b6d4"
          label="Current"
          min={0}
          max={10}
        />
      </ConsoleDesk>

      {/* ── CENTER STATION: CONTROL ──────────────────── */}
      <ConsoleDesk
        position={[0, 0, -1.5]}
        width={2.8}
        riserChildren={
          <>
            {/* DIN Rails + Breakers */}
            <mesh position={[0, 2.4, 0.02]}>
              <boxGeometry args={[2.2, 0.035, 0.04]} />
              <meshStandardMaterial
                color="#c0c0c0"
                metalness={0.9}
                roughness={0.1}
              />
            </mesh>
            <mesh position={[0, 1.7, 0.02]}>
              <boxGeometry args={[2.2, 0.035, 0.04]} />
              <meshStandardMaterial
                color="#c0c0c0"
                metalness={0.9}
                roughness={0.1}
              />
            </mesh>
            {relays.slice(0, 4).map((a, i) => (
              <CircuitBreaker
                key={i}
                position={[-0.45 + i * 0.3, 2.4, 0.04]}
                index={i}
                active={a}
                onToggle={handleRelay}
              />
            ))}
            {relays.slice(4, 8).map((a, i) => (
              <CircuitBreaker
                key={i + 4}
                position={[-0.45 + i * 0.3, 1.7, 0.04]}
                index={i + 4}
                active={a}
                onToggle={handleRelay}
              />
            ))}

            {/* Sensor panels */}
            <SensorPanel
              position={[-1.0, 2.5, 0.04]}
              active={photoESensor}
              label="Photo-E"
              color="#22c55e"
            />
            <SensorPanel
              position={[-1.0, 2.1, 0.04]}
              active={metalSensor}
              label="Metal"
              color="#f97316"
            />
            <SensorPanel
              position={[1.0, 2.5, 0.04]}
              active={motorFanOn}
              label="Motor"
              color="#3b82f6"
            />
            <SensorPanel
              position={[1.0, 2.1, 0.04]}
              active={emergencyLightOn}
              label="E-Light"
              color="#ef4444"
            />

            {/* Alarm annunciator */}
            {alerts.map((a, i) => (
              <AlarmCell
                key={i}
                position={[-0.35 + i * 0.24, 1.15, 0.04]}
                active={a}
                label={`ALM ${i}`}
              />
            ))}
          </>
        }
      >
        {/* Buttons on desk */}
        <IndustrialButton
          position={[-0.5, 0, 0.1]}
          pressed={motorFanOn}
          label="Motor"
          color="#22c55e"
          size={1.4}
          onPress={toggleMotor}
        />
        <IndustrialButton
          position={[0, 0, 0.1]}
          pressed={pushButton}
          label="Push"
          color="#3b82f6"
          size={1.1}
          onPress={togglePush}
        />
        <IndustrialButton
          position={[0.5, 0, 0.1]}
          pressed={emergencyLightOn}
          label="E-Stop"
          color="#ef4444"
          size={1.7}
          hasGuard
          onPress={toggleEStop}
        />
      </ConsoleDesk>

      {/* ── RIGHT STATION: STATUS ────────────────────── */}
      <ConsoleDesk
        position={[3.5, 0, -0.8]}
        rotation={-0.35}
        width={2.5}
        riserChildren={
          <>
            {/* Main monitor */}
            <group position={[0, 2.0, 0.06]}>
              <mesh>
                <boxGeometry args={[2.2, 1.3, 0.06]} />
                <meshStandardMaterial
                  color="#111418"
                  metalness={0.5}
                  roughness={0.3}
                />
              </mesh>
              <mesh position={[0, 0, 0.032]}>
                <planeGeometry args={[2.0, 1.1]} />
                <meshStandardMaterial
                  color="#0a0e14"
                  emissive="#060a10"
                  emissiveIntensity={0.5}
                />
              </mesh>
              <pointLight
                position={[0, 0, 0.2]}
                color="#1a3050"
                intensity={0.4}
                distance={2}
                decay={1.5}
              />
              <Html
                position={[0, 0, 0.04]}
                center
                style={{ pointerEvents: "none" }}
              >
                <div className="w-[220px] bg-[#080c14]/90 rounded p-2.5 border border-cyan-500/15 font-mono text-[8px]">
                  <div className="text-cyan-400 font-bold text-[10px] text-center mb-2 tracking-wider">
                    SYSTEM OVERVIEW
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      {
                        l: "Voltage",
                        v: `${voltage.toFixed(1)}V`,
                        c: "text-yellow-300",
                        s: voltage > 10 ? "bg-red-500" : "bg-green-500",
                      },
                      {
                        l: "Current",
                        v: `${current.toFixed(1)}A`,
                        c: "text-cyan-300",
                        s: current > 8 ? "bg-red-500" : "bg-green-500",
                      },
                      {
                        l: "pH",
                        v: pH.toFixed(1),
                        c: "text-purple-300",
                        s: pH > 8 || pH < 6 ? "bg-yellow-500" : "bg-green-500",
                      },
                      {
                        l: "Temp",
                        v: `${temperature.toFixed(0)}°C`,
                        c: "text-red-300",
                        s: temperature > 80 ? "bg-red-500" : "bg-green-500",
                      },
                      {
                        l: "Motor",
                        v: motorFanOn ? "RUN" : "STOP",
                        c: motorFanOn ? "text-green-400" : "text-red-400",
                        s: motorFanOn ? "bg-green-500" : "bg-red-500",
                      },
                      {
                        l: "Relays",
                        v: `${relays.filter(Boolean).length}/8`,
                        c: "text-blue-300",
                        s: "bg-blue-500",
                      },
                    ].map((item) => (
                      <div
                        key={item.l}
                        className="bg-white/[0.03] rounded px-1.5 py-1"
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${item.s}`}
                          />
                          <span className="text-gray-500 text-[7px]">
                            {item.l}
                          </span>
                        </div>
                        <div
                          className={`text-[12px] font-bold mt-0.5 ${item.c}`}
                        >
                          {item.v}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-white/5 flex justify-between text-[7px] text-gray-500">
                    <span>PLC Connected</span>
                    <span className="text-green-400/70">ONLINE</span>
                  </div>
                </div>
              </Html>
            </group>
          </>
        }
      >
        <Oscilloscope
          position={[-0.5, 0.95, -0.15]}
          data={hP}
          color="#a855f7"
          label="pH"
          min={0}
          max={14}
        />
        <Oscilloscope
          position={[0.5, 0.95, -0.15]}
          data={hT}
          color="#ef4444"
          label="Temp"
          min={0}
          max={100}
        />
      </ConsoleDesk>

      {/* ── HARDWARE on floor — large, visible ────────── */}
      <MotorFanUnit
        position={[-4, 0, 2]}
        running={motorFanOn}
        sendCommand={sendCommand}
      />
      <PhotoESensor3D position={[-1.5, 0.5, 2.5]} active={photoESensor} />
      <MetalDetectorGate position={[1.5, 0, 2.5]} active={metalSensor} />
      <EmergencyStrobe position={[4.5, 0, 2]} sendCommand={sendCommand} />
      <OperatorChair position={[0, 0, 1.2]} />

      {/* ── Simulation Control Panel ─────────────────── */}
      <SimulationPanel />

      {/* Station labels */}
      {[
        { x: -3.5, z: -0.8, label: "MONITORING", color: "#f59e0b" },
        { x: 0, z: -1.5, label: "CONTROL", color: "#3b82f6" },
        { x: 3.5, z: -0.8, label: "STATUS", color: "#22c55e" },
      ].map((s) => (
        <Html
          key={s.label}
          position={[s.x, 3.2, s.z]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div
            className="px-3 py-1 rounded-md border"
            style={{
              borderColor: `${s.color}30`,
              backgroundColor: `${s.color}08`,
            }}
          >
            <span
              className="text-[9px] font-bold uppercase tracking-[0.2em]"
              style={{ color: s.color }}
            >
              {s.label}
            </span>
          </div>
        </Html>
      ))}
    </>
  );
};

/* ══════════════════════════════════════════════════════════
   EXPORT
   ══════════════════════════════════════════════════════════ */

const PLCControlRoom: React.FC = () => {
  const { sendCommand } = usePLCContext(false);

  // Start simulation on mount, stop on unmount
  useEffect(() => {
    startSimulation();
    return () => stopSimulation();
  }, []);

  // Read individual values from Zustand — avoids full re-render on every field change
  const sParams = usePLCStore((s) => s.params);
  const sMotor = usePLCStore((s) => s.motorFanOn);
  const sEmergency = usePLCStore((s) => s.emergencyLightOn);
  const sPhotoE = usePLCStore((s) => s.photoESensor);
  const sMetal = usePLCStore((s) => s.metalSensor);
  const sPush = usePLCStore((s) => s.pushButton);
  const sRelays = usePLCStore((s) => s.relays);
  const sAlerts = usePLCStore((s) => s.alerts);

  // History from Zustand (populated by simulation)
  const hV = usePLCStore((s) => s.historyVoltage);
  const hC = usePLCStore((s) => s.historyCurrent);
  const hP = usePLCStore((s) => s.historyPH);
  const hT = usePLCStore((s) => s.historyTemp);

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false }}
      camera={{ position: [0, 2.5, 5.5], fov: 45, near: 0.1, far: 50 }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color("#1a1e24");
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Scene
        params={sParams}
        motorFanOn={sMotor}
        emergencyLightOn={sEmergency}
        photoESensor={sPhotoE}
        metalSensor={sMetal}
        pushButton={sPush}
        relays={sRelays}
        alerts={sAlerts}
        sendCommand={sendCommand}
        hV={hV}
        hC={hC}
        hP={hP}
        hT={hT}
      />
    </Canvas>
  );
};

export default PLCControlRoom;
