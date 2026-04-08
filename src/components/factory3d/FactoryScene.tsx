"use no memo";
import React, { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import ConveyorBelt from "./ConveyorBelt";
import MaterialFlow from "./MaterialFlow";
import ProcessPipeline3D from "./ProcessPipeline3D";
import SensorHUD from "./SensorHUD";
import CameraController from "./CameraController";
import FactoryAtmosphere3D from "./FactoryAtmosphere3D";
import FactoryInfrastructure3D from "./FactoryInfrastructure3D";
import MaterialSourceDest3D from "./MaterialSourceDest3D";
import AnimatedMachinery3D from "./AnimatedMachinery3D";
import InteractiveOverlay3D from "./InteractiveOverlay3D";
import FunControls from "./FunControls";
import EmergencyResponse3D from "./EmergencyResponse3D";
import BottleProcessing3D from "./BottleProcessing3D";
import FactoryExtras3D from "./FactoryExtras3D";
import FactoryPremium3D from "./FactoryPremium3D";
import FactoryCompound3D from "./FactoryCompound3D";
import FactoryShowpiece3D from "./FactoryShowpiece3D";
import { useFactoryData } from "./useFactoryData";
import { CONVEYOR_PATH } from "./factoryLayout";
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

/* ── Ambient Dust Particles ──────────────────────────── */

const AmbientParticles: React.FC = () => {
  const instanceRef = useRef<THREE.InstancedMesh>(null);
  const COUNT = 50;
  const speeds = useMemo(() => Array.from({ length: COUNT }, () => 0.1 + Math.random() * 0.3), []);
  const offsets = useMemo(() => Array.from({ length: COUNT }, () => Math.random() * Math.PI * 2), []);
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);

  useFrame(({ clock }) => {
    if (!instanceRef.current) return;
    for (let i = 0; i < COUNT; i++) {
      const t = clock.elapsedTime * speeds[i] + offsets[i];
      const x = Math.sin(t * 0.7 + i) * 14;
      const y = 1.5 + Math.sin(t * 1.3 + i * 0.5) * 1.5;
      const z = Math.cos(t * 0.5 + i * 0.3) * 10;
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

/* ── Modern Industrial Floor ─────────────────────────── */

const OpenFloor: React.FC = () => (
  <group>
    {/* Base ground — dark polished concrete */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[50, 40]} />
      <meshStandardMaterial color="#141a24" metalness={0.3} roughness={0.7} />
    </mesh>

    {/* Reflective production floor zone */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 0]} receiveShadow>
      <planeGeometry args={[26, 18]} />
      <meshStandardMaterial color="#1a2332" metalness={0.4} roughness={0.5} />
    </mesh>

    {/* Subtle grid — thinner, more modern */}
    {Array.from({ length: 27 }, (_, i) => i - 13).map((x) => (
      <mesh key={`gx${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x * 2, 0.002, 0]}>
        <planeGeometry args={[0.005, 40]} />
        <meshBasicMaterial color="#2a3a4f" transparent opacity={0.2} />
      </mesh>
    ))}
    {Array.from({ length: 21 }, (_, i) => i - 10).map((z) => (
      <mesh key={`gz${z}`} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.002, z * 2]}>
        <planeGeometry args={[0.005, 50]} />
        <meshBasicMaterial color="#2a3a4f" transparent opacity={0.2} />
      </mesh>
    ))}

    {/* Row pathway highlights — glowing strips under each production row */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1, 0.006, 4]}>
      <planeGeometry args={[18, 2.5]} />
      <meshBasicMaterial color="#10b981" transparent opacity={0.04} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.5, 0.006, 0]}>
      <planeGeometry args={[14, 2.5]} />
      <meshBasicMaterial color="#3b82f6" transparent opacity={0.04} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2, 0.006, -4]}>
      <planeGeometry args={[18, 2.5]} />
      <meshBasicMaterial color="#8b5cf6" transparent opacity={0.04} />
    </mesh>

    {/* Glowing pathway edge lines — thin neon strips */}
    {[
      { pos: [-1, 0.008, 5.3], size: [18, 0.03], color: "#10b981" },
      { pos: [-1, 0.008, 2.7], size: [18, 0.03], color: "#10b981" },
      { pos: [0.5, 0.008, 1.3], size: [14, 0.03], color: "#3b82f6" },
      { pos: [0.5, 0.008, -1.3], size: [14, 0.03], color: "#3b82f6" },
      { pos: [2, 0.008, -2.7], size: [18, 0.03], color: "#8b5cf6" },
      { pos: [2, 0.008, -5.3], size: [18, 0.03], color: "#8b5cf6" },
    ].map(({ pos, size, color }, i) => (
      <mesh key={`edge-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={pos as [number, number, number]}>
        <planeGeometry args={size as [number, number]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
    ))}

    {/* Safety perimeter — modern yellow/black dashed border */}
    {[
      { pos: [0, 0.004, 8.5], size: [28, 0.06] },
      { pos: [0, 0.004, -8.5], size: [28, 0.06] },
    ].map(({ pos, size }, i) => (
      <mesh key={`safety-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={pos as [number, number, number]}>
        <planeGeometry args={size as [number, number]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.12} />
      </mesh>
    ))}

    {/* Corner accent markers */}
    {[[-13, 8.5], [13, 8.5], [-13, -8.5], [13, -8.5]].map(([x, z], i) => (
      <mesh key={`corner-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, z]}>
        <circleGeometry args={[0.15, 16]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.2} />
      </mesh>
    ))}
  </group>
);

/* ── Day/Night Lighting Adjuster ─────────────────────── */

const DayNightLighting: React.FC<{ isNight: boolean }> = ({ isNight }) => {
  const { scene } = useThree();
  const ambientRef = useRef<THREE.AmbientLight>(null);

  useFrame(() => {
    // Smoothly transition background color
    const targetBg = isNight ? new THREE.Color("#0a0e16") : new THREE.Color("#87CEEB");
    if (scene.background instanceof THREE.Color) {
      scene.background.lerp(targetBg, 0.02);
    }
    // Adjust ambient
    if (ambientRef.current) {
      const targetIntensity = isNight ? 0.7 : 1.8;
      ambientRef.current.intensity += (targetIntensity - ambientRef.current.intensity) * 0.02;
    }
  });

  return <ambientLight ref={ambientRef} intensity={0.7} color={isNight ? "#c8d6e5" : "#fff8f0"} />;
};

/* ── Scene Content ───────────────────────────────────── */

const SceneContent: React.FC<{
  data: ReturnType<typeof useFactoryData>;
  isNight: boolean;
}> = ({ data, isNight }) => {
  const dtActive = useDigitalTwinStore((s) => s.simulationActive);

  return (
    <>
      {/* Dynamic day/night ambient lighting */}
      <DayNightLighting isNight={isNight} />
      <directionalLight
        position={[15, 30, 12]}
        intensity={2.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={80}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        color="#f0ecff"
      />
      <directionalLight position={[-10, 20, -8]} intensity={0.6} color="#dde4f0" />
      <hemisphereLight args={["#7aa2d4", "#1a2030", 0.8]} />

      {/* Bright overhead area lights per row — like real warehouse HID lamps */}
      <pointLight position={[-5, 5, 4]} color="#e0e8ff" intensity={1.2} distance={18} decay={2} />
      <pointLight position={[0, 5, 4]} color="#e0e8ff" intensity={1.2} distance={18} decay={2} />
      <pointLight position={[5, 5, 4]} color="#e0e8ff" intensity={1.0} distance={18} decay={2} />
      <pointLight position={[-3, 5, 0]} color="#dde4ff" intensity={1.2} distance={18} decay={2} />
      <pointLight position={[3, 5, 0]} color="#dde4ff" intensity={1.0} distance={18} decay={2} />
      <pointLight position={[-4, 5, -4]} color="#e0e8ff" intensity={1.2} distance={18} decay={2} />
      <pointLight position={[2, 5, -4]} color="#e0e8ff" intensity={1.2} distance={18} decay={2} />
      <pointLight position={[7, 5, -4]} color="#e0e8ff" intensity={1.0} distance={18} decay={2} />

      {/* Accent colored uplights under each production row */}
      <pointLight position={[-3, 0.3, 4]} color="#10b981" intensity={0.25} distance={8} decay={2} />
      <pointLight position={[3, 0.3, 4]} color="#10b981" intensity={0.25} distance={8} decay={2} />
      <pointLight position={[0, 0.3, 0]} color="#3b82f6" intensity={0.2} distance={8} decay={2} />
      <pointLight position={[-2, 0.3, -4]} color="#8b5cf6" intensity={0.25} distance={8} decay={2} />
      <pointLight position={[5, 0.3, -4]} color="#8b5cf6" intensity={0.25} distance={8} decay={2} />

      {/* Depth fog — lighter for better visibility */}
      <fog attach="fog" args={["#0e1825", 45, 85]} />

      {/* Camera Controls
           Left-drag:        Orbit (rotate around center)
           Right-drag:       Pan (scroll the view)
           Middle-drag:      Pan (alternative)
           Scroll:           Zoom in/out
      */}
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        screenSpacePanning
        panSpeed={1.0}
        rotateSpeed={0.7}
        zoomSpeed={1.2}
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={0.1}
        minDistance={4}
        maxDistance={55}
        enableDamping
        dampingFactor={0.08}
        target={[0, 0, 0]}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
      <CameraController />

      {/* Open floor — no walls or roof */}
      <OpenFloor />
      <AmbientParticles />

      {/* Zig-zag Conveyor Belt */}
      <ConveyorBelt
        path={CONVEYOR_PATH}
        running={data.photoESensorActive || data.motorFanOn || dtActive}
      />
      <MaterialFlow path={CONVEYOR_PATH} active={data.photoESensorActive} />

      {/* Digital Twin Manufacturing Pipeline (stages + robots + workers) */}
      <ProcessPipeline3D />

      {/* Animated atmosphere — steam, sparks, glowing effects */}
      <FactoryAtmosphere3D />

      {/* Ground infrastructure — pipe racks, walkways, signage */}
      <FactoryInfrastructure3D />

      {/* Raw material source + finished goods dispatch */}
      <MaterialSourceDest3D />

      {/* Animated machinery overlays — spinning, pressing, sweeping */}
      <AnimatedMachinery3D />

      {/* Interactive overlays — click workers, robots, silos, trucks */}
      <InteractiveOverlay3D />

      {/* Emergency response — workers run to faulted stages */}
      <EmergencyResponse3D />



      {/* Water filling, capping, labeling & rejection stations */}
      <BottleProcessing3D />

      {/* Extra details — reservoir, counters, energy meter, shift, QR scanner */}
      <FactoryExtras3D />

      {/* Premium features — CCTV, clock, smoke, LEDs, bins, antenna, waves, turntables */}
      <FactoryPremium3D />

      {/* Factory compound — parking, solar, cooling tower, guard booth, flags */}
      <FactoryCompound3D />

      {/* Showpiece — AI orb, data streams, helicopter, scoreboard, welding, holo table */}
      <FactoryShowpiece3D />

      {/* Emergency light */}
      <EmergencyLight active={data.emergencyLightOn} />
    </>
  );
};

/* ── Main exported component ─────────────────────────── */

const FactoryScene: React.FC = () => {
  const data = useFactoryData();
  const [isNight, setIsNight] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDayNight = useCallback((night: boolean) => {
    setIsNight(night);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
      } catch (err) {
        console.error("Failed to enter fullscreen:", err);
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error("Failed to exit fullscreen:", err);
      }
    }
  }, []);

  // Sync state with browser fullscreen changes (e.g., user pressing Esc)
  React.useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Keyboard shortcut: F to toggle fullscreen
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, willChange: "transform", background: "#0a0e16" }}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        camera={{ position: [18, 14, 18], fov: 40, near: 0.1, far: 120 }}
        onCreated={({ gl, scene, camera }) => {
          scene.background = new THREE.Color("#0a0e16");
          gl.compile(scene, camera);
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <SceneContent data={data} isNight={isNight} />
      </Canvas>
      <SensorHUD />
      <FunControls onDayNightToggle={handleDayNight} />

      {/* Fullscreen toggle button */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit fullscreen (Esc or F)" : "Enter fullscreen (F)"}
        style={{
          position: "absolute",
          bottom: "12px",
          right: "12px",
          zIndex: 20,
          background: "rgba(10, 22, 40, 0.9)",
          border: "1px solid rgba(59,130,246,0.3)",
          borderRadius: "8px",
          color: "#93c5fd",
          padding: "8px 14px",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: 600,
          fontFamily: "'Inter', system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(59,130,246,0.2)";
          (e.currentTarget as HTMLButtonElement).style.color = "#dbeafe";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(10, 22, 40, 0.9)";
          (e.currentTarget as HTMLButtonElement).style.color = "#93c5fd";
        }}
      >
        <span style={{ fontSize: "16px", lineHeight: 1 }}>{isFullscreen ? "⛶" : "⛶"}</span>
        {isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
      </button>
    </div>
  );
};

export default FactoryScene;
