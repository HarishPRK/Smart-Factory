"use no memo";
import React, { useState, useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import ManufacturingStage3D from "./ManufacturingStage3D";
import ProductFlow3D from "./ProductFlow3D";
import StageTooltip3D from "./StageTooltip3D";
import RobotArm3D from "./RobotArm3D";
import FactoryWorker3D from "./FactoryWorker3D";
import LidarScanner3D from "./LidarScanner3D";
import { CONVEYOR_PATH } from "./factoryLayout";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import type { ManufacturingStage } from "../../types/digitalTwin";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";

/**
 * ProcessPipeline3D — Zig-zag production line layout
 *
 * Row 1 (z=4):  INTAKE ──── MIXING ─────┐
 * Row 2 (z=0):  FORMING ←── CURING ─────┘
 * Row 3 (z=-4): QUALITY ── PACKAGING ── DISPATCH
 *
 * Robot arms and workers positioned around the zig-zag path.
 */
const ProcessPipeline3D: React.FC = () => {
  const active = useDigitalTwinStore((s) => s.simulationActive);
  const [selectedStage, setSelectedStage] = useState<ManufacturingStage | null>(null);

  const stagesRef = useRef(useDigitalTwinStore.getState().stages);
  useFrame(() => {
    stagesRef.current = useDigitalTwinStore.getState().stages;
  });

  const handleStageClick = useCallback((stage: ManufacturingStage) => {
    setSelectedStage((prev) => prev?.id === stage.id ? null : stage);
  }, []);

  if (!active || stagesRef.current.length === 0) return null;

  const intake = STAGE_POSITIONS.intake;
  const mixing = STAGE_POSITIONS.mixing;
  const forming = STAGE_POSITIONS.forming;
  const curing = STAGE_POSITIONS.curing;
  const quality = STAGE_POSITIONS.quality;
  const packaging = STAGE_POSITIONS.packaging;
  const dispatch = STAGE_POSITIONS.dispatch;

  return (
    <group>
      {stagesRef.current.map((stage, index) => (
        <ManufacturingStage3D
          key={stage.id}
          stageIndex={index}
          onClick={handleStageClick}
        />
      ))}

      <ProductFlow3D path={CONVEYOR_PATH} />

      {selectedStage && (
        <StageTooltip3D
          stage={selectedStage}
          position={selectedStage.position}
          onClose={() => setSelectedStage(null)}
        />
      )}

      {/* ── Robot Arms ── */}
      {/* Forming — pick-and-place for preforms (Row 2 right side) */}
      <RobotArm3D
        position={[forming[0] + 1.2, forming[1] - 0.5, forming[2] + 1.2]}
        rotation={[0, -Math.PI / 2, 0]}
        color="#f59e0b"
        speed={0.8}
        scale={2.5}
      />

      {/* Quality — inspection arm (Row 3 left) */}
      <RobotArm3D
        position={[quality[0] + 1.2, quality[1] - 0.5, quality[2] - 1.2]}
        rotation={[0, Math.PI / 2, 0]}
        color="#3b82f6"
        speed={0.6}
        scale={2.2}
      />

      {/* Quality — LiDAR scanning laser + point cloud */}
      <LidarScanner3D position={[quality[0], quality[1] - 0.5, quality[2]]} />

      {/* Packaging — bottle packing robot (Row 3 center) */}
      <RobotArm3D
        position={[packaging[0] - 1.0, packaging[1] - 0.5, packaging[2] - 1.2]}
        rotation={[0, Math.PI / 3, 0]}
        color="#10b981"
        speed={1.0}
        scale={2.3}
      />

      {/* Dispatch — palletizing robot (Row 3 right end) */}
      <RobotArm3D
        position={[dispatch[0] + 1.0, dispatch[1] - 0.5, dispatch[2] + 1.2]}
        rotation={[0, -Math.PI, 0]}
        color="#8b5cf6"
        speed={0.5}
        scale={2.8}
      />

      {/* ── Human Workers / Operators ── */}
      {/* Intake — operator checking incoming resin (Row 1 left) */}
      <FactoryWorker3D
        position={[intake[0] - 0.8, intake[1] - 0.5, intake[2] + 1.2]}
        rotation={[0, Math.PI / 4, 0]}
        pose="clipboard"
        helmetColor="#fbbf24"
        vestColor="#f97316"
      />

      {/* Mixing — chemist monitoring tank (Row 1 center) */}
      <FactoryWorker3D
        position={[mixing[0] + 0.8, mixing[1] - 0.5, mixing[2] + 1.2]}
        rotation={[0, -Math.PI / 4, 0]}
        pose="inspecting"
        helmetColor="#ffffff"
        vestColor="#22c55e"
      />

      {/* Forming — operator at control panel (Row 2 right) */}
      <FactoryWorker3D
        position={[forming[0] - 0.9, forming[1] - 0.5, forming[2] + 1.0]}
        rotation={[0, Math.PI / 3, 0]}
        pose="operating"
        helmetColor="#fbbf24"
        vestColor="#f97316"
      />

      {/* Curing — technician monitoring oven (Row 2 left) */}
      <FactoryWorker3D
        position={[curing[0] - 0.8, curing[1] - 0.5, curing[2] - 1.0]}
        rotation={[0, Math.PI / 2, 0]}
        pose="inspecting"
        helmetColor="#ef4444"
        vestColor="#f97316"
      />

      {/* Quality — QC inspector with clipboard (Row 3 left) */}
      <FactoryWorker3D
        position={[quality[0] - 0.7, quality[1] - 0.5, quality[2] + 1.2]}
        rotation={[0, -Math.PI / 6, 0]}
        pose="clipboard"
        helmetColor="#ffffff"
        vestColor="#3b82f6"
      />

      {/* Packaging — operator overseeing wrapper (Row 3 center) */}
      <FactoryWorker3D
        position={[packaging[0] + 0.9, packaging[1] - 0.5, packaging[2] + 1.2]}
        rotation={[0, -Math.PI / 3, 0]}
        pose="standing"
        helmetColor="#fbbf24"
        vestColor="#f97316"
      />

      {/* Dispatch — dock worker (Row 3 right end) */}
      <FactoryWorker3D
        position={[dispatch[0] - 0.6, dispatch[1] - 0.5, dispatch[2] + 1.2]}
        rotation={[0, Math.PI / 6, 0]}
        pose="standing"
        helmetColor="#fbbf24"
        vestColor="#22c55e"
      />

      {/* Inter-stage connection pipes (overhead along zig-zag) */}
      {stagesRef.current.slice(0, -1).map((stage, i) => {
        const nextStage = stagesRef.current[i + 1];
        const x1 = stage.position[0];
        const x2 = nextStage.position[0];
        const z1 = stage.position[2];
        const z2 = nextStage.position[2];
        const y = 1.75;
        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;

        // For same-row pipes, horizontal connection
        // For cross-row pipes (turns), diagonal connection
        const dx = x2 - x1;
        const dz = z2 - z1;
        const length = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dz, dx);

        return (
          <group key={`pipe-${i}`}>
            <mesh position={[midX, y, midZ]} rotation={[0, -angle, 0]}>
              <boxGeometry args={[length, 0.025, 0.025]} />
              <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.3} emissive="#4b5563" emissiveIntensity={0.1} />
            </mesh>
            {/* Joints at each end */}
            <mesh position={[x1, y, z1]}>
              <sphereGeometry args={[0.02, 6, 6]} />
              <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

export default ProcessPipeline3D;
