"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SENSOR_OFFSETS, DEVICE_OFFSETS, STAGE_STATUS_COLORS } from "./digitalTwinLayout";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import type { ManufacturingStage } from "../../types/digitalTwin";

interface ManufacturingStage3DProps {
  stageIndex: number;
  onClick: (stage: ManufacturingStage) => void;
}

/**
 * ManufacturingStage3D — Performance-optimized
 *
 * ONE useFrame for the entire stage (sensors + devices + status).
 * Reads store via getState() — zero React re-renders from simulation.
 * No Html overlays — uses emissive meshes for status indication.
 * Sensor/device animations are inline, not separate components.
 */
const ManufacturingStage3D: React.FC<ManufacturingStage3DProps> = ({ stageIndex, onClick }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const archGlowRef = useRef<THREE.Mesh>(null);
  const sensorRefs = useRef<(THREE.Mesh | null)[]>([]);
  const deviceRefs = useRef<(THREE.Mesh | null)[]>([]);
  const statusLedRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Read initial position (stable — never changes)
  const position = useMemo(() => {
    const stages = useDigitalTwinStore.getState().stages;
    return stages[stageIndex]?.position ?? [0, 0, 0] as [number, number, number];
  }, [stageIndex]);

  // Single useFrame for ALL animations in this stage
  useFrame(({ clock }) => {
    const stage = useDigitalTwinStore.getState().stages[stageIndex];
    if (!stage) return;

    const t = clock.elapsedTime;
    const statusConfig = STAGE_STATUS_COLORS[stage.status] ?? STAGE_STATUS_COLORS.idle;

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

    // Sensor LEDs — update color based on sensor status
    for (let i = 0; i < stage.sensors.length && i < statusLedRefs.current.length; i++) {
      const led = statusLedRefs.current[i];
      if (!led) continue;
      const sensor = stage.sensors[i];
      const color = sensor.status === "critical" ? "#ef4444" : sensor.status === "warning" ? "#f59e0b" : "#10b981";
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

    // Sensor-specific animations (lightweight — just emissive/rotation)
    for (let i = 0; i < stage.sensors.length && i < sensorRefs.current.length; i++) {
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
          if (sensor.value > 0.3) mat.emissiveIntensity = 0.3 + Math.sin(t * 4) * 0.5;
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
          mat.emissiveIntensity = sensor.value > 0.3 ? 0.5 + Math.sin(t * 4) * 0.4 : 0.05;
          break;
        default:
          break;
      }
    }

    // Device animations
    for (let i = 0; i < stage.outputDevices.length && i < deviceRefs.current.length; i++) {
      const mesh = deviceRefs.current[i];
      if (!mesh) continue;
      const device = stage.outputDevices[i];
      const mat = mesh.material as THREE.MeshStandardMaterial;

      switch (device.type) {
        case "motor":
          if (device.active && device.rpm) mesh.rotation.x += 0.016 * (device.rpm / 60) * Math.PI * 2;
          break;
        case "emergency_light":
          mat.emissiveIntensity = device.active ? (0.3 + Math.max(0, Math.sin(t * 6)) * 2) : 0.05;
          break;
        case "shelly":
          mat.emissiveIntensity = device.active ? 0.5 + Math.sin(t * 3) * 0.3 : 0.05;
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
  const initStage = useMemo(() => useDigitalTwinStore.getState().stages[stageIndex], [stageIndex]);
  if (!initStage) return null;

  const sensorCount = initStage.sensors.length;
  const deviceCount = initStage.outputDevices.length;

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        const stage = useDigitalTwinStore.getState().stages[stageIndex];
        if (stage) onClick(stage);
      }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      {/* Floor status ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
        <torusGeometry args={[0.8, 0.04, 4, 32]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.25} />
      </mesh>

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
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.3} />
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

      {/* Sensors — static geometry with ref for animation */}
      {Array.from({ length: sensorCount }).map((_, i) => {
        const offset = SENSOR_OFFSETS[i % SENSOR_OFFSETS.length];
        const sensorType = initStage.sensors[i].type;
        return (
          <group key={`s${i}`} position={offset}>
            {/* Base mount */}
            <mesh position={[0, -0.08, 0]}>
              <boxGeometry args={[0.12, 0.06, 0.12]} />
              <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Status LED */}
            <mesh ref={(el) => { statusLedRefs.current[i] = el; }} position={[0, -0.04, 0.07]}>
              <sphereGeometry args={[0.02, 6, 6]} />
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.3} />
            </mesh>
            {/* Sensor body — type-specific static geometry, animated via ref */}
            {sensorType === "ph" && (
              <>
                <mesh position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
                  <meshStandardMaterial color="#a3a3a3" metalness={0.8} roughness={0.2} />
                </mesh>
                <mesh ref={(el) => { sensorRefs.current[i] = el; }} position={[0, 0.05, 0]}>
                  <torusGeometry args={[0.04, 0.012, 6, 12]} />
                  <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.3} transparent opacity={0.8} />
                </mesh>
              </>
            )}
            {sensorType === "lidar" && (
              <>
                <mesh position={[0, 0.04, 0]}>
                  <cylinderGeometry args={[0.035, 0.035, 0.06, 10]} />
                  <meshStandardMaterial color="#1a1a2e" metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh ref={(el) => { sensorRefs.current[i] = el; }} position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.03, 0.035, 0.08, 10]} />
                  <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.4} metalness={0.5} roughness={0.3} />
                </mesh>
              </>
            )}
            {sensorType === "pressure" && (
              <>
                <mesh position={[0, 0.08, 0]}>
                  <torusGeometry args={[0.045, 0.005, 6, 16]} />
                  <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.1} />
                </mesh>
                <mesh ref={(el) => { sensorRefs.current[i] = el; }} position={[0, 0.08, 0.015]}>
                  <boxGeometry args={[0.003, 0.04, 0.003]} />
                  <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
                </mesh>
              </>
            )}
            {sensorType === "mq_gas" && (
              <>
                <mesh position={[0, 0.06, 0]}>
                  <cylinderGeometry args={[0.03, 0.03, 0.1, 8]} />
                  <meshStandardMaterial color="#4b5563" metalness={0.5} roughness={0.4} />
                </mesh>
                <mesh ref={(el) => { sensorRefs.current[i] = el; }} position={[0, 0.12, 0]}>
                  <cylinderGeometry args={[0.032, 0.032, 0.02, 8]} />
                  <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={0.2} metalness={0.3} roughness={0.7} />
                </mesh>
              </>
            )}
            {sensorType === "o2" && (
              <>
                <mesh position={[0, 0.02, 0]}>
                  <cylinderGeometry args={[0.04, 0.04, 0.04, 10]} />
                  <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh ref={(el) => { sensorRefs.current[i] = el; }} position={[0, 0.06, 0]}>
                  <sphereGeometry args={[0.04, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.2} />
                </mesh>
              </>
            )}
            {sensorType === "microwave_motion" && (
              <mesh ref={(el) => { sensorRefs.current[i] = el; }} position={[0, 0.08, 0]} rotation={[0.3, 0, 0]}>
                <coneGeometry args={[0.05, 0.04, 12, 1, true]} />
                <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.05} side={2} metalness={0.6} roughness={0.3} />
              </mesh>
            )}
            {sensorType === "turbidity" && (
              <mesh ref={(el) => { sensorRefs.current[i] = el; }} position={[0, 0.1, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.18, 8]} />
                <meshStandardMaterial color="#d4a574" emissive="#a3651a" emissiveIntensity={0.1} transparent opacity={0.4} />
              </mesh>
            )}
            {sensorType === "light_intensity" && (
              <mesh ref={(el) => { sensorRefs.current[i] = el; }} position={[0, 0.06, 0]}>
                <boxGeometry args={[0.07, 0.07, 0.015]} />
                <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} />
              </mesh>
            )}
            {sensorType === "gps" && (
              <>
                <mesh position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
                  <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
                </mesh>
                <mesh ref={(el) => { sensorRefs.current[i] = el; }} position={[0, 0.2, 0]}>
                  <sphereGeometry args={[0.02, 8, 8]} />
                  <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.5} />
                </mesh>
              </>
            )}
            {sensorType === "orp" && (
              <mesh ref={(el) => { sensorRefs.current[i] = el; }} position={[0, 0.06, 0]}>
                <cylinderGeometry args={[0.015, 0.012, 0.16, 8]} />
                <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={0.2} metalness={0.7} roughness={0.3} />
              </mesh>
            )}
            {sensorType === "water" && (
              <mesh ref={(el) => { sensorRefs.current[i] = el; }} position={[0, 0.04, 0]}>
                <boxGeometry args={[0.09, 0.02, 0.09]} />
                <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.05} />
              </mesh>
            )}
            {sensorType === "fingerprint" && (
              <>
                <mesh position={[0, 0.04, 0]}>
                  <boxGeometry args={[0.06, 0.01, 0.08]} />
                  <meshStandardMaterial color="#1a1a2e" metalness={0.3} roughness={0.7} />
                </mesh>
                <mesh ref={(el) => { sensorRefs.current[i] = el; }} position={[0, 0.05, 0]}>
                  <boxGeometry args={[0.05, 0.002, 0.002]} />
                  <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.6} />
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
                  <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh ref={(el) => { deviceRefs.current[i] = el; }} position={[0.08, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.01, 0.01, 0.06, 6]} />
                  <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.1} />
                </mesh>
              </>
            )}
            {deviceType === "emergency_light" && (
              <>
                <mesh position={[0, 0.12, 0]}>
                  <cylinderGeometry args={[0.01, 0.01, 0.2, 6]} />
                  <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh ref={(el) => { deviceRefs.current[i] = el; }} position={[0, 0.24, 0]}>
                  <sphereGeometry args={[0.035, 10, 10]} />
                  <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.05} transparent opacity={0.9} />
                </mesh>
              </>
            )}
            {deviceType === "shelly" && (
              <>
                <mesh position={[0, 0.04, 0]}>
                  <boxGeometry args={[0.08, 0.05, 0.06]} />
                  <meshStandardMaterial color="#e2e8f0" metalness={0.3} roughness={0.6} />
                </mesh>
                <mesh ref={(el) => { deviceRefs.current[i] = el; }} position={[0, 0.07, 0.03]}>
                  <sphereGeometry args={[0.01, 6, 6]} />
                  <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.3} />
                </mesh>
              </>
            )}
            {deviceType === "switch_4ep" && (
              <group>
                <mesh position={[0, 0.06, 0]}>
                  <boxGeometry args={[0.14, 0.1, 0.04]} />
                  <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.4} />
                </mesh>
                {[0, 1, 2, 3].map((j) => (
                  <mesh key={j} position={[-0.04 + j * 0.027, 0.08, 0.025]}>
                    <sphereGeometry args={[0.01, 6, 6]} />
                    <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.6} />
                  </mesh>
                ))}
              </group>
            )}
            {deviceType === "single_phase" && (
              <>
                <mesh position={[0, 0.06, 0]}>
                  <boxGeometry args={[0.1, 0.12, 0.03]} />
                  <meshStandardMaterial color="#4b5563" metalness={0.5} roughness={0.4} />
                </mesh>
                <mesh ref={(el) => { deviceRefs.current[i] = el; }} position={[0, 0.08, 0.02]}>
                  <boxGeometry args={[0.03, 0.05, 0.015]} />
                  <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.3} />
                </mesh>
              </>
            )}
            {deviceType === "power_meter" && (
              <mesh position={[0, 0.06, 0]}>
                <boxGeometry args={[0.1, 0.08, 0.03]} />
                <meshStandardMaterial color="#1a1a2e" metalness={0.4} roughness={0.6} emissive="#22c55e" emissiveIntensity={0.1} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
};

export default ManufacturingStage3D;
