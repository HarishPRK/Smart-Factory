"use no memo";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ManufacturingStage } from "../../types/digitalTwin";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";

interface ControlBoard3DProps {
  stage: ManufacturingStage;
  position: [number, number, number];
  visible?: boolean;
}

const ControlBoard3D: React.FC<ControlBoard3DProps> = ({
  stage: stageProp,
  position,
  visible = false,
}) => {
  const screenRef = useRef<THREE.Mesh>(null);

  // Subscribe to the digital-twin tick (500ms) so the board reflects live
  // sensor values streaming in from the PLC feed. The simulation mutates the
  // stage object in place, so without a tick-triggered re-render React keeps
  // showing whatever values were present at initial mount.
  const tick = useDigitalTwinStore((s) => s.tick);
  // Always pull the latest mutable stage reference by id, so live PLC values
  // (e.g. forming_pressure) propagate immediately.
  const liveStage = useDigitalTwinStore
    .getState()
    .stages.find((s) => s.id === stageProp.id);
  const stage = liveStage ?? stageProp;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  tick;

  // Scene-wide "focused machine" selection. When this stage is the focused
  // one, the banner renders larger with a highlighted border + glow; when
  // another stage is focused, this one dims so the eye is drawn to the
  // selected machine's banner.
  const selectedStageId = useSceneSelectionStore((s) => s.selectedStageId);
  const isSelected = selectedStageId === stage.id;
  const anySelected = selectedStageId != null;

  useFrame(({ clock }) => {
    if (!screenRef.current) return;
    const mat = screenRef.current.material as THREE.MeshStandardMaterial;
    if (stage.status === "running") {
      mat.emissiveIntensity = 0.15 + Math.sin(clock.elapsedTime * 0.5) * 0.05;
    } else if (stage.status === "faulted") {
      mat.emissiveIntensity = 0.3 + Math.sin(clock.elapsedTime * 4) * 0.2;
    } else {
      mat.emissiveIntensity = 0.1;
    }
  });

  const statusColor =
    stage.status === "running"
      ? "#10b981"
      : stage.status === "faulted"
        ? "#ef4444"
        : stage.status === "warning"
          ? "#f59e0b"
          : "#64748b";

  return (
    <group position={position}>
      {/* Two support poles going into the ground */}
      <mesh position={[-0.18, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.7, 6]} />
        <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.18, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.7, 6]} />
        <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Billboard board at top of poles */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[0.5, 0.35, 0.02]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Screen surface */}
      <mesh ref={screenRef} position={[0, 0.72, 0.011]}>
        <planeGeometry args={[0.48, 0.33]} />
        <meshStandardMaterial
          color="#0f172a"
          emissive="#1e40af"
          emissiveIntensity={0.1}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {/* Display content — only mount heavy DOM overlays for the selected stage.
          `transform` was removed: drei's transform mode runs a full CSS 3D
          projection + DOM reflow every frame for every <Html>, and with 7
          stage boards mounted simultaneously that was ~8 ms/frame of pure
          perf cost. Screen-space mode (default) keeps the overlays readable,
          still uses `distanceFactor` for scale, and barely costs anything. */}
      {visible && (
        <Html
          position={[0, 0.72, 0.015]}
          center
          distanceFactor={isSelected ? 1.4 : 2.5}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              width: isSelected ? "260px" : "150px",
              background: isSelected ? "#0b1a2e" : "#0a1628",
              border: `${isSelected ? "2px" : "1px"} solid ${statusColor}`,
              borderRadius: isSelected ? "10px" : "6px",
              padding: isSelected ? "14px" : "8px",
              fontFamily: "'Inter', system-ui",
              fontSize: isSelected ? "13px" : "9px",
              opacity: anySelected && !isSelected ? 0.3 : 1,
              boxShadow: isSelected
                ? `0 0 18px ${statusColor}, 0 8px 24px rgba(0,0,0,0.55)`
                : "none",
              transition:
                "opacity 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                color: "#e2e8f0",
                fontSize: isSelected ? "15px" : "10px",
                marginBottom: isSelected ? "8px" : "4px",
                letterSpacing: isSelected ? "0.02em" : "0",
              }}
            >
              {stage.label}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                marginBottom: "6px",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: statusColor,
                  boxShadow: `0 0 4px ${statusColor}`,
                }}
              />
              <span
                style={{
                  color: statusColor,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: "8px",
                }}
              >
                {stage.status}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  color: "#94a3b8",
                  fontSize: "8px",
                }}
              >
                Q: {stage.qualityScore}%
              </span>
            </div>
            {stage.sensors.map((s) => (
              <div
                key={s.sensorId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "2px 0",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                <span style={{ color: "#94a3b8" }}>{s.label}</span>
                <span
                  style={{
                    color:
                      s.status === "critical"
                        ? "#ef4444"
                        : s.status === "warning"
                          ? "#f59e0b"
                          : "#10b981",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {s.value.toFixed(1)} {s.unit}
                </span>
              </div>
            ))}
            {stage.outputDevices.map((d) => (
              <div
                key={d.deviceId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "2px 0",
                }}
              >
                <span style={{ color: "#94a3b8" }}>{d.label}</span>
                <span
                  style={{
                    color: d.active ? "#10b981" : "#ef4444",
                    fontWeight: 700,
                  }}
                >
                  {d.active ? (d.rpm ? `${d.rpm} RPM` : "ON") : "OFF"}
                </span>
              </div>
            ))}
            {isSelected && (
              <div
                style={{
                  marginTop: "10px",
                  paddingTop: "8px",
                  borderTop: "1px dashed rgba(148, 163, 184, 0.3)",
                  fontSize: "10px",
                  color: "#64748b",
                  textAlign: "center",
                  letterSpacing: "0.08em",
                }}
              >
                Click machine again or press ESC to exit
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

export default ControlBoard3D;
