"use no memo";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { OutputDeviceState, OutputDeviceType } from "../../types/digitalTwin";

interface OutputDevice3DProps {
  device: OutputDeviceState;
  position: [number, number, number];
}

/* ── Switch (4 Endpoints) ─────────────────────────────── */

const Switch4EP: React.FC<{ device: OutputDeviceState }> = ({ device }) => {
  const endpoints = device.endpoints ?? [false, false, false, false];

  return (
    <group>
      {/* Panel box */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.14, 0.1, 0.04]} />
        <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* 4 endpoint indicators */}
      {endpoints.map((on, i) => (
        <mesh key={i} position={[-0.04 + i * 0.027, 0.08, 0.025]}>
          <sphereGeometry args={[0.01, 6, 6]} />
          <meshStandardMaterial
            color={on ? "#22c55e" : "#6b7280"}
            emissive={on ? "#22c55e" : "#333"}
            emissiveIntensity={on ? 0.8 : 0.1}
          />
        </mesh>
      ))}
    </group>
  );
};

/* ── Shelly Relay ─────────────────────────────────────── */

const ShellyDevice: React.FC<{ device: OutputDeviceState }> = ({ device }) => {
  const ledRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ledRef.current) return;
    const mat = ledRef.current.material as THREE.MeshStandardMaterial;
    if (device.active) {
      mat.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 3) * 0.3;
    } else {
      mat.emissiveIntensity = 0.05;
    }
  });

  return (
    <group>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.08, 0.05, 0.06]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh ref={ledRef} position={[0, 0.07, 0.03]}>
        <sphereGeometry args={[0.01, 6, 6]} />
        <meshStandardMaterial
          color={device.active ? "#3b82f6" : "#6b7280"}
          emissive={device.active ? "#3b82f6" : "#333"}
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
};

/* ── Single Phase ─────────────────────────────────────── */

const SinglePhaseDevice: React.FC<{ device: OutputDeviceState }> = ({ device }) => {
  const handleRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!handleRef.current) return;
    const target = device.active ? 0 : Math.PI / 6;
    handleRef.current.rotation.z += (target - handleRef.current.rotation.z) * 0.1;
  });

  return (
    <group>
      {/* Panel */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.1, 0.12, 0.03]} />
        <meshStandardMaterial color="#4b5563" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Breaker handle */}
      <mesh ref={handleRef} position={[0, 0.08, 0.02]}>
        <boxGeometry args={[0.03, 0.05, 0.015]} />
        <meshStandardMaterial
          color={device.active ? "#22c55e" : "#ef4444"}
          emissive={device.active ? "#22c55e" : "#ef4444"}
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
};

/* ── Power Meter ──────────────────────────────────────── */

const PowerMeterDevice: React.FC<{ device: OutputDeviceState }> = ({ device }) => {
  return (
    <group>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.1, 0.08, 0.03]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Digital readout */}
      <Html position={[0, 0.06, 0.02]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
        <div
          className="px-1 py-0.5 rounded text-[7px] font-mono font-bold whitespace-nowrap"
          style={{
            backgroundColor: "rgba(0,0,0,0.8)",
            color: device.active ? "#22c55e" : "#6b7280",
            border: `1px solid ${device.active ? "#22c55e40" : "#33333340"}`,
          }}
        >
          {device.powerW?.toFixed(0) ?? "---"}W
        </div>
      </Html>
    </group>
  );
};

/* ── Motor ────────────────────────────────────────────── */

const MotorDevice: React.FC<{ device: OutputDeviceState }> = ({ device }) => {
  const shaftRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!shaftRef.current) return;
    if (device.active && device.rpm) {
      shaftRef.current.rotation.x += delta * (device.rpm / 60) * Math.PI * 2;
    }
  });

  return (
    <group>
      {/* Motor body */}
      <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.1, 10]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Shaft */}
      <mesh ref={shaftRef} position={[0.08, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.01, 0.01, 0.06, 6]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Status indicator */}
      <mesh position={[0, 0.1, 0.04]}>
        <sphereGeometry args={[0.01, 6, 6]} />
        <meshStandardMaterial
          color={device.active ? "#22c55e" : "#6b7280"}
          emissive={device.active ? "#22c55e" : "#333"}
          emissiveIntensity={device.active ? 0.6 : 0.1}
        />
      </mesh>
    </group>
  );
};

/* ── Emergency Light ──────────────────────────────────── */

const EmergencyLightDevice: React.FC<{ device: OutputDeviceState }> = ({ device }) => {
  const beaconRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!beaconRef.current || !lightRef.current) return;
    if (device.active) {
      const pulse = Math.max(0, Math.sin(clock.elapsedTime * 6));
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + pulse * 2;
      lightRef.current.intensity = pulse * 2;
    } else {
      (beaconRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.05;
      lightRef.current.intensity = 0;
    }
  });

  return (
    <group>
      {/* Pole */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.2, 6]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Beacon */}
      <mesh ref={beaconRef} position={[0, 0.24, 0]}>
        <sphereGeometry args={[0.035, 10, 10]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.05} transparent opacity={0.9} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 0.24, 0]} color="#ef4444" intensity={0} distance={3} decay={2} />
    </group>
  );
};

/* ── Device type dispatcher ───────────────────────────── */

const DeviceGeometry: React.FC<{ type: OutputDeviceType; device: OutputDeviceState }> = ({ type, device }) => {
  switch (type) {
    case "switch_4ep":      return <Switch4EP device={device} />;
    case "shelly":          return <ShellyDevice device={device} />;
    case "single_phase":    return <SinglePhaseDevice device={device} />;
    case "power_meter":     return <PowerMeterDevice device={device} />;
    case "motor":           return <MotorDevice device={device} />;
    case "emergency_light": return <EmergencyLightDevice device={device} />;
    default:
      return (
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[0.06, 0.06, 0.06]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
      );
  }
};

/* ── Main component ───────────────────────────────────── */

const OutputDevice3D: React.FC<OutputDevice3DProps> = ({ device, position }) => {
  return (
    <group position={position}>
      <DeviceGeometry type={device.type} device={device} />
    </group>
  );
};

export default OutputDevice3D;
