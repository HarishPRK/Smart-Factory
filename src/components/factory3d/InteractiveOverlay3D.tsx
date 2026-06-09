"use no memo";
import React, { useState, useCallback, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { setCameraTarget } from "./CameraController";
import type { StageId } from "../../types/digitalTwin";

/**
 * InteractiveOverlay3D — Makes the entire factory interactive
 *
 * Clickable zones around each element type:
 *  - Equipment stations (already handled by ManufacturingStage3D click)
 *  - Workers — shows role + status
 *  - Robots — shows arm type + task
 *  - Silos — shows fill level + material
 *  - Trucks — shows vehicle info + cargo status
 *  - Forklift — shows operator + load info
 *  - Conveyor sections — shows speed + throughput
 *
 * Hover effect: glowing outline ring appears under hovered object.
 */

interface InfoItem {
  id: string;
  title: string;
  subtitle: string;
  position: [number, number, number];
  details: { label: string; value: string; color?: string }[];
  icon?: string;
  accentColor: string;
}

const INTERACTIVE_ITEMS: InfoItem[] = [
  // Workers
  {
    id: "worker-intake",
    title: "Operator: Mike Johnson",
    subtitle: "Material Inspector — OSHA Certified",
    position: [STAGE_POSITIONS.intake[0] - 0.8, 1.5, STAGE_POSITIONS.intake[2] + 1.2],
    details: [
      { label: "Shift", value: "Day Shift (6AM-2PM)" },
      { label: "Task", value: "Verifying resin batch #TX-2847" },
      { label: "Status", value: "Active", color: "#10b981" },
      { label: "Safety Cert", value: "OSHA 30-Hr, valid Dec 2026" },
      { label: "Employee ID", value: "EMP-4021" },
    ],
    accentColor: "#f97316",
  },
  {
    id: "worker-mixing",
    title: "Operator: Harish Radhakrishnan",
    subtitle: "Chemical Technician — HazMat Certified",
    position: [STAGE_POSITIONS.mixing[0] + 0.8, 1.5, STAGE_POSITIONS.mixing[2] + 1.2],
    details: [
      { label: "Shift", value: "Day Shift (6AM-2PM)" },
      { label: "Task", value: "Monitoring pH levels" },
      { label: "Status", value: "Active", color: "#10b981" },
      { label: "Certification", value: "HazMat Level 2, EPA Compliant" },
      { label: "Employee ID", value: "EMP-3187" },
    ],
    accentColor: "#22c55e",
  },
  {
    id: "worker-quality",
    title: "Inspector: Sarah Mitchell",
    subtitle: "QC Inspector — ISO 9001 Lead Auditor",
    position: [STAGE_POSITIONS.quality[0] - 0.7, 1.5, STAGE_POSITIONS.quality[2] + 1.2],
    details: [
      { label: "Shift", value: "Day Shift (6AM-2PM)" },
      { label: "Task", value: "Dimensional verification — FDA 21 CFR" },
      { label: "Inspected today", value: "847 bottles" },
      { label: "Reject rate", value: "1.2%", color: "#10b981" },
      { label: "Employee ID", value: "EMP-2956" },
    ],
    accentColor: "#3b82f6",
  },
  // Robots
  {
    id: "robot-forming",
    title: "Robot Arm: KUKA KR-210",
    subtitle: "Preform Pick & Place",
    position: [STAGE_POSITIONS.forming[0] + 1.2, 2.0, STAGE_POSITIONS.forming[2] + 1.2],
    details: [
      { label: "Status", value: "Operating", color: "#10b981" },
      { label: "Cycle time", value: "4.2 sec" },
      { label: "Cycles today", value: "3,847" },
      { label: "Accuracy", value: "±0.02mm" },
      { label: "Next maintenance", value: "In 72 hrs" },
    ],
    accentColor: "#f59e0b",
  },
  {
    id: "robot-quality",
    title: "Robot Arm: ABB IRB-2600",
    subtitle: "Inspection Manipulator",
    position: [STAGE_POSITIONS.quality[0] + 1.2, 2.0, STAGE_POSITIONS.quality[2] - 1.2],
    details: [
      { label: "Status", value: "Operating", color: "#10b981" },
      { label: "Scan rate", value: "12 bottles/min" },
      { label: "Defects found", value: "23 today" },
      { label: "Camera", value: "3x 5MP Vision" },
    ],
    accentColor: "#3b82f6",
  },
  {
    id: "robot-packaging",
    title: "Robot Arm: Fanuc M-20iA",
    subtitle: "Case Packer",
    position: [STAGE_POSITIONS.packaging[0] - 1.0, 2.0, STAGE_POSITIONS.packaging[2] - 1.2],
    details: [
      { label: "Status", value: "Operating", color: "#10b981" },
      { label: "Pack rate", value: "24 cases/min" },
      { label: "Cases today", value: "1,284" },
      { label: "Film remaining", value: "78%" },
    ],
    accentColor: "#10b981",
  },
  // Silos
  {
    id: "silo-pet",
    title: "Silo A: PET Resin",
    subtitle: "Virgin PET Grade A-1 — Eastman Chemical",
    position: [STAGE_POSITIONS.intake[0] - 2.0, 3.5, STAGE_POSITIONS.intake[2] - 2.0],
    details: [
      { label: "Capacity", value: "26,000 lbs" },
      { label: "Current level", value: "73%", color: "#10b981" },
      { label: "Material", value: "PET Chip (IV 0.80)" },
      { label: "Temperature", value: "329°F" },
      { label: "Supplier", value: "Eastman, Kingsport TN" },
      { label: "Last refill", value: "4 hrs ago" },
    ],
    accentColor: "#3b82f6",
  },
  {
    id: "silo-additive",
    title: "Silo B: Additives",
    subtitle: "UV Stabilizer + Slip Agent — Clariant",
    position: [STAGE_POSITIONS.intake[0] - 0.5, 3.0, STAGE_POSITIONS.intake[2] - 2.0],
    details: [
      { label: "Capacity", value: "6,600 lbs" },
      { label: "Current level", value: "54%", color: "#f59e0b" },
      { label: "Batch", value: "CLR-US-2024-1847" },
      { label: "Expiry", value: "Aug 2026" },
    ],
    accentColor: "#10b981",
  },
];

/* â”€â”€ Hover Ring — glowing circle under hovered items â”€â”€ */
const HoverRing: React.FC<{ position: [number, number, number]; color: string; visible: boolean }> = ({
  position, color, visible,
}) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = visible ? 0.2 + Math.sin(clock.elapsedTime * 3) * 0.1 : 0;
      ref.current.scale.setScalar(visible ? 1 + Math.sin(clock.elapsedTime * 2) * 0.05 : 0.5);
    }
  });
  return (
    <mesh ref={ref} position={[position[0], 0.015, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.5, 0.65, 24]} />
      <meshBasicMaterial color={color} transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  );
};

/* â”€â”€ Clickable Zone — invisible box that captures hover/click â”€â”€ */
const ClickZone: React.FC<{
  item: InfoItem;
  onSelect: (item: InfoItem) => void;
  onHover: (id: string | null) => void;
  isHovered: boolean;
}> = ({ item, onSelect, onHover, isHovered }) => (
  <group>
    {/* Invisible click target */}
    <mesh
      position={item.position}
      onClick={(e) => { e.stopPropagation(); onSelect(item); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(item.id); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { onHover(null); document.body.style.cursor = "auto"; }}
    >
      <sphereGeometry args={[0.6, 8, 8]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
    {/* Hover ring on floor */}
    <HoverRing position={item.position} color={item.accentColor} visible={isHovered} />
    {/* Hover label */}
    {isHovered && (
      <Html position={[item.position[0], item.position[1] + 0.8, item.position[2]]} center distanceFactor={15} style={{ pointerEvents: "none" }}>
        <div style={{
          background: "rgba(10, 22, 40, 0.85)",
          /* no backdrop-filter for perf */
          border: `1px solid ${item.accentColor}40`,
          borderRadius: "4px",
          padding: "3px 8px",
          whiteSpace: "nowrap",
          fontFamily: "'Montserrat', system-ui, sans-serif",
          fontSize: "9px",
          color: "#e2e8f0",
          fontWeight: 600,
        }}>
          {item.title}
        </div>
      </Html>
    )}
  </group>
);

/* â”€â”€ Detail Panel — shown on click â”€â”€ */
const DetailPanel: React.FC<{
  item: InfoItem;
  onClose: () => void;
}> = ({ item, onClose }) => (
  <Html position={[item.position[0], item.position[1] + 1.0, item.position[2]]} center distanceFactor={10} zIndexRange={[100, 0]}>
    <div
      style={{
        background: "rgba(10, 22, 40, 0.95)",
        /* no backdrop-filter for perf */
        border: `1px solid ${item.accentColor}30`,
        borderRadius: "10px",
        padding: "12px 14px",
        width: "220px",
        fontFamily: "'Montserrat', system-ui, sans-serif",
        color: "#e8f0fa",
        fontSize: "10px",
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 12px ${item.accentColor}15`,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "11px", color: "#f1f5f9" }}>{item.title}</div>
          <div style={{ fontSize: "8px", color: "#94a3b8", marginTop: "2px" }}>{item.subtitle}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            background: "rgba(100,116,139,0.2)",
            border: "none",
            borderRadius: "4px",
            color: "#94a3b8",
            fontSize: "10px",
            padding: "2px 6px",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Accent divider */}
      <div style={{ height: "2px", background: `linear-gradient(90deg, ${item.accentColor}, transparent)`, marginBottom: "8px", borderRadius: "1px" }} />

      {/* Details */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {item.details.map((d, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#94a3b8", fontSize: "9px" }}>{d.label}</span>
            <span style={{ fontWeight: 600, fontSize: "10px", color: d.color ?? "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>
              {d.value}
            </span>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div style={{ textAlign: "center", marginTop: "8px", fontSize: "7px", color: "#64748b" }}>
        Click elsewhere to close
      </div>
    </div>
  </Html>
);

/* â”€â”€ Production Stats Bar — live throughput â”€â”€ */
const ProductionStats: React.FC = () => {
  const tick = useDigitalTwinStore((s) => s.tick);
  const stats = React.useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    tick;
    const s = useDigitalTwinStore.getState();
    return {
      produced: s.totalProduced,
      rejected: s.totalRejected,
      throughput: s.throughputPerMin,
      speed: s.userSpeedMultiplier,
    };
  }, [tick]);

  return (
    <Html position={[0, 0.01, 7.5]} center distanceFactor={20} style={{ pointerEvents: "none" }}>
      <div style={{
        display: "flex",
        gap: "20px",
        background: "rgba(10, 22, 40, 0.85)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(100,116,139,0.2)",
        borderRadius: "8px",
        padding: "6px 16px",
        fontFamily: "'Montserrat', system-ui, sans-serif",
        whiteSpace: "nowrap",
      }}>
        {[
          { label: "PRODUCED", value: stats.produced.toString(), color: "#10b981" },
          { label: "REJECTED", value: stats.rejected.toString(), color: "#ef4444" },
          { label: "THROUGHPUT", value: `${stats.throughput.toFixed(1)}/min`, color: "#3b82f6" },
          { label: "BELT SPEED", value: `${(stats.speed * 100).toFixed(0)}%`, color: "#f59e0b" },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: s.color, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
            <div style={{ fontSize: "7px", color: "#64748b", letterSpacing: "0.08em" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </Html>
  );
};

/* â”€â”€ Main Interactive Overlay â”€â”€ */
const InteractiveOverlay3D: React.FC = () => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<InfoItem | null>(null);

  const handleSelect = useCallback((item: InfoItem) => {
    if (selectedItem?.id === item.id) {
      setSelectedItem(null);
      return;
    }
    setSelectedItem(item);
    // Fly camera to the selected item
    setCameraTarget(
      [item.position[0] + 3, item.position[1] + 3, item.position[2] + 4],
      item.position,
    );
  }, [selectedItem]);

  const handleClose = useCallback(() => {
    setSelectedItem(null);
  }, []);

  return (
    <group>
      {/* Click zones for all interactive items */}
      {INTERACTIVE_ITEMS.map((item) => (
        <ClickZone
          key={item.id}
          item={item}
          onSelect={handleSelect}
          onHover={setHoveredId}
          isHovered={hoveredId === item.id}
        />
      ))}

      {/* Detail panel for selected item */}
      {selectedItem && (
        <DetailPanel item={selectedItem} onClose={handleClose} />
      )}

    </group>
  );
};

export default InteractiveOverlay3D;
