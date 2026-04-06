"use no memo";
import React, { useState, useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import ManufacturingStage3D from "./ManufacturingStage3D";
import ProductFlow3D from "./ProductFlow3D";
import StageTooltip3D from "./StageTooltip3D";
import { CONVEYOR_PATH } from "./factoryLayout";
import type { ManufacturingStage } from "../../types/digitalTwin";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";

/**
 * ProcessPipeline3D — Performance-optimized
 *
 * DOES NOT subscribe to stages/products via React hooks.
 * Instead, child components read getState() inside useFrame.
 * This component only re-renders when the user clicks a stage (tooltip).
 */
const ProcessPipeline3D: React.FC = () => {
  // Only subscribe to simulationActive (changes rarely)
  const active = useDigitalTwinStore((s) => s.simulationActive);
  const [selectedStage, setSelectedStage] = useState<ManufacturingStage | null>(null);

  // Read stage list once for initial mount — stages array identity is stable
  const stagesRef = useRef(useDigitalTwinStore.getState().stages);
  useFrame(() => {
    stagesRef.current = useDigitalTwinStore.getState().stages;
  });

  const handleStageClick = useCallback((stage: ManufacturingStage) => {
    setSelectedStage((prev) => prev?.id === stage.id ? null : stage);
  }, []);

  if (!active || stagesRef.current.length === 0) return null;

  // We render a fixed number of stage slots (7) — they never change count
  // Each ManufacturingStage3D reads its own data imperatively via getState()
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

      {/* Inter-stage connection pipes */}
      {stagesRef.current.slice(0, -1).map((stage, i) => {
        const nextStage = stagesRef.current[i + 1];
        const x1 = stage.position[0] + 0.5;
        const x2 = nextStage.position[0] - 0.5;
        const y = 1.55;
        const z = stage.position[2];
        const midX = (x1 + x2) / 2;
        const width = x2 - x1;

        return (
          <group key={`pipe-${i}`}>
            <mesh position={[midX, y, z]}>
              <boxGeometry args={[width, 0.02, 0.02]} />
              <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.3} emissive="#4b5563" emissiveIntensity={0.1} />
            </mesh>
            <mesh position={[midX, y, z]}>
              <sphereGeometry args={[0.015, 6, 6]} />
              <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

export default ProcessPipeline3D;
