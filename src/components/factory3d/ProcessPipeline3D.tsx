"use no memo";
import React, { useState, useRef, useCallback, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import ManufacturingStage3D from "./ManufacturingStage3D";
import ProductFlow3D from "./ProductFlow3D";
import StageTooltip3D from "./StageTooltip3D";
import RobotArm3D from "./RobotArm3D";
import FactoryWorker3D from "./FactoryWorker3D";
import LidarScanner3D from "./LidarScanner3D";
import StackLight3D from "./StackLight3D";
import { BlowMolderTunnel, CoolingTunnelInline } from "./InlineMachine3D";
import ColaFillingStation3D from "./ColaFillingStation3D";
import { CONVEYOR_PATH } from "./factoryLayout";
import { STAGE_POSITIONS, STAGE_CONVEYOR_T } from "./digitalTwinLayout";
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
  const [selectedStage, setSelectedStage] = useState<ManufacturingStage | null>(
    null,
  );

  const stagesRef = useRef(useDigitalTwinStore.getState().stages);
  useFrame(() => {
    stagesRef.current = useDigitalTwinStore.getState().stages;
  });

  const handleStageClick = useCallback((stage: ManufacturingStage) => {
    setSelectedStage((prev) => (prev?.id === stage.id ? null : stage));
  }, []);

  // ── Conveyor curve — used to compute exact in-line tunnel placements ──
  // Same CatmullRomCurve3 construction the belt + product flow use, so the
  // tunnels sit perfectly on the belt path regardless of layout scale.
  const curve = useMemo(() => {
    const points = CONVEYOR_PATH.map(
      (p) => new THREE.Vector3(p[0], p[1], p[2]),
    );
    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.3);
  }, []);

  // Compute (position, rotationY) at a given conveyorT so a machine straddles
  // the belt and aligns with belt direction at that point.
  const placementAt = useMemo(() => {
    return (t: number) => {
      const pos = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const angle = Math.atan2(tan.x, tan.z);
      return {
        position: [pos.x, pos.y, pos.z] as [number, number, number],
        rotationY: angle,
      };
    };
  }, [curve]);

  const formingTunnel = useMemo(
    () => placementAt(STAGE_CONVEYOR_T.forming),
    [placementAt],
  );
  const fillingPlacement = useMemo(
    () => placementAt(STAGE_CONVEYOR_T.mixing), // "mixing" ID = filling stage
    [placementAt],
  );
  const curingTunnel = useMemo(
    () => placementAt(STAGE_CONVEYOR_T.curing),
    [placementAt],
  );

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
      {/* ── Coca-Cola Bottling Plant headline banner ──
          Floats high above the factory so the brand is readable from any
          camera angle, including the wide top-down view. drei <Html> always
          faces the camera. */}
      <Html
        position={[0, 6, 0]}
        center
        distanceFactor={20}
        style={{ pointerEvents: "none", willChange: "transform" }}
      >
        <div
          style={{
            background: "linear-gradient(180deg, #dc2626 0%, #991b1b 100%)",
            border: "3px solid #ffffff",
            borderRadius: "8px",
            padding: "10px 28px",
            textAlign: "center",
            boxShadow:
              "0 0 24px rgba(220,38,38,0.6), 0 4px 12px rgba(0,0,0,0.5)",
            fontFamily: "'Inter', system-ui",
          }}
        >
          <div
            style={{
              fontFamily: "'Brush Script MT', cursive, system-ui",
              fontSize: "28px",
              fontWeight: 900,
              color: "#ffffff",
              transform: "skewX(-6deg)",
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}
          >
            Coca-Cola
          </div>
          <div
            style={{
              fontSize: "9px",
              fontWeight: 700,
              color: "#fef2f2",
              letterSpacing: "0.25em",
              marginTop: "4px",
            }}
          >
            BOTTLING PLANT — DIGITAL TWIN
          </div>
        </div>
      </Html>

      {stagesRef.current.map((stage, index) => (
        <ManufacturingStage3D
          key={stage.id}
          stageIndex={index}
          onClick={handleStageClick}
        />
      ))}

      <ProductFlow3D path={CONVEYOR_PATH} />

      {/* ── In-line tunnel machines ──
          Belt threads through the middle of these. Preforms enter the blow
          molder and red Coke bottles emerge on the downstream side. Cooled
          bottles travel through the cooling tunnel under cyan glow. */}
      <BlowMolderTunnel
        position={formingTunnel.position}
        rotationY={formingTunnel.rotationY}
      />
      <CoolingTunnelInline
        position={curingTunnel.position}
        rotationY={curingTunnel.rotationY}
      />

      {/* Coca-Cola filling station — inline filling machine.
          Positioned directly on the belt at the filling/mixing stage.
          Bottles pass through and get filled with Coca-Cola. */}
      <ColaFillingStation3D
        position={fillingPlacement.position}
        rotationY={fillingPlacement.rotationY}
      />

      {selectedStage && (
        <StageTooltip3D
          stage={selectedStage}
          position={selectedStage.position}
          onClose={() => setSelectedStage(null)}
        />
      )}

      {/* ── Robot Arms ──
          Only the packaging cobot exists. Forming/Quality/Dispatch stages
          are handled by fixed equipment + human operators; no cobots needed. */}

      {/* Quality — LiDAR scanning laser + point cloud */}
      <LidarScanner3D position={[quality[0], quality[1] - 0.5, quality[2]]} />

      {/* Packaging — case-packing cobot.
          Positioned beside the conveyor at z=-2.74 so its pickup zone (local
          +x, scale 2.8 → 1.26 units) lands on the belt at z=-4. Drop zone
          (local -z, after π/2 yaw) lands on the carton at (packaging[0]-1.26,
          _, -2.74). syncToConveyor=true makes its cycle scale with bottle
          flow speed and pause when no bottles are present. */}
      <RobotArm3D
        position={[packaging[0], 0.45, packaging[2] + 1.26]}
        rotation={[0, Math.PI / 2, 0]}
        color="#dc2626"
        speed={4.0}
        scale={2.8}
        syncToConveyor
      />

      {/* Coca-Cola carton at the packaging cobot's drop zone */}
      <group position={[packaging[0] - 1.26, 0, packaging[2] + 1.26]}>
        {/* Carton body — opaque cardboard brown */}
        <mesh position={[0, 0.22, 0]} castShadow>
          <boxGeometry args={[0.55, 0.44, 0.45]} />
          <meshStandardMaterial
            color="#92400e"
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>
        {/* Inner cavity (top dark rectangle so it reads as "open box") */}
        <mesh position={[0, 0.435, 0]}>
          <boxGeometry args={[0.48, 0.01, 0.38]} />
          <meshStandardMaterial color="#1c1917" roughness={0.9} />
        </mesh>
        {/* Coca-Cola red label panel — front */}
        <mesh position={[0, 0.22, 0.226]}>
          <planeGeometry args={[0.5, 0.3]} />
          <meshStandardMaterial
            color="#dc2626"
            emissive="#7f1d1d"
            emissiveIntensity={0.2}
            roughness={0.5}
          />
        </mesh>
        {/* White Coke wave stripe */}
        <mesh position={[0, 0.22, 0.227]}>
          <planeGeometry args={[0.45, 0.05]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        {/* Coca-Cola red label panel — side */}
        <mesh position={[0.276, 0.22, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.4, 0.3]} />
          <meshStandardMaterial
            color="#dc2626"
            emissive="#7f1d1d"
            emissiveIntensity={0.2}
            roughness={0.5}
          />
        </mesh>
        <mesh position={[0.277, 0.22, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.36, 0.05]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        {/* Wooden pallet under carton */}
        <mesh position={[0, 0.015, 0]} castShadow>
          <boxGeometry args={[0.65, 0.03, 0.55]} />
          <meshStandardMaterial
            color="#78350f"
            roughness={0.95}
            metalness={0.02}
          />
        </mesh>
      </group>

      {/* ── Andon Stack Lights ──
          One per stage. Each tower's red/amber/green domes track the stage's
          live status from the store: green=running, amber=warning, red=faulted,
          blue base flash=blocked, all dim=idle. Positioned on a clear corner
          of each stage so they don't overlap equipment or workers. */}
      <StackLight3D
        stageIndex={0}
        position={[intake[0] + 1.0, intake[1] - 0.5, intake[2] - 1.0]}
      />
      <StackLight3D
        stageIndex={1}
        position={[mixing[0] - 1.0, mixing[1] - 0.5, mixing[2] + 1.0]}
      />
      <StackLight3D
        stageIndex={2}
        position={[forming[0] + 1.0, forming[1] - 0.5, forming[2] + 1.0]}
      />
      <StackLight3D
        stageIndex={3}
        position={[curing[0] + 1.0, curing[1] - 0.5, curing[2] + 1.0]}
      />
      <StackLight3D
        stageIndex={4}
        position={[quality[0] + 1.0, quality[1] - 0.5, quality[2] + 1.0]}
      />
      <StackLight3D
        stageIndex={5}
        position={[packaging[0] + 1.4, packaging[1] - 0.5, packaging[2] + 1.0]}
      />
      <StackLight3D
        stageIndex={6}
        position={[dispatch[0] - 1.0, dispatch[1] - 0.5, dispatch[2] + 1.0]}
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
              <meshStandardMaterial
                color="#6b7280"
                metalness={0.7}
                roughness={0.3}
                emissive="#4b5563"
                emissiveIntensity={0.1}
              />
            </mesh>
            {/* Joints at each end */}
            <mesh position={[x1, y, z1]}>
              <sphereGeometry args={[0.02, 6, 6]} />
              <meshStandardMaterial
                color="#9ca3af"
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

export default ProcessPipeline3D;
