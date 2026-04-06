"use no memo";
import React, { useState, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import ZoneFloor from "./ZoneFloor";
import MachineModel from "./MachineModel";
import ConveyorBelt from "./ConveyorBelt";
import MaterialFlow from "./MaterialFlow";
import MachineTooltip from "./MachineTooltip";
import FactoryEnvironment from "./FactoryEnvironment";
import ProcessPipeline3D from "./ProcessPipeline3D";
import { useFactoryData, type Machine3DState } from "./useFactoryData";
import { CONVEYOR_PATH, MACHINE_POSITIONS } from "./factoryLayout";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";

/* ── Emergency Light ─────────────────────────────────── */

const EmergencyLight: React.FC<{ active: boolean }> = ({ active }) => {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    if (active) {
      lightRef.current.intensity = Math.sin(clock.elapsedTime * 4 * Math.PI) > 0 ? 3 : 0;
    } else {
      lightRef.current.intensity = 0;
    }
  });

  return (
    <group>
      <pointLight ref={lightRef} position={[0, 6, 0]} color="#ef4444" distance={25} decay={2} intensity={0} />
      {active && (
        <mesh position={[0, 5.5, 0]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      )}
    </group>
  );
};

/* ── Pipe Network ────────────────────────────────────── */

const PipeNetwork: React.FC = () => {
  const pipes = useMemo(() => {
    const m1 = MACHINE_POSITIONS.m1;
    const m2 = MACHINE_POSITIONS.m2;
    const m3 = MACHINE_POSITIONS.m3;

    // Back-row pipes connecting m1 → m2 → m3 (overhead)
    const backPipes: { points: THREE.Vector3[]; color: string }[] = [
      {
        points: [
          new THREE.Vector3(m1[0] + 1, 2.2, m1[2]),
          new THREE.Vector3((m1[0] + m2[0]) / 2, 2.5, m1[2]),
          new THREE.Vector3(m2[0] - 1, 2.2, m2[2]),
        ],
        color: "#ef4444",
      },
      {
        points: [
          new THREE.Vector3(m2[0] + 1, 2.2, m2[2]),
          new THREE.Vector3((m2[0] + m3[0]) / 2, 2.5, m2[2]),
          new THREE.Vector3(m3[0] - 1, 2.2, m3[2]),
        ],
        color: "#3b82f6",
      },
      // Cross pipe front-to-back in Zone 2
      {
        points: [
          new THREE.Vector3(m2[0], 1.8, m2[2] + 0.8),
          new THREE.Vector3(m2[0], 2.0, (m2[2] + 3) / 2),
          new THREE.Vector3(m2[0], 1.5, 3),
        ],
        color: "#f59e0b",
      },
    ];

    return backPipes;
  }, []);

  return (
    <group>
      {pipes.map((pipe, i) => {
        const curve = new THREE.CatmullRomCurve3(pipe.points, false);
        return (
          <group key={i}>
            <mesh>
              <tubeGeometry args={[curve, 24, 0.035, 6, false]} />
              <meshStandardMaterial color={pipe.color} metalness={0.8} roughness={0.2} emissive={pipe.color} emissiveIntensity={0.15} />
            </mesh>
            {/* Pipe joints */}
            {pipe.points.map((p, j) => (
              <mesh key={j} position={p}>
                <sphereGeometry args={[0.055, 8, 8]} />
                <meshStandardMaterial color={pipe.color} metalness={0.9} roughness={0.1} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Pipe supports (vertical poles) */}
      {[
        [(MACHINE_POSITIONS.m1[0] + MACHINE_POSITIONS.m2[0]) / 2, MACHINE_POSITIONS.m1[2]],
        [(MACHINE_POSITIONS.m2[0] + MACHINE_POSITIONS.m3[0]) / 2, MACHINE_POSITIONS.m2[2]],
      ].map(([x, z], i) => (
        <mesh key={`support-${i}`} position={[x, 1.25, z]}>
          <cylinderGeometry args={[0.025, 0.025, 2.5, 6]} />
          <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
};

/* ── Ambient Dust Particles ──────────────────────────── */

const AmbientParticles: React.FC = () => {
  const instanceRef = useRef<THREE.InstancedMesh>(null);
  const COUNT = 40;
  const speeds = useMemo(() => Array.from({ length: COUNT }, () => 0.1 + Math.random() * 0.3), []);
  const offsets = useMemo(() => Array.from({ length: COUNT }, () => Math.random() * Math.PI * 2), []);
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);

  useFrame(({ clock }) => {
    if (!instanceRef.current) return;
    for (let i = 0; i < COUNT; i++) {
      const t = clock.elapsedTime * speeds[i] + offsets[i];
      const x = (Math.sin(t * 0.7 + i) * 12);
      const y = 1.5 + Math.sin(t * 1.3 + i * 0.5) * 1.5;
      const z = (Math.cos(t * 0.5 + i * 0.3) * 8);
      tempMatrix.makeTranslation(x, y, z);
      instanceRef.current.setMatrixAt(i, tempMatrix);
    }
    instanceRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={instanceRef} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[0.015, 4, 4]} />
      <meshBasicMaterial color="#94a3b8" transparent opacity={0.3} />
    </instancedMesh>
  );
};

/* ── Ceiling Lights ──────────────────────────────────── */

const CeilingLights: React.FC = () => {
  return (
    <group>
      {[[-7, 0.5], [0, 0.5], [7, 0.5]].map(([x, z], i) => (
        <group key={i}>
          {/* Light fixture */}
          <mesh position={[x, 4.5, z]}>
            <boxGeometry args={[1.5, 0.06, 0.3]} />
            <meshStandardMaterial color="#d4d4d8" metalness={0.8} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
          {/* Light panel */}
          <mesh position={[x, 4.46, z]}>
            <planeGeometry args={[1.3, 0.2]} />
            <meshBasicMaterial color="#fff5e6" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
          {/* Actual light */}
          <pointLight position={[x, 4, z]} color="#ffe8c0" intensity={0.35} distance={10} decay={2} />
        </group>
      ))}
    </group>
  );
};

/* ── Zone Labels ─────────────────────────────────────── */

const ZoneLabels: React.FC = () => {
  return (
    <group>
      {[
        { pos: [-7, 0.05, -5.5] as [number, number, number], label: "ZONE 1", color: "#3b82f6" },
        { pos: [0, 0.05, -5.5] as [number, number, number], label: "ZONE 2", color: "#8b5cf6" },
        { pos: [7, 0.05, -5.5] as [number, number, number], label: "ZONE 3", color: "#06b6d4" },
      ].map((zone) => (
        <mesh key={zone.label} position={zone.pos} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.5, 0.4]} />
          <meshBasicMaterial color={zone.color} transparent opacity={0.08} />
        </mesh>
      ))}
    </group>
  );
};

/* ── Scene Content ───────────────────────────────────── */

const SceneContent: React.FC<{
  data: ReturnType<typeof useFactoryData>;
  selectedMachine: Machine3DState | null;
  onMachineClick: (m: Machine3DState) => void;
  onCloseTooltip: () => void;
}> = ({ data, selectedMachine, onMachineClick, onCloseTooltip }) => {
  // Only subscribe to simulationActive (changes once on mount)
  const dtActive = useDigitalTwinStore((s) => s.simulationActive);

  return (
    <>
      {/* Industrial Lighting — warm overhead + cool fill */}
      <ambientLight intensity={0.4} color="#2a2a35" />
      <directionalLight
        position={[10, 20, 8]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={60}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        color="#ffeedd"
      />
      <hemisphereLight args={["#b8cce0", "#1a1a20", 0.4]} />

      {/* Warm overhead fill per zone (like warehouse sodium lamps) */}
      <pointLight position={[-7, 5, 0.5]} color="#ffd78a" intensity={0.3} distance={14} decay={2} />
      <pointLight position={[0, 5, 0.5]} color="#ffd78a" intensity={0.3} distance={14} decay={2} />
      <pointLight position={[7, 5, 0.5]} color="#ffd78a" intensity={0.3} distance={14} decay={2} />

      {/* Fog */}
      <fog attach="fog" args={["#111820", 35, 65]} />

      {/* Controls */}
      <OrbitControls
        maxPolarAngle={Math.PI / 2.2}
        minDistance={8}
        maxDistance={40}
        enableDamping
        dampingFactor={0.05}
        target={[0, 0.5, 0.5]}
      />

      {/* Factory building + workers + props */}
      <FactoryEnvironment />

      {/* Floor */}
      <ZoneFloor selectedZone={data.selectedZone} />
      <ZoneLabels />

      {/* Infrastructure */}
      <PipeNetwork />
      <CeilingLights />
      <AmbientParticles />

      {/* Machines */}
      {data.machines.map((m) => (
        <MachineModel key={m.id} machine={m} onClick={onMachineClick} />
      ))}

      {/* Conveyor — speed modulated by digital twin when active */}
      <ConveyorBelt
        path={CONVEYOR_PATH}
        running={data.photoESensorActive || data.motorFanOn || dtActive}
      />
      <MaterialFlow path={CONVEYOR_PATH} active={data.photoESensorActive} />

      {/* Digital Twin Manufacturing Pipeline */}
      <ProcessPipeline3D />

      {/* Emergency light */}
      <EmergencyLight active={data.emergencyLightOn} />

      {/* Machine tooltip */}
      {selectedMachine && (
        <MachineTooltip
          machine={selectedMachine}
          params={data.params}
          onClose={onCloseTooltip}
        />
      )}
    </>
  );
};

/* ── Main exported component ─────────────────────────── */

const FactoryScene: React.FC = () => {
  const data = useFactoryData();
  const [selectedMachine, setSelectedMachine] = useState<Machine3DState | null>(null);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{ position: [15, 12, 15], fov: 40, near: 0.1, far: 100 }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color("#111820");
      }}
      style={{ position: "absolute", inset: 0 }}
      onPointerMissed={() => setSelectedMachine(null)}
    >
      <SceneContent
        data={data}
        selectedMachine={selectedMachine}
        onMachineClick={setSelectedMachine}
        onCloseTooltip={() => setSelectedMachine(null)}
      />
    </Canvas>
  );
};

export default FactoryScene;
