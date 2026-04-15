"use no memo";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { STATUS_COLORS } from "./factoryLayout";
import type { Machine3DState } from "./useFactoryData";
import type { MachineType } from "../../types";

interface MachineModelProps {
  machine: Machine3DState;
  onClick: (machine: Machine3DState) => void;
}

/* ── Machine accent colors ─────────────────────────── */

// Industrial palette: mostly steel gray with subtle brand accents
const MACHINE_COLORS: Record<
  string,
  { primary: string; accent: string; emissive: string; body: string }
> = {
  "Injection Molding": {
    primary: "#b91c1c",
    accent: "#fca5a5",
    emissive: "#450a0a",
    body: "#5c5c5c",
  },
  "Hydraulic Press": {
    primary: "#1d4ed8",
    accent: "#93c5fd",
    emissive: "#172554",
    body: "#555555",
  },
  "Industrial Boiler": {
    primary: "#c2410c",
    accent: "#fdba74",
    emissive: "#431407",
    body: "#606060",
  },
  "CNC Lathe": {
    primary: "#0e7490",
    accent: "#67e8f9",
    emissive: "#083344",
    body: "#585858",
  },
  "Cooling Tower": {
    primary: "#6d28d9",
    accent: "#c4b5fd",
    emissive: "#2e1065",
    body: "#565656",
  },
  "Conveyor Belt": {
    primary: "#047857",
    accent: "#6ee7b7",
    emissive: "#022c22",
    body: "#505050",
  },
};

const getMachineColor = (type: string) =>
  MACHINE_COLORS[type] ?? MACHINE_COLORS["Conveyor Belt"];

/* ── Warning Beacon ────────────────────────────────── */

const WarningBeacon: React.FC<{
  status: "critical" | "warning" | "normal";
  height: number;
}> = ({ status, height }) => {
  const beaconRef = useRef<THREE.Mesh>(null);
  const beaconLightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!beaconRef.current || !beaconLightRef.current) return;
    if (status === "normal") {
      (
        beaconRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = 0.1;
      beaconLightRef.current.intensity = 0;
      return;
    }
    const speed = status === "critical" ? 6 : 2;
    const pulse = Math.max(0, Math.sin(clock.elapsedTime * speed));
    (
      beaconRef.current.material as THREE.MeshStandardMaterial
    ).emissiveIntensity = 0.3 + pulse * 2;
    beaconLightRef.current.intensity = pulse * 1.5;
  });

  const color =
    status === "critical"
      ? "#ef4444"
      : status === "warning"
        ? "#f59e0b"
        : "#10b981";

  return (
    <group position={[0, height, 0]}>
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
        <meshStandardMaterial color="#4a5568" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh ref={beaconRef}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.9}
        />
      </mesh>
      <pointLight
        ref={beaconLightRef}
        color={color}
        intensity={0}
        distance={4}
        decay={2}
      />
    </group>
  );
};

/* ── Floating Data Label ───────────────────────────── */

const DataLabel: React.FC<{ machine: Machine3DState }> = ({ machine }) => {
  const colors = getMachineColor(machine.type);
  const statusColor =
    machine.status === "critical"
      ? "#ef4444"
      : machine.status === "warning"
        ? "#f59e0b"
        : "#10b981";

  return (
    <Html
      position={[0, 3.2, 0]}
      center
      distanceFactor={14}
      zIndexRange={[5, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        className="flex flex-col items-center gap-1"
        style={{ opacity: 0.9 }}
      >
        <div
          className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap"
          style={{
            backgroundColor: `${colors.primary}cc`,
            border: `1px solid ${colors.accent}40`,
          }}
        >
          {machine.name}
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-white/90 whitespace-nowrap"
            style={{
              backgroundColor: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {machine.powerKW} kW
          </div>
          <div
            className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-white/90 whitespace-nowrap"
            style={{
              backgroundColor: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {machine.temperature}
          </div>
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
            }}
          />
        </div>
      </div>
    </Html>
  );
};

/* ── Control Panel ─────────────────────────────────── */

const ControlPanel: React.FC<{
  colors: ReturnType<typeof getMachineColor>;
  running: boolean;
}> = ({ colors, running }) => {
  const screenRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!screenRef.current) return;
    const mat = screenRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = running
      ? 0.4 + Math.sin(clock.elapsedTime * 3) * 0.1
      : 0.05;
  });

  return (
    <group position={[0, 0.8, 0.8]}>
      <mesh>
        <boxGeometry args={[0.5, 0.6, 0.08]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh ref={screenRef} position={[0, 0.08, 0.045]}>
        <planeGeometry args={[0.38, 0.25]} />
        <meshStandardMaterial
          color={running ? colors.accent : "#1a1a2e"}
          emissive={running ? colors.primary : "#111"}
          emissiveIntensity={0.2}
        />
      </mesh>
      {[-0.12, 0, 0.12].map((x, i) => (
        <mesh key={i} position={[x, -0.18, 0.045]}>
          <circleGeometry args={[0.03, 8]} />
          <meshStandardMaterial
            color={i === 0 ? "#22c55e" : i === 1 ? "#eab308" : "#ef4444"}
            emissive={i === 0 ? "#22c55e" : i === 1 ? "#eab308" : "#ef4444"}
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
    </group>
  );
};

/* ── Machine-specific geometry ─────────────────────── */

const InjectionMolding: React.FC<{ running: boolean }> = ({ running }) => {
  const barrelRef = useRef<THREE.Mesh>(null);
  const screwRef = useRef<THREE.Mesh>(null);
  const colors = getMachineColor("Injection Molding");

  useFrame((_, delta) => {
    if (running) {
      if (barrelRef.current) barrelRef.current.rotation.x += delta * 1.5;
      if (screwRef.current) screwRef.current.rotation.x += delta * 4;
    }
  });

  return (
    <group>
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[2.2, 0.3, 1.6]} />
        <meshStandardMaterial
          color={colors.body}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0.31, 0]}>
        <boxGeometry args={[2.22, 0.02, 1.62]} />
        <meshStandardMaterial
          color={colors.primary}
          emissive={colors.primary}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[0, 0.7, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 1.8, 16]} />
        <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
      </mesh>
      {[-0.6, -0.2, 0.2, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.3, 0.02, 8, 16]} />
          <meshStandardMaterial
            color={colors.accent}
            emissive={colors.primary}
            emissiveIntensity={running ? 0.6 : 0.1}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      ))}
      <mesh
        ref={screwRef}
        position={[0, 0.7, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.1, 0.1, 1.6, 8]} />
        <meshStandardMaterial
          color={colors.accent}
          emissive={colors.primary}
          emissiveIntensity={running ? 1 : 0.1}
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh ref={barrelRef} position={[0, 1.25, 0]} castShadow>
        <coneGeometry args={[0.4, 0.6, 8]} />
        <meshStandardMaterial
          color={colors.primary}
          metalness={0.5}
          roughness={0.4}
          emissive={colors.emissive}
          emissiveIntensity={0.3}
        />
      </mesh>
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[x, 0.65, 0]} castShadow>
          <boxGeometry args={[0.12, 0.7, 0.9]} />
          <meshStandardMaterial
            color={colors.primary}
            metalness={0.6}
            roughness={0.3}
            emissive={colors.emissive}
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}
      <mesh position={[-1.15, 0.65, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.08, 0.3, 8]} />
        <meshStandardMaterial
          color="#d4d4d8"
          metalness={0.9}
          roughness={0.1}
          emissive={running ? "#ff6b35" : "#333"}
          emissiveIntensity={running ? 1.5 : 0}
        />
      </mesh>
      {[
        [-0.7, 0.35, -0.7],
        [0.7, 0.35, -0.7],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <cylinderGeometry args={[0.03, 0.03, 0.6, 6]} />
          <meshStandardMaterial
            color="#f59e0b"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      ))}
      <ControlPanel colors={colors} running={running} />
    </group>
  );
};

const HydraulicPress: React.FC<{ running: boolean }> = ({ running }) => {
  const ramRef = useRef<THREE.Mesh>(null);
  const pistonGlowRef = useRef<THREE.Mesh>(null);
  const colors = getMachineColor("Hydraulic Press");

  useFrame(({ clock }) => {
    if (running) {
      const t = Math.sin(clock.elapsedTime * 2);
      if (ramRef.current) ramRef.current.position.y = 1.0 + t * 0.3;
      if (pistonGlowRef.current) {
        (
          pistonGlowRef.current.material as THREE.MeshStandardMaterial
        ).emissiveIntensity = 0.5 + Math.abs(t) * 1.5;
      }
    }
  });

  return (
    <group>
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[1.8, 0.3, 1.8]} />
        <meshStandardMaterial
          color={colors.body}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0.31, 0]}>
        <boxGeometry args={[1.82, 0.02, 1.82]} />
        <meshStandardMaterial
          color={colors.primary}
          emissive={colors.primary}
          emissiveIntensity={0.3}
        />
      </mesh>
      {[
        [-0.65, -0.65],
        [-0.65, 0.65],
        [0.65, -0.65],
        [0.65, 0.65],
      ].map(([x, z], i) => (
        <group key={i}>
          <mesh position={[x, 1.1, z]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 1.9, 8]} />
            <meshStandardMaterial
              color="#9ca3af"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
          <mesh position={[x, 0.5, z]}>
            <cylinderGeometry args={[0.09, 0.09, 0.1, 8]} />
            <meshStandardMaterial
              color={colors.primary}
              emissive={colors.primary}
              emissiveIntensity={0.5}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.05, 0]} castShadow>
        <boxGeometry args={[1.8, 0.18, 1.8]} />
        <meshStandardMaterial
          color={colors.body}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>
      <mesh ref={ramRef} position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.5, 16]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh
        ref={pistonGlowRef}
        position={[0, 0.8, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.35, 0.03, 8, 24]} />
        <meshStandardMaterial
          color={colors.accent}
          emissive={colors.primary}
          emissiveIntensity={0.5}
          transparent
          opacity={0.7}
        />
      </mesh>
      <mesh position={[0.9, 1.2, 0.9]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial
          color="#1a1a2e"
          emissive={running ? "#22c55e" : "#666"}
          emissiveIntensity={0.5}
        />
      </mesh>
      <ControlPanel colors={colors} running={running} />
    </group>
  );
};

const IndustrialBoiler: React.FC<{ running: boolean }> = ({ running }) => {
  const steamRef = useRef<THREE.Group>(null);
  const colors = getMachineColor("Industrial Boiler");

  useFrame(({ clock }) => {
    if (!steamRef.current) return;
    steamRef.current.children.forEach((child, i) => {
      if (running) {
        child.position.y = (clock.elapsedTime * 0.5 + i * 0.3) % 1.5;
        (child as THREE.Mesh).scale.setScalar(1 - child.position.y / 1.5);
        child.visible = true;
      } else {
        child.visible = false;
      }
    });
  });

  return (
    <group>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.85, 0.9, 0.2, 16]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.7, 1.8, 16]} />
        <meshStandardMaterial
          color={colors.body}
          metalness={0.6}
          roughness={0.35}
          emissive={colors.emissive}
          emissiveIntensity={running ? 0.15 : 0.02}
        />
      </mesh>
      {[0.4, 0.9, 1.4].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <torusGeometry args={[0.72, 0.025, 8, 24]} />
          <meshStandardMaterial
            color={colors.accent}
            metalness={0.9}
            roughness={0.1}
            emissive={colors.accent}
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.72, 0.7, Math.sin(angle) * 0.72]}
          >
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshStandardMaterial
              color="#a3a3a3"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
        );
      })}
      {[
        { angle: 0, color: "#ef4444", y: 0.6 },
        { angle: Math.PI / 2, color: "#3b82f6", y: 1.0 },
        { angle: Math.PI, color: "#f59e0b", y: 1.4 },
        { angle: -Math.PI / 2, color: "#22c55e", y: 0.8 },
      ].map((pipe, i) => (
        <group key={i}>
          <mesh
            position={[
              Math.cos(pipe.angle) * 0.85,
              pipe.y,
              Math.sin(pipe.angle) * 0.85,
            ]}
            rotation={[Math.PI / 2, 0, pipe.angle]}
          >
            <cylinderGeometry args={[0.05, 0.05, 0.5, 6]} />
            <meshStandardMaterial
              color={pipe.color}
              metalness={0.7}
              roughness={0.3}
              emissive={pipe.color}
              emissiveIntensity={0.2}
            />
          </mesh>
          <mesh
            position={[
              Math.cos(pipe.angle) * 1.15,
              pipe.y,
              Math.sin(pipe.angle) * 1.15,
            ]}
          >
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial
              color={pipe.color}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.25, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.18, 0.5, 8]} />
        <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.5, 0]}>
        <torusGeometry args={[0.17, 0.02, 6, 12]} />
        <meshStandardMaterial
          color={colors.accent}
          emissive={colors.primary}
          emissiveIntensity={0.5}
        />
      </mesh>
      <group ref={steamRef} position={[0, 2.5, 0]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              (Math.random() - 0.5) * 0.2,
              0,
              (Math.random() - 0.5) * 0.2,
            ]}
          >
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshStandardMaterial
              color="#e2e8f0"
              transparent
              opacity={0.3}
              emissive="#ffffff"
              emissiveIntensity={0.2}
            />
          </mesh>
        ))}
      </group>
      <mesh position={[0.5, 1.5, 0.55]}>
        <cylinderGeometry args={[0.1, 0.1, 0.04, 12]} />
        <meshStandardMaterial
          color="#1a1a2e"
          emissive={running ? "#22c55e" : "#333"}
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[-0.5, 1.5, 0.55]}>
        <cylinderGeometry args={[0.1, 0.1, 0.04, 12]} />
        <meshStandardMaterial
          color="#1a1a2e"
          emissive={running ? "#ef4444" : "#333"}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
};

const CNCLathe: React.FC<{ running: boolean }> = ({ running }) => {
  const spindleRef = useRef<THREE.Mesh>(null);
  const chuckRef = useRef<THREE.Mesh>(null);
  const sparkRef = useRef<THREE.Group>(null);
  const colors = getMachineColor("CNC Lathe");

  useFrame(({ clock }, delta) => {
    if (running) {
      if (spindleRef.current) spindleRef.current.rotation.x += delta * 10;
      if (chuckRef.current) chuckRef.current.rotation.x += delta * 10;
    }
    if (sparkRef.current) {
      sparkRef.current.children.forEach((child, i) => {
        if (running) {
          const t = (clock.elapsedTime * 3 + i * 1.2) % 2;
          child.position.set(
            0.3 + t * 0.5 * Math.cos(i * 2.1),
            1.0 + t * 0.3,
            t * 0.3 * Math.sin(i * 1.7),
          );
          (child as THREE.Mesh).scale.setScalar(Math.max(0, 1 - t / 2));
          child.visible = true;
        } else {
          child.visible = false;
        }
      });
    }
  });

  return (
    <group>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[2, 0.7, 1.2]} />
        <meshStandardMaterial
          color={colors.body}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0.71, 0]}>
        <boxGeometry args={[2.02, 0.02, 1.22]} />
        <meshStandardMaterial
          color={colors.primary}
          emissive={colors.primary}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[-0.65, 1.0, 0]} castShadow>
        <boxGeometry args={[0.6, 0.6, 0.8]} />
        <meshStandardMaterial
          color={colors.body}
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>
      <mesh
        ref={spindleRef}
        position={[-0.2, 1.0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.12, 0.12, 0.6, 12]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh
        ref={chuckRef}
        position={[0.1, 1.0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <torusGeometry args={[0.18, 0.04, 6, 16]} />
        <meshStandardMaterial
          color={colors.accent}
          emissive={colors.primary}
          emissiveIntensity={0.4}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0.1, 1.0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.3, 12]} />
        <meshStandardMaterial
          color="#fbbf24"
          metalness={0.9}
          roughness={0.1}
          emissive="#b45309"
          emissiveIntensity={running ? 0.3 : 0}
        />
      </mesh>
      <mesh position={[0.5, 1.0, 0]} castShadow>
        <boxGeometry args={[0.35, 0.25, 0.35]} />
        <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.3, 1.0, 0]}>
        <boxGeometry args={[0.15, 0.04, 0.04]} />
        <meshStandardMaterial
          color="#a3a3a3"
          metalness={0.95}
          roughness={0.05}
        />
      </mesh>
      <mesh position={[0.8, 1.0, 0]} castShadow>
        <boxGeometry args={[0.3, 0.4, 0.5]} />
        <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.4} />
      </mesh>
      {[-0.3, 0.3].map((z) => (
        <mesh key={z} position={[0.2, 0.75, z]}>
          <boxGeometry args={[1.4, 0.04, 0.06]} />
          <meshStandardMaterial
            color="#9ca3af"
            metalness={0.95}
            roughness={0.05}
          />
        </mesh>
      ))}
      <group ref={sparkRef}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.02, 4, 4]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
        ))}
      </group>
      <ControlPanel colors={colors} running={running} />
    </group>
  );
};

const CoolingTower: React.FC<{ running: boolean }> = ({ running }) => {
  const fanRef = useRef<THREE.Group>(null);
  const waterRef = useRef<THREE.Mesh>(null);
  const colors = getMachineColor("Cooling Tower");

  useFrame(({ clock }, delta) => {
    if (running && fanRef.current) {
      fanRef.current.rotation.y += delta * 4;
    }
    if (waterRef.current) {
      const mat = waterRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = running
        ? 0.3 + Math.sin(clock.elapsedTime * 2) * 0.15
        : 0.05;
    }
  });

  return (
    <group>
      <mesh ref={waterRef} position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.16, 16]} />
        <meshStandardMaterial
          color="#1e40af"
          metalness={0.3}
          roughness={0.5}
          emissive="#2563eb"
          emissiveIntensity={0.1}
          transparent
          opacity={0.8}
        />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <torusGeometry args={[0.9, 0.03, 8, 24]} />
        <meshStandardMaterial
          color={colors.accent}
          metalness={0.8}
          roughness={0.2}
          emissive={colors.primary}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.55, 0.7, 16]} />
        <meshStandardMaterial
          color={colors.body}
          metalness={0.5}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.6, 0.5, 16]} />
        <meshStandardMaterial
          color="#4a4a4a"
          metalness={0.5}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <cylinderGeometry args={[0.65, 0.55, 0.5, 16]} />
        <meshStandardMaterial
          color={colors.body}
          metalness={0.5}
          roughness={0.45}
        />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.6, 1.1, Math.sin(angle) * 0.6]}
          >
            <boxGeometry args={[0.03, 1.6, 0.03]} />
            <meshStandardMaterial
              color="#a78bfa"
              metalness={0.7}
              roughness={0.3}
              emissive="#7c3aed"
              emissiveIntensity={0.1}
            />
          </mesh>
        );
      })}
      <mesh position={[0, 2.0, 0]}>
        <torusGeometry args={[0.5, 0.04, 8, 16]} />
        <meshStandardMaterial
          color={colors.accent}
          metalness={0.8}
          roughness={0.2}
          emissive={colors.primary}
          emissiveIntensity={0.4}
        />
      </mesh>
      <group ref={fanRef} position={[0, 2.05, 0]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh
            key={i}
            rotation={[0, (i * Math.PI) / 3, 0]}
            position={[0.22, 0, 0]}
          >
            <boxGeometry args={[0.35, 0.04, 0.1]} />
            <meshStandardMaterial
              color={colors.accent}
              emissive={colors.primary}
              emissiveIntensity={running ? 0.6 : 0.1}
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
        ))}
      </group>
      {[0.6, -0.6].map((z, i) => (
        <mesh key={i} position={[0.85, 0.4, z]} rotation={[0, 0, Math.PI / 4]}>
          <cylinderGeometry args={[0.04, 0.04, 0.6, 6]} />
          <meshStandardMaterial
            color={i === 0 ? "#3b82f6" : "#ef4444"}
            metalness={0.7}
            roughness={0.3}
            emissive={i === 0 ? "#1d4ed8" : "#991b1b"}
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
    </group>
  );
};

/* ── Machine type dispatcher ───────────────────────── */

const MachineGeometry: React.FC<{ type: MachineType; running: boolean }> = ({
  type,
  running,
}) => {
  switch (type) {
    case "Injection Molding":
      return <InjectionMolding running={running} />;
    case "Hydraulic Press":
      return <HydraulicPress running={running} />;
    case "Industrial Boiler":
      return <IndustrialBoiler running={running} />;
    case "CNC Lathe":
      return <CNCLathe running={running} />;
    case "Cooling Tower":
      return <CoolingTower running={running} />;
    case "Conveyor Belt":
      return null;
    default:
      return (
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#4a5568"
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
      );
  }
};

/* ── Main component ────────────────────────────────── */

const MachineModel: React.FC<MachineModelProps> = ({ machine, onClick }) => {
  const lightRef = useRef<THREE.PointLight>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const statusConfig = STATUS_COLORS[machine.status];
  const machineColors = getMachineColor(machine.type);

  useFrame(({ clock }) => {
    if (!lightRef.current || !ringRef.current) return;

    if (statusConfig.pulseSpeed > 0) {
      const pulse =
        0.5 +
        0.5 *
          Math.sin(clock.elapsedTime * statusConfig.pulseSpeed * Math.PI * 2);
      lightRef.current.intensity = 0.5 + pulse * 1.5;
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.3 + pulse * 0.5;
    } else {
      lightRef.current.intensity = 0.8;
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4;
    }

    if (haloRef.current) {
      haloRef.current.rotation.z += 0.003;
    }
  });

  if (!machine.visible) return null;
  if (machine.type === "Conveyor Belt") return null;

  return (
    <group
      position={machine.position}
      onClick={(e) => {
        e.stopPropagation();
        onClick(machine);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <pointLight
        ref={lightRef}
        position={[0, 2.5, 0]}
        color={statusConfig.hex}
        intensity={0.8}
        distance={8}
        decay={2}
      />
      <pointLight
        position={[0, 0.5, 1]}
        color={machineColors.primary}
        intensity={0.3}
        distance={4}
        decay={2}
      />

      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
      >
        <torusGeometry args={[1.3, 0.06, 4, 48]} />
        <meshBasicMaterial color={statusConfig.hex} transparent opacity={0.4} />
      </mesh>
      <mesh
        ref={haloRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.025, 0]}
      >
        <torusGeometry args={[1.1, 0.03, 4, 48]} />
        <meshBasicMaterial
          color={machineColors.accent}
          transparent
          opacity={0.25}
        />
      </mesh>

      <MachineGeometry type={machine.type} running={machine.motorRunning} />

      <WarningBeacon status={machine.status} height={2.8} />
      <DataLabel machine={machine} />
    </group>
  );
};

export default MachineModel;
