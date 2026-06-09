"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import type { StageId } from "../../types/digitalTwin";

/**
 * EmergencyResponse3D — Animated emergency workers + vehicles
 *
 * When a stage status is "faulted" or "warning":
 *  - A response worker runs from the standby area to the affected stage
 *  - A flashing warning light appears at the stage
 *  - Status text floats above the responder
 *
 * When the fault clears, the worker walks back to standby.
 * Uses a single useFrame for all responders.
 */

const STANDBY_POS: [number, number, number] = [11, 0, 3]; // Safety office — clear of tanks and trucks

interface Responder {
  id: string;
  targetStageId: StageId | null;
  position: THREE.Vector3;
  state: "standby" | "running_to" | "inspecting" | "returning";
  stateTimer: number;
  label: string;
  color: string;
}

const RESPONDERS: { id: string; label: string; color: string; standbyOffset: [number, number, number] }[] = [
  { id: "resp1", label: "EHS Officer — Tom Bradley", color: "#ef4444", standbyOffset: [0, 0, 0] },
  { id: "resp2", label: "Maintenance — Jake Wilson", color: "#f59e0b", standbyOffset: [1.2, 0, 0] },
  { id: "resp3", label: "Shift Lead — Maria Santos", color: "#3b82f6", standbyOffset: [0, 0, 1.2] },
];

const STAGE_IDS: StageId[] = ["intake", "mixing", "forming", "curing", "quality", "packaging", "dispatch"];

const EmergencyResponse3D: React.FC = () => {
  const respondersRef = useRef<Responder[]>(
    RESPONDERS.map((r) => ({
      id: r.id,
      targetStageId: null,
      position: new THREE.Vector3(
        STANDBY_POS[0] + r.standbyOffset[0],
        STANDBY_POS[1] + r.standbyOffset[1],
        STANDBY_POS[2] + r.standbyOffset[2],
      ),
      state: "standby",
      stateTimer: 0,
      label: r.label,
      color: r.color,
    }))
  );

  // Mesh refs for each responder (body group)
  const meshRefs = useRef<(THREE.Group | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sirenRefs = useRef<(THREE.Mesh | null)[]>([]);
  const legRefs = useRef<(THREE.Group | null)[]>([]);

  const tempTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const stages = useDigitalTwinStore.getState().stages;

    // Find faulted/warning stages
    const faultedStages: StageId[] = [];
    for (const stage of stages) {
      if (stage.status === "faulted" || stage.status === "warning") {
        faultedStages.push(stage.id as StageId);
      }
    }

    // Assign responders to faults
    for (let i = 0; i < respondersRef.current.length; i++) {
      const resp = respondersRef.current[i];
      const config = RESPONDERS[i];

      const standby = new THREE.Vector3(
        STANDBY_POS[0] + config.standbyOffset[0],
        STANDBY_POS[1] + config.standbyOffset[1],
        STANDBY_POS[2] + config.standbyOffset[2],
      );

      // Check if assigned fault is still active
      if (resp.targetStageId && !faultedStages.includes(resp.targetStageId)) {
        // Fault cleared — return to standby
        if (resp.state !== "returning" && resp.state !== "standby") {
          resp.state = "returning";
          resp.stateTimer = 0;
        }
      }

      // Assign unassigned responders to unhandled faults
      if (resp.state === "standby" && faultedStages.length > 0) {
        // Find a fault not already assigned to another responder
        const assignedFaults = respondersRef.current
          .filter((r) => r.targetStageId && r.state !== "standby" && r.state !== "returning")
          .map((r) => r.targetStageId);
        const unhandled = faultedStages.find((f) => !assignedFaults.includes(f));
        if (unhandled) {
          resp.targetStageId = unhandled;
          resp.state = "running_to";
          resp.stateTimer = 0;
        }
      }

      // State machine
      const speed = 3.5; // units per second
      resp.stateTimer += delta;

      switch (resp.state) {
        case "running_to": {
          if (!resp.targetStageId) break;
          const stagePos = STAGE_POSITIONS[resp.targetStageId];
          // Target is offset from stage (don't stand on the conveyor)
          tempTarget.set(stagePos[0] + 1.0, 0, stagePos[2] + 1.5);
          const dir = tempTarget.clone().sub(resp.position);
          const dist = dir.length();
          if (dist < 0.2) {
            resp.state = "inspecting";
            resp.stateTimer = 0;
          } else {
            dir.normalize().multiplyScalar(speed * delta);
            resp.position.add(dir);
          }
          break;
        }
        case "inspecting": {
          // Stay for a while (inspection), then keep checking if fault persists
          // The fault clearing triggers "returning" above
          break;
        }
        case "returning": {
          tempTarget.copy(standby);
          const dir = tempTarget.clone().sub(resp.position);
          const dist = dir.length();
          if (dist < 0.2) {
            resp.state = "standby";
            resp.targetStageId = null;
            resp.position.copy(standby);
          } else {
            dir.normalize().multiplyScalar(speed * delta);
            resp.position.add(dir);
          }
          break;
        }
        default:
          break;
      }

      // Update mesh position
      const group = meshRefs.current[i];
      if (group) {
        group.position.copy(resp.position);

        // Face movement direction
        if (resp.state === "running_to" || resp.state === "returning") {
          const target = resp.state === "running_to" && resp.targetStageId
            ? STAGE_POSITIONS[resp.targetStageId]
            : [standby.x, standby.y, standby.z];
          const angle = Math.atan2(
            (target as number[])[0] - resp.position.x,
            (target as number[])[2] - resp.position.z,
          );
          group.rotation.y = angle;
        }
      }

      // Animate legs (running motion)
      const legs = legRefs.current[i];
      if (legs && (resp.state === "running_to" || resp.state === "returning")) {
        const swing = Math.sin(t * 12) * 0.6;
        if (legs.children[0]) legs.children[0].rotation.x = swing;
        if (legs.children[1]) legs.children[1].rotation.x = -swing;
      } else if (legs) {
        if (legs.children[0]) legs.children[0].rotation.x = 0;
        if (legs.children[1]) legs.children[1].rotation.x = 0;
      }

      // Siren flash
      const siren = sirenRefs.current[i];
      if (siren) {
        const mat = siren.material as THREE.MeshStandardMaterial;
        if (resp.state === "running_to" || resp.state === "inspecting") {
          mat.emissiveIntensity = Math.sin(t * 8) > 0 ? 1.5 : 0.1;
        } else {
          mat.emissiveIntensity = 0.05;
        }
      }

      // Update label
      const label = labelRefs.current[i];
      if (label) {
        if (resp.state === "running_to") {
          label.textContent = `${resp.label} → responding`;
          label.style.display = "block";
          label.style.color = "#ef4444";
        } else if (resp.state === "inspecting") {
          label.textContent = `${resp.label} — inspecting`;
          label.style.display = "block";
          label.style.color = "#f59e0b";
        } else if (resp.state === "returning") {
          label.textContent = `${resp.label} ← returning`;
          label.style.display = "block";
          label.style.color = "#10b981";
        } else {
          label.style.display = "none";
        }
      }
    }
  });

  return (
    <group>
      {/* Standby area marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[STANDBY_POS[0] + 0.5, 0.005, STANDBY_POS[2] + 0.5]}>
        <planeGeometry args={[3, 2.5]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.04} />
      </mesh>
      {/* Standby sign */}
      <group position={[STANDBY_POS[0] + 0.5, 1.8, STANDBY_POS[2] - 0.3]}>
        <mesh>
          <boxGeometry args={[1.0, 0.25, 0.03]} />
          <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[0.9, 0.15]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[-0.35, -0.9, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1.8, 4]} />
          <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0.35, -0.9, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1.8, 4]} />
          <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* Emergency response workers */}
      {RESPONDERS.map((config, i) => (
        <group
          key={config.id}
          ref={(el) => { meshRefs.current[i] = el; }}
          position={[
            STANDBY_POS[0] + config.standbyOffset[0],
            STANDBY_POS[1] + config.standbyOffset[1],
            STANDBY_POS[2] + config.standbyOffset[2],
          ]}
        >
          {/* Body */}
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.25, 0.3, 0.15]} />
            <meshStandardMaterial color={config.color} emissive={config.color} emissiveIntensity={0.1} roughness={0.5} metalness={0.2} />
          </mesh>
          {/* Reflective vest stripes */}
          <mesh position={[0, 0.42, 0.08]}>
            <boxGeometry args={[0.24, 0.03, 0.005]} />
            <meshStandardMaterial color="#e2e8f0" emissive="#e2e8f0" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 0.5, 0.08]}>
            <boxGeometry args={[0.24, 0.03, 0.005]} />
            <meshStandardMaterial color="#e2e8f0" emissive="#e2e8f0" emissiveIntensity={0.4} />
          </mesh>
          {/* Head */}
          <mesh position={[0, 0.68, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#d4a574" roughness={0.9} />
          </mesh>
          {/* Hard hat */}
          <mesh position={[0, 0.74, 0]}>
            <sphereGeometry args={[0.09, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={config.color === "#ef4444" ? "#ffffff" : config.color} roughness={0.4} metalness={0.2} />
          </mesh>
          {/* Legs (animated) */}
          <group ref={(el) => { legRefs.current[i] = el; }} position={[0, 0.15, 0]}>
            <mesh position={[-0.06, 0, 0]}>
              <boxGeometry args={[0.08, 0.3, 0.08]} />
              <meshStandardMaterial color="#1e3a5f" roughness={0.8} />
            </mesh>
            <mesh position={[0.06, 0, 0]}>
              <boxGeometry args={[0.08, 0.3, 0.08]} />
              <meshStandardMaterial color="#1e3a5f" roughness={0.8} />
            </mesh>
          </group>
          {/* Flashing siren on hat */}
          <mesh ref={(el) => { sirenRefs.current[i] = el; }} position={[0, 0.82, 0]}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshStandardMaterial color={config.color} emissive={config.color} emissiveIntensity={0.05} />
          </mesh>
          {/* Status label */}
          <Html position={[0, 1.1, 0]} center distanceFactor={15} style={{ pointerEvents: "none", willChange: "transform" }}>
            <div
              ref={(el) => { labelRefs.current[i] = el; }}
              style={{
                background: "rgba(10, 22, 40, 0.9)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "4px",
                padding: "2px 8px",
                fontSize: "8px",
                fontWeight: 600,
                fontFamily: "'Montserrat', system-ui, sans-serif",
                color: "#ef4444",
                whiteSpace: "nowrap",
                display: "none",
              }}
            />
          </Html>
        </group>
      ))}
    </group>
  );
};

export default EmergencyResponse3D;
