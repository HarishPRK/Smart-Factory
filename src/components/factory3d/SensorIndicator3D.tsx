"use no memo";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SensorReading, SensorType } from "../../types/digitalTwin";

interface SensorIndicator3DProps {
  reading: SensorReading;
  position: [number, number, number];
}

/* ── Status color helper ──────────────────────────────── */

function statusHex(status: "normal" | "warning" | "critical"): string {
  if (status === "critical") return "#ef4444";
  if (status === "warning") return "#f59e0b";
  return "#10b981";
}

/* ── Base mount (shared by all sensors) ───────────────── */

const SensorMount: React.FC<{ status: "normal" | "warning" | "critical" }> = ({ status }) => {
  const ledRef = useRef<THREE.Mesh>(null);
  const color = statusHex(status);

  useFrame(({ clock }) => {
    if (!ledRef.current) return;
    const mat = ledRef.current.material as THREE.MeshStandardMaterial;
    if (status !== "normal") {
      const speed = status === "critical" ? 6 : 2;
      mat.emissiveIntensity = 0.4 + Math.sin(clock.elapsedTime * speed) * 0.6;
    } else {
      mat.emissiveIntensity = 0.3;
    }
  });

  return (
    <group>
      {/* Bracket box */}
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[0.12, 0.06, 0.12]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Status LED */}
      <mesh ref={ledRef} position={[0, -0.04, 0.07]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
};

/* ── pH Probe ─────────────────────────────────────────── */

const PHSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const normalizedPH = (reading.value - reading.min) / (reading.max - reading.min);

  useFrame(() => {
    if (!ringRef.current) return;
    const mat = ringRef.current.material as THREE.MeshStandardMaterial;
    // Green at pH 7, red at extremes
    const r = Math.abs(normalizedPH - 0.5) * 2;
    mat.color.setRGB(r, 1 - r, 0.2);
    mat.emissive.setRGB(r * 0.5, (1 - r) * 0.3, 0);
    mat.emissiveIntensity = reading.status !== "normal" ? 1.0 : 0.3;
  });

  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
        <meshStandardMaterial color="#a3a3a3" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.05, 0]}>
        <torusGeometry args={[0.04, 0.012, 6, 12]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.3} transparent opacity={0.8} />
      </mesh>
    </group>
  );
};

/* ── Microwave Motion ─────────────────────────────────── */

const MicrowaveMotionSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const dishRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!dishRef.current) return;
    const mat = dishRef.current.material as THREE.MeshStandardMaterial;
    if (reading.value > 0.3) {
      mat.emissiveIntensity = 0.3 + Math.sin(clock.elapsedTime * 4) * 0.5;
      dishRef.current.rotation.y = clock.elapsedTime * 0.5;
    } else {
      mat.emissiveIntensity = 0.05;
    }
  });

  return (
    <group>
      <mesh ref={dishRef} position={[0, 0.08, 0]} rotation={[0.3, 0, 0]}>
        <coneGeometry args={[0.05, 0.04, 12, 1, true]} />
        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.05} side={THREE.DoubleSide} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <circleGeometry args={[0.02, 8]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
};

/* ── Turbidity ────────────────────────────────────────── */

const TurbiditySensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const tubeRef = useRef<THREE.Mesh>(null);
  const normalized = Math.min(1, reading.value / reading.max);

  useFrame(() => {
    if (!tubeRef.current) return;
    const mat = tubeRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.3 + normalized * 0.5;
    mat.emissiveIntensity = normalized * 0.5;
  });

  return (
    <group>
      <mesh ref={tubeRef} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.18, 8]} />
        <meshStandardMaterial color="#d4a574" emissive="#a3651a" emissiveIntensity={0.1} transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.032, 0.032, 0.19, 8, 1, true]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

/* ── O2 Sensor ────────────────────────────────────────── */

const O2Sensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const domeRef = useRef<THREE.Mesh>(null);
  const normalized = Math.min(1, reading.value / 25);

  useFrame(({ clock }) => {
    if (!domeRef.current) return;
    const mat = domeRef.current.material as THREE.MeshStandardMaterial;
    mat.color.setRGB(1 - normalized, 0.2, normalized);
    mat.emissive.setRGB((1 - normalized) * 0.5, 0, normalized * 0.3);
    if (reading.status !== "normal") {
      mat.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 3) * 0.4;
    } else {
      mat.emissiveIntensity = 0.2;
    }
  });

  return (
    <group>
      <mesh ref={domeRef} position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.04, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.04, 10]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
};

/* ── LiDAR Scanner ────────────────────────────────────── */

const LiDARSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const topRef = useRef<THREE.Mesh>(null);
  const laserRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (topRef.current) {
      topRef.current.rotation.y = clock.elapsedTime * 3;
    }
    if (laserRef.current) {
      const mat = laserRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = reading.status === "critical" ? 1.5 : 0.5;
      mat.opacity = 0.3 + Math.sin(clock.elapsedTime * 8) * 0.2;
    }
  });

  return (
    <group>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.06, 10]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={topRef} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.03, 0.035, 0.08, 10]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.4} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Laser line */}
      <mesh ref={laserRef} position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.15, 4]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} transparent opacity={0.4} />
      </mesh>
    </group>
  );
};

/* ── Light Intensity ──────────────────────────────────── */

const LightIntensitySensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const panelRef = useRef<THREE.Mesh>(null);
  const normalized = Math.min(1, reading.value / reading.max);

  useFrame(() => {
    if (!panelRef.current) return;
    const mat = panelRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = normalized * 0.8;
  });

  return (
    <group>
      <mesh ref={panelRef} position={[0, 0.06, 0]}>
        <boxGeometry args={[0.07, 0.07, 0.015]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.06, 0.01]}>
        <circleGeometry args={[0.02, 8]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.3} roughness={0.7} />
      </mesh>
    </group>
  );
};

/* ── GPS ──────────────────────────────────────────────── */

const GPSSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const tipRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!tipRef.current) return;
    const mat = tipRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = Math.sin(clock.elapsedTime * 6) > 0.5 ? 1.0 : 0.1;
  });

  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh ref={tipRef} position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
};

/* ── ORP Electrode ────────────────────────────────────── */

const ORPSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const probeRef = useRef<THREE.Mesh>(null);
  const normalized = (reading.value - reading.min) / (reading.max - reading.min);

  useFrame(() => {
    if (!probeRef.current) return;
    const mat = probeRef.current.material as THREE.MeshStandardMaterial;
    const r = Math.abs(normalized - 0.5) * 2;
    mat.emissive.setRGB(r * 0.6, (1 - r) * 0.4, 0.1);
    mat.emissiveIntensity = reading.status !== "normal" ? 0.8 : 0.2;
  });

  return (
    <group>
      <mesh ref={probeRef} position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.015, 0.012, 0.16, 8]} />
        <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={0.2} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <sphereGeometry args={[0.018, 6, 6]} />
        <meshStandardMaterial color="#6d28d9" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
};

/* ── Water Sensor ─────────────────────────────────────── */

const WaterSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const plateRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!plateRef.current) return;
    const mat = plateRef.current.material as THREE.MeshStandardMaterial;
    const detected = reading.value > 0.3;
    mat.emissiveIntensity = detected ? 0.5 + Math.sin(clock.elapsedTime * 4) * 0.4 : 0.05;
  });

  return (
    <group>
      <mesh ref={plateRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.08, 0.08]} />
        <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.05} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.09, 0.02, 0.09]} />
        <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
};

/* ── MQ Gas Sensor ────────────────────────────────────── */

const MQGasSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const grilleRef = useRef<THREE.Mesh>(null);
  const normalized = Math.min(1, reading.value / reading.max);

  useFrame(({ clock }) => {
    if (!grilleRef.current) return;
    const mat = grilleRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = normalized * 1.2;
    if (reading.status === "critical") {
      mat.emissiveIntensity += Math.sin(clock.elapsedTime * 6) * 0.5;
    }
  });

  return (
    <group>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.1, 8]} />
        <meshStandardMaterial color="#4b5563" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh ref={grilleRef} position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.032, 0.032, 0.02, 8]} />
        <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={0.2} metalness={0.3} roughness={0.7} />
      </mesh>
    </group>
  );
};

/* ── Pressure Gauge ───────────────────────────────────── */

const PressureSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const needleRef = useRef<THREE.Mesh>(null);
  const normalized = (reading.value - reading.min) / (reading.max - reading.min);

  useFrame(() => {
    if (!needleRef.current) return;
    // Needle sweeps from -135deg to +135deg
    needleRef.current.rotation.z = -Math.PI * 0.75 + normalized * Math.PI * 1.5;
  });

  return (
    <group>
      {/* Gauge face */}
      <mesh position={[0, 0.08, 0.01]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.045, 16]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <torusGeometry args={[0.045, 0.005, 6, 16]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Needle */}
      <mesh ref={needleRef} position={[0, 0.08, 0.015]}>
        <boxGeometry args={[0.003, 0.04, 0.003]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
};

/* ── Fingerprint Scanner ──────────────────────────────── */

const FingerprintSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const scanRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!scanRef.current) return;
    // Scan line sweeps
    const t = (clock.elapsedTime * 2) % 1;
    scanRef.current.position.y = 0.03 + t * 0.04;
    const mat = scanRef.current.material as THREE.MeshStandardMaterial;
    mat.color.set(reading.value > 0.5 ? "#22c55e" : "#ef4444");
    mat.emissive.set(reading.value > 0.5 ? "#22c55e" : "#ef4444");
    mat.emissiveIntensity = 0.6;
  });

  return (
    <group>
      {/* Pad */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.06, 0.01, 0.08]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Scan line */}
      <mesh ref={scanRef} position={[0, 0.05, 0]}>
        <boxGeometry args={[0.05, 0.002, 0.002]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
};

/* ── Proximity Switch (inductive) ─────────────────────── */

const ProximitySensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const ledRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ledRef.current) return;
    const mat = ledRef.current.material as THREE.MeshStandardMaterial;
    const detected = reading.value > 0.5;
    mat.color.set(detected ? "#22c55e" : "#ef4444");
    mat.emissive.set(detected ? "#22c55e" : "#ef4444");
    mat.emissiveIntensity =
      reading.status !== "normal"
        ? 0.4 + Math.sin(clock.elapsedTime * 5) * 0.5
        : detected
        ? 0.8
        : 0.2;
  });

  return (
    <group>
      {/* Barrel body */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.12, 10]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Sensing face */}
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.01, 10]} />
        <meshStandardMaterial color="#1f2937" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Detect LED */}
      <mesh ref={ledRef} position={[0, 0.03, 0.025]}>
        <sphereGeometry args={[0.008, 6, 6]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
};

/* ── Optical (photoelectric) ──────────────────────────── */

const OpticalSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const beamRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!beamRef.current) return;
    const mat = beamRef.current.material as THREE.MeshStandardMaterial;
    const blocked = reading.value < 0.5;
    mat.opacity = blocked ? 0.1 : 0.6 + Math.sin(clock.elapsedTime * 10) * 0.2;
    mat.emissiveIntensity = blocked ? 0.1 : 0.9;
  });

  return (
    <group>
      {/* Emitter */}
      <mesh position={[-0.06, 0.06, 0]}>
        <boxGeometry args={[0.03, 0.04, 0.03]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Receiver */}
      <mesh position={[0.06, 0.06, 0]}>
        <boxGeometry args={[0.03, 0.04, 0.03]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Beam */}
      <mesh ref={beamRef} position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.003, 0.003, 0.12, 4]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} transparent opacity={0.6} />
      </mesh>
    </group>
  );
};

/* ── Emergency Shutdown Switch ────────────────────────── */

const EmergencyStopSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const capRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!capRef.current) return;
    const mat = capRef.current.material as THREE.MeshStandardMaterial;
    const pressed = reading.value > 0.5;
    // When pressed, cap sinks slightly and pulses red
    capRef.current.position.y = pressed ? 0.05 : 0.07;
    mat.emissiveIntensity = pressed ? 0.6 + Math.sin(clock.elapsedTime * 6) * 0.4 : 0.3;
  });

  return (
    <group>
      {/* Yellow base */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.04, 16]} />
        <meshStandardMaterial color="#facc15" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Red mushroom cap */}
      <mesh ref={capRef} position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.02, 16]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} metalness={0.2} roughness={0.4} />
      </mesh>
      {/* Top dome */}
      <mesh position={[0, 0.085, 0]}>
        <sphereGeometry args={[0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#dc2626" metalness={0.2} roughness={0.4} />
      </mesh>
    </group>
  );
};

/* ── Capacitive Touch Pad ─────────────────────────────── */

const CapacitiveTouchSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const padRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (padRef.current) {
      const mat = padRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = reading.value > 0.5 ? 0.7 : 0.15;
    }
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      const active = reading.value > 0.5;
      const scale = active ? 1 + Math.sin(clock.elapsedTime * 4) * 0.3 : 1;
      ringRef.current.scale.set(scale, 1, scale);
      mat.opacity = active ? 0.7 : 0.2;
    }
  });

  return (
    <group>
      {/* Housing */}
      <mesh position={[0, 0.015, 0]}>
        <boxGeometry args={[0.09, 0.01, 0.09]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Touch pad */}
      <mesh ref={padRef} position={[0, 0.025, 0]}>
        <boxGeometry args={[0.07, 0.005, 0.07]} />
        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.15} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Pulse ring */}
      <mesh ref={ringRef} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.035, 0.04, 20]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.6} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

/* ── Water Level (tank gauge) ─────────────────────────── */

const WaterLevelSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const fillRef = useRef<THREE.Mesh>(null);
  const normalized = Math.min(1, Math.max(0, (reading.value - reading.min) / (reading.max - reading.min)));

  useFrame(() => {
    if (!fillRef.current) return;
    const height = 0.001 + normalized * 0.16;
    fillRef.current.scale.y = height / 0.16;
    fillRef.current.position.y = 0.02 + height / 2;
    const mat = fillRef.current.material as THREE.MeshStandardMaterial;
    mat.color.set(reading.status === "critical" ? "#ef4444" : reading.status === "warning" ? "#f59e0b" : "#3b82f6");
    mat.emissive.set(reading.status === "critical" ? "#ef4444" : reading.status === "warning" ? "#f59e0b" : "#1d4ed8");
  });

  return (
    <group>
      {/* Clear cylinder */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.18, 12, 1, true]} />
        <meshStandardMaterial color="#e5e7eb" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
      {/* Fill level */}
      <mesh ref={fillRef} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.16, 12]} />
        <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.4} transparent opacity={0.8} />
      </mesh>
      {/* Cap */}
      <mesh position={[0, 0.195, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.01, 12]} />
        <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
};

/* ── RFID Reader ──────────────────────────────────────── */

const RFIDSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const ringRefs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];

  useFrame(({ clock }) => {
    const authorized = reading.value > 0.5;
    ringRefs.forEach((ref, i) => {
      if (!ref.current) return;
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      const phase = clock.elapsedTime * 2 - i * 0.6;
      const wave = (phase % 1.5) / 1.5;
      const scale = 0.5 + wave * 1.2;
      ref.current.scale.set(scale, 1, scale);
      mat.opacity = authorized ? (1 - wave) * 0.6 : 0.1;
      mat.color.set(authorized ? "#22c55e" : "#ef4444");
      mat.emissive.set(authorized ? "#22c55e" : "#ef4444");
    });
  });

  return (
    <group>
      {/* Reader plate */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.1, 0.015, 0.08]} />
        <meshStandardMaterial color="#1e3a8a" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Antenna wave rings */}
      {ringRefs.map((ref, i) => (
        <mesh key={i} ref={ref} position={[0, 0.035 + i * 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.025, 0.03, 18]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.6} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

/* ── Fire / Smoke Sensor ──────────────────────────────── */

const FireSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const flameRef = useRef<THREE.Mesh>(null);
  // Fire sensor publishes HIGH when safe (~95) and drops toward 0 when fire
  // is detected — so the flame visual should be dormant when value is high
  // and roar louder as value drops. `dangerLevel` = 1 - normalized.
  const dangerLevel = 1 - Math.min(1, reading.value / reading.max);

  useFrame(({ clock }) => {
    if (!flameRef.current) return;
    const mat = flameRef.current.material as THREE.MeshStandardMaterial;
    const flicker = 1 + Math.sin(clock.elapsedTime * 9) * 0.15 + Math.sin(clock.elapsedTime * 17) * 0.08;
    flameRef.current.scale.set(flicker, flicker, flicker);
    mat.emissiveIntensity = 0.2 + dangerLevel * 1.2 + (reading.status === "critical" ? 0.5 : 0);
  });

  return (
    <group>
      {/* Housing */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.04, 0.045, 0.04, 12]} />
        <meshStandardMaterial color="#7f1d1d" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Flame indicator */}
      <mesh ref={flameRef} position={[0, 0.1, 0]}>
        <coneGeometry args={[0.025, 0.08, 10]} />
        <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={0.3} transparent opacity={0.85} />
      </mesh>
    </group>
  );
};

/* ── Liquid Flow Signal ───────────────────────────────── */

const FlowLiquidSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const particlesRef = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const normalized = Math.min(1, reading.value / reading.max);

  useFrame(({ clock }) => {
    particlesRef.forEach((ref, i) => {
      if (!ref.current) return;
      const phase = (clock.elapsedTime * (0.3 + normalized * 1.5) + i * 0.25) % 1;
      ref.current.position.x = -0.07 + phase * 0.14;
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.opacity = normalized > 0.05 ? 0.85 : 0.1;
    });
  });

  return (
    <group>
      {/* Horizontal pipe */}
      <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.16, 10, 1, true]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* Pipe ends */}
      <mesh position={[-0.08, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.02, 10]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.08, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.02, 10]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Flow particles */}
      {particlesRef.map((ref, i) => (
        <mesh key={i} ref={ref} position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.008, 6, 6]} />
          <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.6} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
};

/* ── Valve Position Signal ────────────────────────────── */

const ValveSignalSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const handleRef = useRef<THREE.Mesh>(null);
  const normalized = Math.min(1, Math.max(0, (reading.value - reading.min) / (reading.max - reading.min)));

  useFrame(() => {
    if (!handleRef.current) return;
    // 0% = closed (perpendicular), 100% = open (aligned with pipe)
    handleRef.current.rotation.y = normalized * (Math.PI / 2);
    const mat = handleRef.current.material as THREE.MeshStandardMaterial;
    mat.color.set(reading.status === "critical" ? "#ef4444" : reading.status === "warning" ? "#f59e0b" : "#10b981");
    mat.emissive.set(reading.status === "critical" ? "#ef4444" : reading.status === "warning" ? "#f59e0b" : "#10b981");
  });

  return (
    <group>
      {/* Valve body */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.04, 12]} />
        <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Stem */}
      <mesh position={[0, 0.085, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.03, 6]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Rotary handle */}
      <mesh ref={handleRef} position={[0, 0.105, 0]}>
        <boxGeometry args={[0.09, 0.008, 0.015]} />
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.4} metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
};

/* ── Air Flow Signal ──────────────────────────────────── */

const FlowAirSensor: React.FC<{ reading: SensorReading }> = ({ reading }) => {
  const particlesRef = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const normalized = Math.min(1, reading.value / reading.max);

  useFrame(({ clock }) => {
    particlesRef.forEach((ref, i) => {
      if (!ref.current) return;
      const phase = (clock.elapsedTime * (0.4 + normalized * 2.0) + i * 0.22) % 1;
      ref.current.position.x = -0.07 + phase * 0.14;
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.opacity = normalized > 0.05 ? 0.75 : 0.1;
    });
  });

  return (
    <group>
      {/* Horizontal pipe */}
      <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, 0.16, 10, 1, true]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Pipe ends */}
      <mesh position={[-0.08, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.027, 0.027, 0.02, 10]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.08, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.027, 0.027, 0.02, 10]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Air particles */}
      {particlesRef.map((ref, i) => (
        <mesh key={i} ref={ref} position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.007, 6, 6]} />
          <meshStandardMaterial color="#f1f5f9" emissive="#e2e8f0" emissiveIntensity={0.4} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
};

/* ── Sensor type dispatcher ───────────────────────────── */

const SensorGeometry: React.FC<{ type: SensorType; reading: SensorReading }> = ({ type, reading }) => {
  switch (type) {
    case "ph":               return <PHSensor reading={reading} />;
    case "microwave_motion": return <MicrowaveMotionSensor reading={reading} />;
    case "turbidity":        return <TurbiditySensor reading={reading} />;
    case "o2":               return <O2Sensor reading={reading} />;
    case "lidar":            return <LiDARSensor reading={reading} />;
    case "light_intensity":  return <LightIntensitySensor reading={reading} />;
    case "gps":              return <GPSSensor reading={reading} />;
    case "orp":              return <ORPSensor reading={reading} />;
    case "water":            return <WaterSensor reading={reading} />;
    case "mq_gas":           return <MQGasSensor reading={reading} />;
    case "pressure":         return <PressureSensor reading={reading} />;
    case "fingerprint":      return <FingerprintSensor reading={reading} />;
    case "proximity":        return <ProximitySensor reading={reading} />;
    case "optical":          return <OpticalSensor reading={reading} />;
    case "emergency_stop":   return <EmergencyStopSensor reading={reading} />;
    case "capacitive_touch": return <CapacitiveTouchSensor reading={reading} />;
    case "water_level":      return <WaterLevelSensor reading={reading} />;
    case "rfid":             return <RFIDSensor reading={reading} />;
    case "fire":             return <FireSensor reading={reading} />;
    case "flow_liquid":      return <FlowLiquidSensor reading={reading} />;
    case "valve_signal":     return <ValveSignalSensor reading={reading} />;
    case "flow_air":         return <FlowAirSensor reading={reading} />;
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

const SensorIndicator3D: React.FC<SensorIndicator3DProps> = ({ reading, position }) => {
  return (
    <group position={position}>
      <SensorMount status={reading.status} />
      <SensorGeometry type={reading.type} reading={reading} />
    </group>
  );
};

export default SensorIndicator3D;
