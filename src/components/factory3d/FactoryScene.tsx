"use no memo";
import React, { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, OrbitControls } from "@react-three/drei";
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
import { CONVEYOR_PATH } from "./factoryLayout";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { usePLCStore } from "../../stores/plcStore";

/* ── 🎉 EASTER EGG: Disco Party Mode (Konami Code) ──── */

const SECRET_WORD = "party";
const MAX_DPR =
  typeof window === "undefined"
    ? 1
    : Math.min(window.devicePixelRatio || 1, 1.25);

function pseudoRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
}

const DiscoBall: React.FC = () => {
  const ballRef = useRef<THREE.Mesh>(null);
  const spotsRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ballRef.current) ballRef.current.rotation.y = t * 2;
    if (spotsRef.current) spotsRef.current.rotation.y = -t * 3;
  });

  const spotColors = [
    "#ef4444",
    "#f59e0b",
    "#22c55e",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#f97316",
  ];

  return (
    <group position={[0, 6.5, 0]}>
      {/* Disco ball */}
      <mesh ref={ballRef}>
        <sphereGeometry args={[0.6, 24, 24]} />
        <meshStandardMaterial
          color="#c0c0c0"
          metalness={1}
          roughness={0}
          envMapIntensity={2}
        />
      </mesh>
      {/* String */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 1.6, 4]} />
        <meshBasicMaterial color="#888" />
      </mesh>
      {/* Spinning colored spotlights */}
      <group ref={spotsRef}>
        {spotColors.map((color, i) => {
          const angle = (i / spotColors.length) * Math.PI * 2;
          return (
            <pointLight
              key={i}
              position={[Math.cos(angle) * 3, -2, Math.sin(angle) * 3]}
              color={color}
              intensity={2}
              distance={15}
              decay={2}
            />
          );
        })}
      </group>
    </group>
  );
};

/* ── Emergency Light ─────────────────────────────────── */

const EmergencyLight: React.FC<{ active: boolean }> = ({ active }) => {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    if (active) {
      lightRef.current.intensity =
        Math.sin(clock.elapsedTime * 4 * Math.PI) > 0 ? 3 : 0;
    } else {
      lightRef.current.intensity = 0;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={[0, 6, 0]}
        color="#ef4444"
        distance={25}
        decay={2}
        intensity={0}
      />
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
  const speeds = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => 0.1 + pseudoRandom(i + 1) * 0.3),
    [],
  );
  const offsets = useMemo(
    () =>
      Array.from(
        { length: COUNT },
        (_, i) => pseudoRandom(i + COUNT + 1) * Math.PI * 2,
      ),
    [],
  );
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

/* ── Modern Factory Building ─────────────────────────── */

const OpenFloor: React.FC = () => {
  const W = 46; // building width (X)
  const D = 32; // building depth (Z)
  const H = 7; // wall height
  const ROOF_H = 8; // roof height

  return (
    <group>
      {/* ═══ REFLECTIVE EPOXY FLOOR ═══ */}
      {/* Outer ground */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[60, 50]} />
        <meshStandardMaterial color="#0c1018" metalness={0.2} roughness={0.8} />
      </mesh>

      {/* Main factory floor — high-gloss epoxy */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.0, 0]}
        receiveShadow
      >
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial
          color="#151d2b"
          metalness={0.6}
          roughness={0.25}
          envMapIntensity={0.5}
        />
      </mesh>

      {/* Floor grid lines — subtle modern pattern */}
      {Array.from({ length: 16 }, (_, i) => i - 7).map((x) => (
        <mesh
          key={`gx${x}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[x * 2, 0.003, 0]}
        >
          <planeGeometry args={[0.008, D]} />
          <meshBasicMaterial color="#2a3a55" transparent opacity={0.15} />
        </mesh>
      ))}
      {Array.from({ length: 12 }, (_, i) => i - 5).map((z) => (
        <mesh
          key={`gz${z}`}
          rotation={[-Math.PI / 2, 0, Math.PI / 2]}
          position={[0, 0.003, z * 2]}
        >
          <planeGeometry args={[0.008, W]} />
          <meshBasicMaterial color="#2a3a55" transparent opacity={0.15} />
        </mesh>
      ))}

      {/* Row pathway highlights */}
      {[
        { z: 4, color: "#10b981" },
        { z: 0, color: "#3b82f6" },
        { z: -4, color: "#8b5cf6" },
      ].map(({ z, color }, i) => (
        <group key={`row-${i}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, z]}>
            <planeGeometry args={[W - 4, 2.2]} />
            <meshBasicMaterial color={color} transparent opacity={0.03} />
          </mesh>
          {/* Edge neon strips */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, z + 1.1]}>
            <planeGeometry args={[W - 4, 0.02]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, z - 1.1]}>
            <planeGeometry args={[W - 4, 0.02]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} />
          </mesh>
        </group>
      ))}

      {/* ═══ STEEL FRAME STRUCTURE ═══ */}
      {/* Vertical steel columns at corners and midpoints */}
      {[
        [-W / 2, -D / 2],
        [-W / 2, 0],
        [-W / 2, D / 2],
        [W / 2, -D / 2],
        [W / 2, 0],
        [W / 2, D / 2],
        [0, -D / 2],
        [0, D / 2],
      ].map(([x, z], i) => (
        <mesh key={`col-${i}`} position={[x, H / 2, z]} castShadow>
          <boxGeometry args={[0.15, H, 0.15]} />
          <meshStandardMaterial
            color="#374151"
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      ))}

      {/* Top horizontal beams (X direction) */}
      {[-D / 2, 0, D / 2].map((z, i) => (
        <mesh key={`beamX-${i}`} position={[0, H, z]}>
          <boxGeometry args={[W, 0.12, 0.12]} />
          <meshStandardMaterial
            color="#4b5563"
            metalness={0.85}
            roughness={0.15}
          />
        </mesh>
      ))}

      {/* Top horizontal beams (Z direction) */}
      {[-W / 2, 0, W / 2].map((x, i) => (
        <mesh key={`beamZ-${i}`} position={[x, H, 0]}>
          <boxGeometry args={[0.12, 0.12, D]} />
          <meshStandardMaterial
            color="#4b5563"
            metalness={0.85}
            roughness={0.15}
          />
        </mesh>
      ))}

      {/* Roof cross trusses */}
      {[-7, 0, 7].map((x, i) => (
        <mesh key={`truss-${i}`} position={[x, ROOF_H - 0.5, 0]}>
          <boxGeometry args={[0.08, 0.08, D]} />
          <meshStandardMaterial
            color="#6b7280"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      ))}

      {/* ═══ GLASS WALLS ═══ */}
      {/* Front wall (z = D/2) — glass panels between columns */}
      <mesh position={[0, H / 2, D / 2]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial
          color="#a8c8e8"
          transparent
          opacity={0.08}
          metalness={0.9}
          roughness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Back wall (z = -D/2) */}
      <mesh position={[0, H / 2, -D / 2]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial
          color="#a8c8e8"
          transparent
          opacity={0.08}
          metalness={0.9}
          roughness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Left wall (x = -W/2) */}
      <mesh position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial
          color="#a8c8e8"
          transparent
          opacity={0.08}
          metalness={0.9}
          roughness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Right wall (x = W/2) */}
      <mesh position={[W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial
          color="#a8c8e8"
          transparent
          opacity={0.08}
          metalness={0.9}
          roughness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Glass wall horizontal mullions */}
      {[1.5, 3, 4.5].map((y) => (
        <group key={`mullion-${y}`}>
          <mesh position={[0, y, D / 2]}>
            <boxGeometry args={[W, 0.03, 0.03]} />
            <meshStandardMaterial
              color="#6b7280"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
          <mesh position={[0, y, -D / 2]}>
            <boxGeometry args={[W, 0.03, 0.03]} />
            <meshStandardMaterial
              color="#6b7280"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
          <mesh position={[-W / 2, y, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[D, 0.03, 0.03]} />
            <meshStandardMaterial
              color="#6b7280"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
          <mesh position={[W / 2, y, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[D, 0.03, 0.03]} />
            <meshStandardMaterial
              color="#6b7280"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
        </group>
      ))}

      {/* Roof removed — open-top factory for clear visibility from above */}

      {/* ═══ LED CEILING LIGHT PANELS ═══ */}
      {[-9, -3, 3, 9].map((x) =>
        [-6, 0, 6].map((z) => (
          <group key={`led-${x}-${z}`} position={[x, ROOF_H - 0.05, z]}>
            {/* Light housing */}
            <mesh>
              <boxGeometry args={[2.5, 0.06, 1.2]} />
              <meshStandardMaterial
                color="#e2e8f0"
                emissive="#e0e8ff"
                emissiveIntensity={0.8}
                metalness={0.3}
                roughness={0.4}
              />
            </mesh>
            {/* Actual light source */}
            <pointLight
              position={[0, -0.2, 0]}
              color="#e8f0ff"
              intensity={0.8}
              distance={10}
              decay={2}
            />
          </group>
        )),
      )}

      {/* Safety line around production floor perimeter */}
      {[
        {
          pos: [0, 0.006, D / 2 - 0.5] as [number, number, number],
          size: [W - 1, 0.05] as [number, number],
        },
        {
          pos: [0, 0.006, -D / 2 + 0.5] as [number, number, number],
          size: [W - 1, 0.05] as [number, number],
        },
      ].map(({ pos, size }, i) => (
        <mesh
          key={`safety-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={pos}
        >
          <planeGeometry args={size} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.15} />
        </mesh>
      ))}
    </group>
  );
};

/* ── Day/Night Lighting Adjuster ─────────────────────── */

const DayNightLighting: React.FC<{ isNight: boolean }> = ({ isNight }) => {
  const { scene } = useThree();
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dayBackground = useMemo(() => new THREE.Color("#87CEEB"), []);
  const nightBackground = useMemo(() => new THREE.Color("#0a0e16"), []);

  useFrame(() => {
    // Smoothly transition background color
    const targetBg = isNight ? nightBackground : dayBackground;
    if (scene.background instanceof THREE.Color) {
      scene.background.lerp(targetBg, 0.02);
    }
    // Adjust ambient
    if (ambientRef.current) {
      const targetIntensity = isNight ? 0.7 : 1.8;
      ambientRef.current.intensity +=
        (targetIntensity - ambientRef.current.intensity) * 0.02;
    }
  });

  return (
    <ambientLight
      ref={ambientRef}
      intensity={0.7}
      color={isNight ? "#c8d6e5" : "#fff8f0"}
    />
  );
};

const LiveConveyorSystem: React.FC = React.memo(() => {
  const photoESensorActive = usePLCStore((s) => s.photoESensor);
  const motorFanOn = usePLCStore((s) => s.motorFanOn);
  const conveyorSpeedMultiplier = useDigitalTwinStore(
    (s) => s.conveyorSpeedMultiplier,
  );
  const running =
    photoESensorActive || motorFanOn || conveyorSpeedMultiplier > 0.01;

  return (
    <>
      <ConveyorBelt path={CONVEYOR_PATH} running={running} />
      <MaterialFlow path={CONVEYOR_PATH} active={running} />
    </>
  );
});

const LiveEmergencyLight: React.FC = React.memo(() => {
  const emergencyLightOn = usePLCStore((s) => s.emergencyLightOn);
  return <EmergencyLight active={emergencyLightOn} />;
});

/* ── Scene Content ───────────────────────────────────── */

const SceneContent: React.FC<{
  isNight: boolean;
  discoMode: boolean;
}> = React.memo(({ isNight, discoMode }) => {
  return (
    <>
      {/* Dynamic day/night ambient lighting */}
      <DayNightLighting isNight={isNight} />
      <directionalLight
        position={[15, 30, 12]}
        intensity={2.0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={80}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        color="#f0ecff"
      />
      <directionalLight
        position={[-10, 20, -8]}
        intensity={0.6}
        color="#dde4f0"
      />
      <hemisphereLight args={["#7aa2d4", "#1a2030", 0.8]} />

      {/* Bright overhead area lights per row — like real warehouse HID lamps */}
      <pointLight
        position={[-5, 5, 4]}
        color="#e0e8ff"
        intensity={1.15}
        distance={18}
        decay={2}
      />
      <pointLight
        position={[0, 5, 0]}
        color="#dde4ff"
        intensity={1.1}
        distance={18}
        decay={2}
      />
      <pointLight
        position={[5, 5, -4]}
        color="#e0e8ff"
        intensity={1.05}
        distance={18}
        decay={2}
      />

      {/* Accent colored uplights under each production row */}
      <pointLight
        position={[0, 0.3, 4]}
        color="#10b981"
        intensity={0.2}
        distance={8}
        decay={2}
      />
      <pointLight
        position={[0, 0.3, 0]}
        color="#3b82f6"
        intensity={0.18}
        distance={8}
        decay={2}
      />
      <pointLight
        position={[1.5, 0.3, -4]}
        color="#8b5cf6"
        intensity={0.2}
        distance={8}
        decay={2}
      />

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
      <LiveConveyorSystem />

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
      <LiveEmergencyLight />

      {/* 🎉 Easter Egg: Disco Ball */}
      {discoMode && <DiscoBall />}
    </>
  );
});

/* ── Main exported component ─────────────────────────── */

const FactoryScene: React.FC = () => {
  const [isNight, setIsNight] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [discoMode, setDiscoMode] = useState(false);
  const konamiProgress = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDayNight = useCallback((night: boolean) => {
    setIsNight(night);
  }, []);

  // 🎉 Secret word listener — type "party" to toggle disco mode
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const key = e.key.toLowerCase();
      if (key === SECRET_WORD[konamiProgress.current]) {
        konamiProgress.current++;
        if (konamiProgress.current === SECRET_WORD.length) {
          konamiProgress.current = 0;
          setDiscoMode((prev) => !prev);
        }
      } else {
        konamiProgress.current = key === SECRET_WORD[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        willChange: "transform",
        background: "#0a0e16",
      }}
    >
      <Canvas
        shadows={{ type: THREE.BasicShadowMap }}
        dpr={MAX_DPR}
        performance={{ min: 0.6, debounce: 200 }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
        }}
        camera={{ position: [18, 14, 18], fov: 40, near: 0.1, far: 120 }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color("#0a0e16");
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <AdaptiveDpr pixelated />
        <SceneContent isNight={isNight} discoMode={discoMode} />
      </Canvas>
      <SensorHUD />
      <FunControls onDayNightToggle={handleDayNight} />

      {/* Fullscreen toggle button */}
      <button
        onClick={toggleFullscreen}
        title={
          isFullscreen ? "Exit fullscreen (Esc or F)" : "Enter fullscreen (F)"
        }
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
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(59,130,246,0.2)";
          (e.currentTarget as HTMLButtonElement).style.color = "#dbeafe";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(10, 22, 40, 0.9)";
          (e.currentTarget as HTMLButtonElement).style.color = "#93c5fd";
        }}
      >
        <span style={{ fontSize: "16px", lineHeight: 1 }}>
          {isFullscreen ? "⛶" : "⛶"}
        </span>
        {isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
      </button>
    </div>
  );
};

export default FactoryScene;
