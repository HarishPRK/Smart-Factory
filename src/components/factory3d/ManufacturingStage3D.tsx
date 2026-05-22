"use no memo";
import React, { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import {
  SENSOR_OFFSETS,
  DEVICE_OFFSETS,
  STAGE_STATUS_COLORS,
  STAGE_CONFIGS,
} from "./digitalTwinLayout";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import StageEquipment3D from "./StageEquipment3D";
import type { ManufacturingStage, StageId } from "../../types/digitalTwin";

interface ManufacturingStage3DProps {
  stageIndex: number;
  onClick: (stage: ManufacturingStage) => void;
  isSelected?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  normal: "#10b981",
  warning: "#f59e0b",
  critical: "#ef4444",
};

const STAGE_LABELS: Record<StageId, string> = {
  intake: "PET RESIN INTAKE",
  forming: "BOTTLE BLOW MOLDING",
  mixing: "COCA-COLA FILLING",
  curing: "COOLING TUNNEL",
  quality: "QUALITY INSPECTION",
  packaging: "CASE PACKING",
  dispatch: "SHIPPING DOCK",
};

/**
 * ManufacturingStage3D — Performance-optimized
 *
 * ONE useFrame for the entire stage (sensors + devices + status + effects).
 * Reads store via getState() — zero React re-renders from simulation.
 * Floating sensor readouts updated imperatively via DOM refs.
 * Threshold effects: warning halo, backdrop glow, area point light.
 */
const ManufacturingStage3D: React.FC<ManufacturingStage3DProps> = ({
  stageIndex,
  onClick,
  isSelected = false,
}) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const archGlowRef = useRef<THREE.Mesh>(null);
  const sensorRefs = useRef<(THREE.Mesh | null)[]>([]);
  const deviceRefs = useRef<(THREE.Mesh | null)[]>([]);
  const statusLedRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Threshold effect refs
  const warningHaloRef = useRef<THREE.Mesh>(null);
  const backdropRef = useRef<THREE.Mesh>(null);
  const stageLightRef = useRef<THREE.PointLight>(null);

  // Floating sensor label refs — direct element refs (no querySelector needed)
  const sensorValueRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const sensorDotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const sensorContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastDomUpdateRef = useRef(0); // throttle DOM writes

  // Stage name label ref
  const stageLabelRef = useRef<HTMLDivElement>(null);

  // Read initial position (stable — never changes)
  const position = useMemo(() => {
    const stages = useDigitalTwinStore.getState().stages;
    return (
      stages[stageIndex]?.position ?? ([0, 0, 0] as [number, number, number])
    );
  }, [stageIndex]);

  // Single useFrame for ALL animations in this stage
  useFrame(({ clock }) => {
    const stage = useDigitalTwinStore.getState().stages[stageIndex];
    if (!stage) return;

    const t = clock.elapsedTime;
    const statusConfig =
      STAGE_STATUS_COLORS[stage.status] ?? STAGE_STATUS_COLORS.idle;

    // Floor ring pulse
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.color.set(statusConfig.hex);
      if (stage.status === "faulted") {
        mat.opacity = 0.3 + Math.sin(t * 4) * 0.3;
      } else if (stage.status === "warning") {
        mat.opacity = 0.2 + Math.sin(t * 2) * 0.15;
      } else {
        mat.opacity = 0.25;
      }
    }

    // Arch glow
    if (archGlowRef.current) {
      const mat = archGlowRef.current.material as THREE.MeshStandardMaterial;
      mat.color.set(statusConfig.hex);
      mat.emissive.set(statusConfig.hex);
      if (stage.status === "faulted") {
        mat.emissiveIntensity = 0.5 + Math.sin(t * 4) * 0.4;
      } else if (stage.status === "running") {
        mat.emissiveIntensity = 0.3 + Math.sin(t) * 0.1;
      } else {
        mat.emissiveIntensity = 0.1;
      }
    }

    // ── Threshold visual effects ──────────────────────────
    // Warning halo — large floor torus
    if (warningHaloRef.current) {
      const mat = warningHaloRef.current.material as THREE.MeshBasicMaterial;
      if (stage.status === "faulted") {
        mat.opacity = 0.15 + Math.sin(t * 6) * 0.15;
        mat.color.set("#ef4444");
      } else if (stage.status === "warning") {
        mat.opacity = 0.08 + Math.sin(t * 2) * 0.05;
        mat.color.set("#f59e0b");
      } else {
        mat.opacity = 0;
      }
    }

    // Backdrop glow panel
    if (backdropRef.current) {
      const mat = backdropRef.current.material as THREE.MeshBasicMaterial;
      if (stage.status === "faulted") {
        mat.opacity = 0.12 + Math.sin(t * 4) * 0.08;
        mat.color.set("#ef4444");
      } else if (stage.status === "warning") {
        mat.opacity = 0.06 + Math.sin(t * 2) * 0.03;
        mat.color.set("#f59e0b");
      } else {
        mat.opacity = 0;
      }
    }

    // Stage area point light
    if (stageLightRef.current) {
      if (stage.status === "faulted") {
        stageLightRef.current.intensity = 1.5 + Math.sin(t * 6) * 1.0;
        stageLightRef.current.color.set("#ef4444");
      } else if (stage.status === "warning") {
        stageLightRef.current.intensity = 0.4 + Math.sin(t * 2) * 0.3;
        stageLightRef.current.color.set("#f59e0b");
      } else if (stage.status === "running") {
        stageLightRef.current.intensity = 0.15;
        stageLightRef.current.color.set("#10b981");
      } else {
        stageLightRef.current.intensity = 0;
      }
    }

    // Sensor LEDs — update color (Three.js materials, no DOM cost)
    for (
      let i = 0;
      i < stage.sensors.length && i < statusLedRefs.current.length;
      i++
    ) {
      const led = statusLedRefs.current[i];
      if (!led) continue;
      const sensor = stage.sensors[i];
      const color =
        sensor.status === "critical"
          ? "#ef4444"
          : sensor.status === "warning"
            ? "#f59e0b"
            : "#10b981";
      const mat = led.material as THREE.MeshStandardMaterial;
      mat.color.set(color);
      mat.emissive.set(color);
      if (sensor.status !== "normal") {
        const speed = sensor.status === "critical" ? 6 : 2;
        mat.emissiveIntensity = 0.4 + Math.sin(t * speed) * 0.6;
      } else {
        mat.emissiveIntensity = 0.3;
      }
    }

    // ── DOM updates — throttled to every 100ms (not every frame) ──
    // This eliminates layout thrashing from 60fps DOM writes
    const now = performance.now();
    if (now - lastDomUpdateRef.current > 100) {
      lastDomUpdateRef.current = now;

      // Stage name label color
      if (stageLabelRef.current) {
        const color =
          stage.status === "faulted"
            ? "#ef4444"
            : stage.status === "warning"
              ? "#f59e0b"
              : stage.status === "running"
                ? "#10b981"
                : "#94a3b8";
        stageLabelRef.current.style.borderColor = color;
        stageLabelRef.current.style.boxShadow =
          stage.status === "faulted"
            ? `0 0 12px ${color}`
            : stage.status === "warning"
              ? `0 0 8px ${color}`
              : "none";
      }

      // Sensor readouts — direct ref access (no querySelector)
      for (let i = 0; i < stage.sensors.length; i++) {
        const sensor = stage.sensors[i];
        const statusColor =
          STATUS_COLORS[sensor.status] ?? STATUS_COLORS.normal;

        const valueEl = sensorValueRefs.current[i];
        if (valueEl) {
          const formatted =
            sensor.unit === "" || sensor.unit === "m"
              ? sensor.value.toFixed(1)
              : sensor.value.toFixed(sensor.value >= 100 ? 0 : 1);
          valueEl.textContent = `${formatted}${sensor.unit ? " " + sensor.unit : ""}`;
        }

        const dotEl = sensorDotRefs.current[i];
        if (dotEl) {
          dotEl.style.backgroundColor = statusColor;
          dotEl.style.boxShadow =
            sensor.status !== "normal" ? `0 0 6px ${statusColor}` : "none";
        }

        const container = sensorContainerRefs.current[i];
        if (container) {
          if (sensor.status === "critical") {
            container.style.borderColor = "#ef4444";
            container.style.boxShadow = "0 0 8px rgba(239,68,68,0.5)";
          } else if (sensor.status === "warning") {
            container.style.borderColor = "#f59e0b";
            container.style.boxShadow = "0 0 6px rgba(245,158,11,0.3)";
          } else {
            container.style.borderColor = "rgba(100,116,139,0.3)";
            container.style.boxShadow = "none";
          }
        }
      }
    }

    // Sensor-specific animations (lightweight — just emissive/rotation)
    for (
      let i = 0;
      i < stage.sensors.length && i < sensorRefs.current.length;
      i++
    ) {
      const mesh = sensorRefs.current[i];
      if (!mesh) continue;
      const sensor = stage.sensors[i];
      const mat = mesh.material as THREE.MeshStandardMaterial;

      switch (sensor.type) {
        case "ph": {
          const norm = (sensor.value - sensor.min) / (sensor.max - sensor.min);
          const r = Math.abs(norm - 0.5) * 2;
          mat.color.setRGB(r, 1 - r, 0.2);
          mat.emissiveIntensity = sensor.status !== "normal" ? 1.0 : 0.3;
          break;
        }
        case "lidar":
          mesh.rotation.y = t * 3;
          break;
        case "mq_gas": {
          const gasNorm = Math.min(1, sensor.value / sensor.max);
          mat.emissiveIntensity = gasNorm * 1.2;
          break;
        }
        case "pressure": {
          const pNorm = (sensor.value - sensor.min) / (sensor.max - sensor.min);
          mesh.rotation.z = -Math.PI * 0.75 + pNorm * Math.PI * 1.5;
          break;
        }
        case "o2": {
          const o2Norm = Math.min(1, sensor.value / 25);
          mat.color.setRGB(1 - o2Norm, 0.2, o2Norm);
          mat.emissiveIntensity = sensor.status !== "normal" ? 0.6 : 0.2;
          break;
        }
        case "fingerprint": {
          const scanT = (t * 2) % 1;
          mesh.position.y = 0.03 + scanT * 0.04;
          mat.color.set(sensor.value > 0.5 ? "#22c55e" : "#ef4444");
          break;
        }
        case "microwave_motion":
          if (sensor.value > 0.3)
            mat.emissiveIntensity = 0.3 + Math.sin(t * 4) * 0.5;
          else mat.emissiveIntensity = 0.05;
          break;
        case "light_intensity": {
          const luxNorm = Math.min(1, sensor.value / sensor.max);
          mat.emissiveIntensity = luxNorm * 0.8;
          break;
        }
        case "gps":
          mat.emissiveIntensity = Math.sin(t * 6) > 0.5 ? 1.0 : 0.1;
          break;
        case "water":
          mat.emissiveIntensity =
            sensor.value > 0.3 ? 0.5 + Math.sin(t * 4) * 0.4 : 0.05;
          break;
        // ── V2 sensor animations ─────────────────────────
        case "proximity": {
          const detected = sensor.value > 0.5;
          mat.color.set(detected ? "#22c55e" : "#ef4444");
          mat.emissive.set(detected ? "#22c55e" : "#ef4444");
          mat.emissiveIntensity =
            sensor.status !== "normal"
              ? 0.4 + Math.sin(t * 5) * 0.5
              : detected ? 0.8 : 0.2;
          break;
        }
        case "optical": {
          const blocked = sensor.value < 0.5;
          mat.opacity = blocked ? 0.1 : 0.6 + Math.sin(t * 10) * 0.2;
          mat.emissiveIntensity = blocked ? 0.1 : 0.9;
          break;
        }
        case "emergency_stop": {
          const pressed = sensor.value > 0.5;
          mesh.position.y = pressed ? 0.05 : 0.07;
          mat.emissiveIntensity = pressed ? 0.6 + Math.sin(t * 6) * 0.4 : 0.3;
          break;
        }
        case "capacitive_touch":
          mat.emissiveIntensity = sensor.value > 0.5 ? 0.7 : 0.15;
          break;
        case "water_level": {
          const lvlNorm = Math.min(
            1,
            Math.max(0, (sensor.value - sensor.min) / (sensor.max - sensor.min)),
          );
          mesh.scale.y = 0.01 + lvlNorm * 0.99;
          mat.color.set(
            sensor.status === "critical"
              ? "#ef4444"
              : sensor.status === "warning"
              ? "#f59e0b"
              : "#3b82f6",
          );
          mat.emissive.set(
            sensor.status === "critical"
              ? "#ef4444"
              : sensor.status === "warning"
              ? "#f59e0b"
              : "#1d4ed8",
          );
          break;
        }
        case "rfid": {
          const authorized = sensor.value > 0.5;
          const wave = ((t * 2) % 1.5) / 1.5;
          const scale = 0.5 + wave * 1.2;
          mesh.scale.set(scale, 1, scale);
          mat.opacity = authorized ? (1 - wave) * 0.6 : 0.1;
          mat.color.set(authorized ? "#22c55e" : "#ef4444");
          mat.emissive.set(authorized ? "#22c55e" : "#ef4444");
          break;
        }
        case "fire": {
          // Inverted: high value = safe; low value = fire. Flame intensity
          // grows as the reading drops toward zero.
          const dangerLevel = 1 - Math.min(1, sensor.value / sensor.max);
          const flicker =
            1 + Math.sin(t * 9) * 0.15 + Math.sin(t * 17) * 0.08;
          mesh.scale.set(flicker, flicker, flicker);
          mat.emissiveIntensity =
            0.2 + dangerLevel * 1.2 + (sensor.status === "critical" ? 0.5 : 0);
          break;
        }
        case "flow_liquid": {
          const flowNorm = Math.min(1, sensor.value / sensor.max);
          const phase = (t * (0.3 + flowNorm * 1.5)) % 1;
          mesh.position.x = -0.07 + phase * 0.14;
          mat.opacity = flowNorm > 0.05 ? 0.85 : 0.1;
          break;
        }
        case "valve_signal": {
          const vNorm = Math.min(
            1,
            Math.max(0, (sensor.value - sensor.min) / (sensor.max - sensor.min)),
          );
          mesh.rotation.y = vNorm * (Math.PI / 2);
          mat.color.set(
            sensor.status === "critical"
              ? "#ef4444"
              : sensor.status === "warning"
              ? "#f59e0b"
              : "#10b981",
          );
          mat.emissive.set(
            sensor.status === "critical"
              ? "#ef4444"
              : sensor.status === "warning"
              ? "#f59e0b"
              : "#10b981",
          );
          break;
        }
        case "flow_air": {
          const airNorm = Math.min(1, sensor.value / sensor.max);
          const phase = (t * (0.4 + airNorm * 2.0)) % 1;
          mesh.position.x = -0.07 + phase * 0.14;
          mat.opacity = airNorm > 0.05 ? 0.75 : 0.1;
          break;
        }
        default:
          break;
      }
    }

    // Device animations
    for (
      let i = 0;
      i < stage.outputDevices.length && i < deviceRefs.current.length;
      i++
    ) {
      const mesh = deviceRefs.current[i];
      if (!mesh) continue;
      const device = stage.outputDevices[i];
      const mat = mesh.material as THREE.MeshStandardMaterial;

      switch (device.type) {
        case "motor":
          if (device.active && device.rpm)
            mesh.rotation.x += 0.016 * (device.rpm / 60) * Math.PI * 2;
          break;
        case "emergency_light":
          mat.emissiveIntensity = device.active
            ? 0.3 + Math.max(0, Math.sin(t * 6)) * 2
            : 0.05;
          break;
        case "shelly":
          mat.emissiveIntensity = device.active
            ? 0.5 + Math.sin(t * 3) * 0.3
            : 0.05;
          break;
        case "single_phase": {
          const target = device.active ? 0 : Math.PI / 6;
          mesh.rotation.z += (target - mesh.rotation.z) * 0.1;
          break;
        }
        default:
          break;
      }
    }
  });

  // Read initial stage data for building static geometry
  const initStage = useMemo(
    () => useDigitalTwinStore.getState().stages[stageIndex],
    [stageIndex],
  );
  if (!initStage) return null;

  const sensorCount = initStage.sensors.length;
  const deviceCount = initStage.outputDevices.length;
  const stageId = initStage.id as StageId;
  const stageLabel = STAGE_LABELS[stageId] ?? initStage.id;
  const stageConfig = STAGE_CONFIGS.find((c) => c.id === stageId);

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        const stage = useDigitalTwinStore.getState().stages[stageIndex];
        if (stage) onClick(stage);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {/* ── Threshold effects ── */}
      {/* Warning halo — large floor torus */}
      <mesh
        ref={warningHaloRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.44, 0]}
      >
        <torusGeometry args={[1.2, 0.12, 8, 32]} />
        <meshBasicMaterial
          color="#ef4444"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Backdrop glow panel */}
      <mesh ref={backdropRef} position={[0, 0.8, -0.8]}>
        <planeGeometry args={[1.8, 2.5]} />
        <meshBasicMaterial
          color="#ef4444"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Stage area point light for dramatic fault/warning illumination */}
      <pointLight
        ref={stageLightRef}
        position={[0, 2.0, 0]}
        color="#ef4444"
        intensity={0}
        distance={5}
        decay={2}
      />

      {/* Floor status ring */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.45, 0]}
      >
        <torusGeometry args={[0.8, 0.04, 4, 32]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.25} />
      </mesh>

      {/* Stage name label removed for cleaner view */}

      {/* Archway pillars */}
      <mesh position={[-0.5, 0.6, 0]} castShadow>
        <boxGeometry args={[0.06, 1.8, 0.06]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.5, 0.6, 0]} castShadow>
        <boxGeometry args={[0.06, 1.8, 0.06]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Top beam */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[1.1, 0.06, 0.06]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Arch glow strip */}
      <mesh ref={archGlowRef} position={[0, 1.52, 0]}>
        <boxGeometry args={[1.05, 0.02, 0.02]} />
        <meshStandardMaterial
          color="#10b981"
          emissive="#10b981"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Cross braces */}
      <mesh position={[-0.5, 0.0, 0.25]}>
        <boxGeometry args={[0.04, 0.04, 0.5]} />
        <meshStandardMaterial color="#6b7280" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0.5, 0.0, 0.25]}>
        <boxGeometry args={[0.04, 0.04, 0.5]} />
        <meshStandardMaterial color="#6b7280" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Stage-specific PET bottle manufacturing equipment */}
      <StageEquipment3D stageId={stageId} />

      {/* Sensors — static geometry with ref for animation + floating readouts */}
      {Array.from({ length: sensorCount }).map((_, i) => {
        const offset = SENSOR_OFFSETS[i % SENSOR_OFFSETS.length];
        const sensorType = initStage.sensors[i].type;
        const sensorLabel = initStage.sensors[i].label;
        return (
          <group key={`s${i}`} position={offset}>
            {/* Sensor readouts removed for cleaner view */}

            {/* Base mount */}
            <mesh position={[0, -0.08, 0]}>
              <boxGeometry args={[0.12, 0.06, 0.12]} />
              <meshStandardMaterial
                color="#4b5563"
                metalness={0.7}
                roughness={0.3}
              />
            </mesh>
            {/* Status LED */}
            <mesh
              ref={(el) => {
                statusLedRefs.current[i] = el;
              }}
              position={[0, -0.04, 0.07]}
            >
              <sphereGeometry args={[0.02, 6, 6]} />
              <meshStandardMaterial
                color="#10b981"
                emissive="#10b981"
                emissiveIntensity={0.3}
              />
            </mesh>
            {/* Sensor body — type-specific static geometry, animated via ref */}
            {sensorType === "ph" && (
              <>
                <mesh position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
                  <meshStandardMaterial
                    color="#a3a3a3"
                    metalness={0.8}
                    roughness={0.2}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.05, 0]}
                >
                  <torusGeometry args={[0.04, 0.012, 6, 12]} />
                  <meshStandardMaterial
                    color="#22c55e"
                    emissive="#22c55e"
                    emissiveIntensity={0.3}
                    transparent
                    opacity={0.8}
                  />
                </mesh>
              </>
            )}
            {sensorType === "lidar" && (
              <>
                <mesh position={[0, 0.04, 0]}>
                  <cylinderGeometry args={[0.035, 0.035, 0.06, 10]} />
                  <meshStandardMaterial
                    color="#1a1a2e"
                    metalness={0.6}
                    roughness={0.4}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.1, 0]}
                >
                  <cylinderGeometry args={[0.03, 0.035, 0.08, 10]} />
                  <meshStandardMaterial
                    color="#22c55e"
                    emissive="#22c55e"
                    emissiveIntensity={0.4}
                    metalness={0.5}
                    roughness={0.3}
                  />
                </mesh>
              </>
            )}
            {sensorType === "pressure" && (
              <>
                <mesh position={[0, 0.08, 0]}>
                  <torusGeometry args={[0.045, 0.005, 6, 16]} />
                  <meshStandardMaterial
                    color="#9ca3af"
                    metalness={0.9}
                    roughness={0.1}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.08, 0.015]}
                >
                  <boxGeometry args={[0.003, 0.04, 0.003]} />
                  <meshStandardMaterial
                    color="#ef4444"
                    emissive="#ef4444"
                    emissiveIntensity={0.5}
                  />
                </mesh>
              </>
            )}
            {sensorType === "mq_gas" && (
              <>
                <mesh position={[0, 0.06, 0]}>
                  <cylinderGeometry args={[0.03, 0.03, 0.1, 8]} />
                  <meshStandardMaterial
                    color="#4b5563"
                    metalness={0.5}
                    roughness={0.4}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.12, 0]}
                >
                  <cylinderGeometry args={[0.032, 0.032, 0.02, 8]} />
                  <meshStandardMaterial
                    color="#f97316"
                    emissive="#ea580c"
                    emissiveIntensity={0.2}
                    metalness={0.3}
                    roughness={0.7}
                  />
                </mesh>
              </>
            )}
            {sensorType === "o2" && (
              <>
                <mesh position={[0, 0.02, 0]}>
                  <cylinderGeometry args={[0.04, 0.04, 0.04, 10]} />
                  <meshStandardMaterial
                    color="#4b5563"
                    metalness={0.7}
                    roughness={0.3}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.06, 0]}
                >
                  <sphereGeometry
                    args={[0.04, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2]}
                  />
                  <meshStandardMaterial
                    color="#3b82f6"
                    emissive="#1d4ed8"
                    emissiveIntensity={0.2}
                  />
                </mesh>
              </>
            )}
            {sensorType === "microwave_motion" && (
              <mesh
                ref={(el) => {
                  sensorRefs.current[i] = el;
                }}
                position={[0, 0.08, 0]}
                rotation={[0.3, 0, 0]}
              >
                <coneGeometry args={[0.05, 0.04, 12, 1, true]} />
                <meshStandardMaterial
                  color="#06b6d4"
                  emissive="#06b6d4"
                  emissiveIntensity={0.05}
                  side={2}
                  metalness={0.6}
                  roughness={0.3}
                />
              </mesh>
            )}
            {sensorType === "turbidity" && (
              <mesh
                ref={(el) => {
                  sensorRefs.current[i] = el;
                }}
                position={[0, 0.1, 0]}
              >
                <cylinderGeometry args={[0.03, 0.03, 0.18, 8]} />
                <meshStandardMaterial
                  color="#d4a574"
                  emissive="#a3651a"
                  emissiveIntensity={0.1}
                  transparent
                  opacity={0.4}
                />
              </mesh>
            )}
            {sensorType === "light_intensity" && (
              <mesh
                ref={(el) => {
                  sensorRefs.current[i] = el;
                }}
                position={[0, 0.06, 0]}
              >
                <boxGeometry args={[0.07, 0.07, 0.015]} />
                <meshStandardMaterial
                  color="#fbbf24"
                  emissive="#fbbf24"
                  emissiveIntensity={0.3}
                />
              </mesh>
            )}
            {sensorType === "gps" && (
              <>
                <mesh position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
                  <meshStandardMaterial
                    color="#9ca3af"
                    metalness={0.8}
                    roughness={0.2}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.2, 0]}
                >
                  <sphereGeometry args={[0.02, 8, 8]} />
                  <meshStandardMaterial
                    color="#06b6d4"
                    emissive="#06b6d4"
                    emissiveIntensity={0.5}
                  />
                </mesh>
              </>
            )}
            {sensorType === "orp" && (
              <mesh
                ref={(el) => {
                  sensorRefs.current[i] = el;
                }}
                position={[0, 0.06, 0]}
              >
                <cylinderGeometry args={[0.015, 0.012, 0.16, 8]} />
                <meshStandardMaterial
                  color="#a78bfa"
                  emissive="#7c3aed"
                  emissiveIntensity={0.2}
                  metalness={0.7}
                  roughness={0.3}
                />
              </mesh>
            )}
            {sensorType === "water" && (
              <mesh
                ref={(el) => {
                  sensorRefs.current[i] = el;
                }}
                position={[0, 0.04, 0]}
              >
                <boxGeometry args={[0.09, 0.02, 0.09]} />
                <meshStandardMaterial
                  color="#3b82f6"
                  emissive="#1d4ed8"
                  emissiveIntensity={0.05}
                />
              </mesh>
            )}
            {sensorType === "fingerprint" && (
              <>
                <mesh position={[0, 0.04, 0]}>
                  <boxGeometry args={[0.06, 0.01, 0.08]} />
                  <meshStandardMaterial
                    color="#1a1a2e"
                    metalness={0.3}
                    roughness={0.7}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.05, 0]}
                >
                  <boxGeometry args={[0.05, 0.002, 0.002]} />
                  <meshStandardMaterial
                    color="#22c55e"
                    emissive="#22c55e"
                    emissiveIntensity={0.6}
                  />
                </mesh>
              </>
            )}
            {/* ── V2 sensor types ─────────────────────────── */}
            {sensorType === "proximity" && (
              <>
                <mesh position={[0, 0.08, 0]}>
                  <cylinderGeometry args={[0.025, 0.025, 0.12, 10]} />
                  <meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.2} />
                </mesh>
                <mesh position={[0, 0.14, 0]}>
                  <cylinderGeometry args={[0.025, 0.025, 0.01, 10]} />
                  <meshStandardMaterial color="#1f2937" metalness={0.4} roughness={0.6} />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.03, 0.025]}
                >
                  <sphereGeometry args={[0.008, 6, 6]} />
                  <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.2} />
                </mesh>
              </>
            )}
            {sensorType === "optical" && (
              <>
                <mesh position={[-0.06, 0.06, 0]}>
                  <boxGeometry args={[0.03, 0.04, 0.03]} />
                  <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
                </mesh>
                <mesh position={[0.06, 0.06, 0]}>
                  <boxGeometry args={[0.03, 0.04, 0.03]} />
                  <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.06, 0]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.003, 0.003, 0.12, 4]} />
                  <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} transparent opacity={0.6} />
                </mesh>
              </>
            )}
            {sensorType === "emergency_stop" && (
              <>
                <mesh position={[0, 0.02, 0]}>
                  <cylinderGeometry args={[0.05, 0.055, 0.04, 16]} />
                  <meshStandardMaterial color="#facc15" metalness={0.3} roughness={0.6} />
                </mesh>
                <mesh position={[0, 0.085, 0]}>
                  <sphereGeometry args={[0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshStandardMaterial color="#dc2626" metalness={0.2} roughness={0.4} />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.07, 0]}
                >
                  <cylinderGeometry args={[0.04, 0.04, 0.02, 16]} />
                  <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} metalness={0.2} roughness={0.4} />
                </mesh>
              </>
            )}
            {sensorType === "capacitive_touch" && (
              <>
                <mesh position={[0, 0.015, 0]}>
                  <boxGeometry args={[0.09, 0.01, 0.09]} />
                  <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.025, 0]}
                >
                  <boxGeometry args={[0.07, 0.005, 0.07]} />
                  <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.15} metalness={0.6} roughness={0.3} />
                </mesh>
              </>
            )}
            {sensorType === "water_level" && (
              <>
                <mesh position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.035, 0.035, 0.18, 12, 1, true]} />
                  <meshStandardMaterial color="#e5e7eb" transparent opacity={0.25} side={2} />
                </mesh>
                <mesh position={[0, 0.195, 0]}>
                  <cylinderGeometry args={[0.04, 0.04, 0.01, 12]} />
                  <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.1, 0]}
                >
                  <cylinderGeometry args={[0.03, 0.03, 0.16, 12]} />
                  <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.4} transparent opacity={0.8} />
                </mesh>
              </>
            )}
            {sensorType === "rfid" && (
              <>
                <mesh position={[0, 0.02, 0]}>
                  <boxGeometry args={[0.1, 0.015, 0.08]} />
                  <meshStandardMaterial color="#1e3a8a" metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.038, 0]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <ringGeometry args={[0.025, 0.03, 18]} />
                  <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.6} transparent opacity={0.5} side={2} />
                </mesh>
              </>
            )}
            {sensorType === "fire" && (
              <>
                <mesh position={[0, 0.04, 0]}>
                  <cylinderGeometry args={[0.04, 0.045, 0.04, 12]} />
                  <meshStandardMaterial color="#7f1d1d" metalness={0.4} roughness={0.5} />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.1, 0]}
                >
                  <coneGeometry args={[0.025, 0.08, 10]} />
                  <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={0.3} transparent opacity={0.85} />
                </mesh>
              </>
            )}
            {sensorType === "flow_liquid" && (
              <>
                <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.02, 0.02, 0.16, 10, 1, true]} />
                  <meshStandardMaterial color="#94a3b8" transparent opacity={0.35} side={2} />
                </mesh>
                <mesh position={[-0.08, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.025, 0.025, 0.02, 10]} />
                  <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh position={[0.08, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.025, 0.025, 0.02, 10]} />
                  <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.06, 0]}
                >
                  <sphereGeometry args={[0.008, 6, 6]} />
                  <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.6} transparent opacity={0.85} />
                </mesh>
              </>
            )}
            {sensorType === "valve_signal" && (
              <>
                <mesh position={[0, 0.05, 0]}>
                  <cylinderGeometry args={[0.04, 0.04, 0.04, 12]} />
                  <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.085, 0]}>
                  <cylinderGeometry args={[0.006, 0.006, 0.03, 6]} />
                  <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.105, 0]}
                >
                  <boxGeometry args={[0.09, 0.008, 0.015]} />
                  <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.4} metalness={0.4} roughness={0.4} />
                </mesh>
              </>
            )}
            {sensorType === "flow_air" && (
              <>
                <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.022, 0.022, 0.16, 10, 1, true]} />
                  <meshStandardMaterial color="#cbd5e1" transparent opacity={0.3} side={2} />
                </mesh>
                <mesh position={[-0.08, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.027, 0.027, 0.02, 10]} />
                  <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh position={[0.08, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.027, 0.027, 0.02, 10]} />
                  <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh
                  ref={(el) => {
                    sensorRefs.current[i] = el;
                  }}
                  position={[0, 0.06, 0]}
                >
                  <sphereGeometry args={[0.007, 6, 6]} />
                  <meshStandardMaterial color="#f1f5f9" emissive="#e2e8f0" emissiveIntensity={0.4} transparent opacity={0.7} />
                </mesh>
              </>
            )}
          </group>
        );
      })}

      {/* Output Devices — static geometry with ref for animation */}
      {Array.from({ length: deviceCount }).map((_, i) => {
        const offset = DEVICE_OFFSETS[i % DEVICE_OFFSETS.length];
        const deviceType = initStage.outputDevices[i].type;
        return (
          <group key={`d${i}`} position={offset}>
            {deviceType === "motor" && (
              <>
                <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.04, 0.04, 0.1, 10]} />
                  <meshStandardMaterial
                    color="#4b5563"
                    metalness={0.7}
                    roughness={0.3}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    deviceRefs.current[i] = el;
                  }}
                  position={[0.08, 0.06, 0]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.01, 0.01, 0.06, 6]} />
                  <meshStandardMaterial
                    color="#d4d4d8"
                    metalness={0.9}
                    roughness={0.1}
                  />
                </mesh>
              </>
            )}
            {deviceType === "emergency_light" && (
              <>
                <mesh position={[0, 0.12, 0]}>
                  <cylinderGeometry args={[0.01, 0.01, 0.2, 6]} />
                  <meshStandardMaterial
                    color="#4b5563"
                    metalness={0.7}
                    roughness={0.3}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    deviceRefs.current[i] = el;
                  }}
                  position={[0, 0.24, 0]}
                >
                  <sphereGeometry args={[0.035, 10, 10]} />
                  <meshStandardMaterial
                    color="#ef4444"
                    emissive="#ef4444"
                    emissiveIntensity={0.05}
                    transparent
                    opacity={0.9}
                  />
                </mesh>
              </>
            )}
            {deviceType === "shelly" && (
              <>
                <mesh position={[0, 0.04, 0]}>
                  <boxGeometry args={[0.08, 0.05, 0.06]} />
                  <meshStandardMaterial
                    color="#e2e8f0"
                    metalness={0.3}
                    roughness={0.6}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    deviceRefs.current[i] = el;
                  }}
                  position={[0, 0.07, 0.03]}
                >
                  <sphereGeometry args={[0.01, 6, 6]} />
                  <meshStandardMaterial
                    color="#3b82f6"
                    emissive="#3b82f6"
                    emissiveIntensity={0.3}
                  />
                </mesh>
              </>
            )}
            {deviceType === "switch_4ep" && (
              <group>
                <mesh position={[0, 0.06, 0]}>
                  <boxGeometry args={[0.14, 0.1, 0.04]} />
                  <meshStandardMaterial
                    color="#374151"
                    metalness={0.6}
                    roughness={0.4}
                  />
                </mesh>
                {[0, 1, 2, 3].map((j) => (
                  <mesh key={j} position={[-0.04 + j * 0.027, 0.08, 0.025]}>
                    <sphereGeometry args={[0.01, 6, 6]} />
                    <meshStandardMaterial
                      color="#22c55e"
                      emissive="#22c55e"
                      emissiveIntensity={0.6}
                    />
                  </mesh>
                ))}
              </group>
            )}
            {deviceType === "single_phase" && (
              <>
                <mesh position={[0, 0.06, 0]}>
                  <boxGeometry args={[0.1, 0.12, 0.03]} />
                  <meshStandardMaterial
                    color="#4b5563"
                    metalness={0.5}
                    roughness={0.4}
                  />
                </mesh>
                <mesh
                  ref={(el) => {
                    deviceRefs.current[i] = el;
                  }}
                  position={[0, 0.08, 0.02]}
                >
                  <boxGeometry args={[0.03, 0.05, 0.015]} />
                  <meshStandardMaterial
                    color="#22c55e"
                    emissive="#22c55e"
                    emissiveIntensity={0.3}
                  />
                </mesh>
              </>
            )}
            {deviceType === "power_meter" && (
              <mesh position={[0, 0.06, 0]}>
                <boxGeometry args={[0.1, 0.08, 0.03]} />
                <meshStandardMaterial
                  color="#1a1a2e"
                  metalness={0.4}
                  roughness={0.6}
                  emissive="#22c55e"
                  emissiveIntensity={0.1}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
};

export default ManufacturingStage3D;
