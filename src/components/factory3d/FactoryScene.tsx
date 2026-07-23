"use no memo";
import React, { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdaptiveDpr,
  ContactShadows,
  MeshReflectorMaterial,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";
import ConveyorBelt from "./ConveyorBelt";
import ProcessPipeline3D from "./ProcessPipeline3D";
import SensorHUD from "./SensorHUD";
import CameraController from "./CameraController";
import FactoryAtmosphere3D from "./FactoryAtmosphere3D";
import FactoryInfrastructure3D from "./FactoryInfrastructure3D";
import MaterialSourceDest3D from "./MaterialSourceDest3D";
import AnimatedMachinery3D from "./AnimatedMachinery3D";
import InteractiveOverlay3D from "./InteractiveOverlay3D";
import FunControls from "./FunControls";
import SelectedStagePanel from "./SelectedStagePanel";
import BottleProcessing3D from "./BottleProcessing3D";
import FactoryExtras3D from "./FactoryExtras3D";
import FactoryPremium3D from "./FactoryPremium3D";
import FactoryCompound3D from "./FactoryCompound3D";
import FactoryShowpiece3D from "./FactoryShowpiece3D";
import PostFxStack from "./PostFxStack";
import { CONVEYOR_PATH } from "./factoryLayout";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { usePLCStore } from "../../stores/plcStore";
import { useCaptureMode } from "../../hooks/useCaptureMode";
import { useSceneSettingsStore } from "../../stores/sceneSettingsStore";

/* â”€â”€ ðŸŽ‰ EASTER EGG: Disco Party Mode (Konami Code) â”€â”€â”€â”€ */

const SECRET_WORD = "party";
// Cap the canvas pixel ratio at 1.0. On HiDPI displays (Retina, 4K at scaling)
// the browser's default devicePixelRatio is 2.0â€“3.0, which means the renderer
// has to fill 4â€“9Ã— as many pixels per frame for no perceptible quality gain
// on a 3D scene of this complexity. Clamping to 1.0 is the single biggest
// fragment-shader-cost saving we can make; users on sharp displays lose a
// tiny amount of edge crispness but gain ~2â€“3Ã— frame headroom.
const MAX_DPR =
  typeof window === "undefined"
    ? 1
    : Math.min(window.devicePixelRatio || 1, 1.0);

function RendererConfig() {
  const gl = useThree((s) => s.gl);
  React.useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);
  return null;
}

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

/* â”€â”€ Emergency Light â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€ Ambient Dust Particles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€ Modern Factory Building â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const OpenFloor: React.FC = () => {
  const W = 46; // floor width (X)
  const D = 32; // floor depth (Z)

  const postFxQuality = useSceneSettingsStore((s) => s.postFxQuality);
  // MeshReflectorMaterial runs a second render pass of the scene for the
  // reflection â€” reserved for "high"/"ultra" only. At "medium" (the new
  // default) and below we fall through to a plain glossy meshStandardMaterial
  // floor, saving ~0.7 ms/frame.
  const reflectiveFloor = postFxQuality === "high" || postFxQuality === "ultra";

  return (
    <group>
      {/* â•â•â• REFLECTIVE EPOXY FLOOR â•â•â• */}
      {/* Outer ground â€” lifted from near-black to mid-graphite so the
          factory floor reads "polished concrete" instead of "void". */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[60, 50]} />
        <meshStandardMaterial color="#1f2937" metalness={0.2} roughness={0.78} />
      </mesh>

      {/* Main factory floor â€” high-gloss epoxy (mirror-reflective on MED+) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.0, 0]}
        receiveShadow
      >
        <planeGeometry args={[W, D]} />
        {reflectiveFloor ? (
          <MeshReflectorMaterial
            color="#2a3548"
            metalness={0.35}
            roughness={0.7}
            blur={[300, 100]}
            mixBlur={3}
            mixStrength={0.4}
            mirror={0.18}
            resolution={256}
            depthScale={1.2}
            minDepthThreshold={0.8}
            maxDepthThreshold={1.4}
          />
        ) : (
          <meshStandardMaterial
            color="#33405a"
            metalness={0.5}
            roughness={0.35}
            envMapIntensity={0.6}
          />
        )}
      </mesh>

      {/* Floor grid lines â€” subtle modern pattern */}
      {Array.from({ length: 16 }, (_, i) => i - 7).map((x) => (
        <mesh
          key={`gx${x}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[x * 2, 0.003, 0]}
        >
          <planeGeometry args={[0.008, D]} />
          <meshBasicMaterial color="#6b7468" transparent opacity={0.22} />
        </mesh>
      ))}
      {Array.from({ length: 12 }, (_, i) => i - 5).map((z) => (
        <mesh
          key={`gz${z}`}
          rotation={[-Math.PI / 2, 0, Math.PI / 2]}
          position={[0, 0.003, z * 2]}
        >
          <planeGeometry args={[0.008, W]} />
          <meshBasicMaterial color="#6b7468" transparent opacity={0.22} />
        </mesh>
      ))}

      {/* Row pathway highlights — neutral lavender, no colour accent */}
      {[
        { z: 4, color: "#9a93b8" },
        { z: 0, color: "#9a93b8" },
        { z: -4, color: "#9a93b8" },
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

      {/* Steel frame structure and glass walls removed â€” open factory floor
          with no surrounding enclosure, per the user's request. Roof was
          already removed earlier for top-down visibility. */}

      {/* LED ceiling panels removed â€” overhead fixtures were visible through
          the open roof and distracted from the factory floor. Core directional +
          hemisphere + pointLights from SceneContent already provide lighting. */}

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

/* â”€â”€ Day/Night Lighting Adjuster â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const DayNightLighting: React.FC<{ isNight: boolean; useIBL: boolean }> = ({
  isNight,
  useIBL,
}) => {
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
    // Ambient â€” legacy fill uses full intensity; IBL tier uses a tiny top-up
    if (ambientRef.current) {
      const nightTarget = useIBL ? 0.12 : 1.05;
      const dayTarget = useIBL ? 0.3 : 2.1;
      const targetIntensity = isNight ? nightTarget : dayTarget;
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

/**
 * Legacy fill rig â€” hemisphere + 3 overhead HID point lights + a fill
 * directional. Used on HIGH/MED/LOW tiers where HDRI IBL isn't active.
 * On ULTRA the HDRI environment replaces all of these.
 */
const LegacyFillLights: React.FC = () => (
  <>
    <directionalLight
      position={[-10, 20, -8]}
      intensity={0.85}
      color="#dde4f0"
    />
    <hemisphereLight args={["#9bbde0", "#3a4256", 1.2]} />
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
  </>
);

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
    </>
  );
});

const LiveEmergencyLight: React.FC = React.memo(() => {
  const emergencyLightOn = usePLCStore((s) => s.emergencyLightOn);
  return <EmergencyLight active={emergencyLightOn} />;
});

/* â”€â”€ Scene Content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const SceneContent: React.FC<{
  isNight: boolean;
  discoMode: boolean;
}> = React.memo(({ isNight, discoMode }) => {
  const particlesEnabled = useSceneSettingsStore((s) => s.particlesEnabled);
  const extrasEnabled = useSceneSettingsStore((s) => s.extrasEnabled);
  const cctvEnabled = useSceneSettingsStore((s) => s.cctvEnabled);
  return (
    <>
      {/* Legacy fill lighting for all tiers. Post-processing (Phase 2) will
          differentiate ULTRA visually instead of IBL, which fights this scene's
          hand-tuned material palette. */}
      <DayNightLighting isNight={isNight} useIBL={false} />
      <LegacyFillLights />
      <directionalLight
        position={[15, 30, 12]}
        intensity={1.8}
        castShadow
        // Shadow map dropped 4096Â² â†’ 2048Â² (quarter the pixels). This was the
        // single most expensive per-frame cost â€” a 4k depth rasterization
        // across ~50 cast-shadow meshes. At this frame target (120 Hz) 2k is
        // still visually identical on a full-screen canvas.
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
        shadow-camera-far={80}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        color="#f0ecff"
      />
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.55}
        scale={80}
        blur={2.4}
        far={6}
        // 1024 â†’ 512: contact shadows are soft anyway, half-res is imperceptible.
        resolution={512}
        frames={1}
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
        color="#75b0ea"
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

      {/* Depth fog â€” lighter & further-out so the brighter concrete floor
          doesn't get drowned in haze on wider screens. */}
      <fog attach="fog" args={["#1a2638", 60, 110]} />

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
        target={[-3.08, -2.43, -1.14]}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
      <CameraController />

      {/* Open floor â€” no walls or roof */}
      <OpenFloor />
      {particlesEnabled && <AmbientParticles />}

      {/* Zig-zag Conveyor Belt */}
      <LiveConveyorSystem />

      {/* Digital Twin Manufacturing Pipeline (stages + robots + workers) */}
      <ProcessPipeline3D />

      {/* Animated atmosphere â€” steam, sparks, glowing effects */}
      {particlesEnabled && <FactoryAtmosphere3D />}

      {/* Ground infrastructure â€” pipe racks, walkways, signage */}
      <FactoryInfrastructure3D />

      {/* Raw material source + finished goods dispatch */}
      <MaterialSourceDest3D />

      {/* Animated machinery overlays â€” spinning, pressing, sweeping */}
      <AnimatedMachinery3D />

      {/* Interactive overlays â€” click workers, robots, silos, trucks */}
      <InteractiveOverlay3D />

      {/* Emergency-response red-alert responders removed per request — they
          spawned a red floating label whenever a stage went faulted/warning.
          Re-add <EmergencyResponse3D /> (and its import) to restore. */}

      {/* Water filling, capping, labeling & rejection stations */}
      <BottleProcessing3D />

      {/* Extra details â€” reservoir, counters, energy meter, shift, QR scanner */}
      {extrasEnabled && <FactoryExtras3D />}

      {/* Premium features â€” CCTV, clock, smoke, LEDs, bins, antenna, waves, turntables */}
      {cctvEnabled && <FactoryPremium3D />}

      {/* Factory compound â€” parking, solar, cooling tower, guard booth, flags */}
      {extrasEnabled && <FactoryCompound3D />}

      {/* Showpiece â€” AI orb, data streams, helicopter, scoreboard, welding, holo table */}
      {extrasEnabled && <FactoryShowpiece3D />}

      {/* Emergency light */}
      <LiveEmergencyLight />

      {/* ðŸŽ‰ Easter Egg: Disco Ball */}
      {discoMode && <DiscoBall />}
    </>
  );
});

/* â”€â”€ Main exported component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const FactoryScene: React.FC<{
  /** Freeze the WebGL render loop (e.g. while a full-screen modal covers the
   *  scene) so the GPU is free for whatever is on top. */
  paused?: boolean;
}> = ({ paused = false }) => {
  const [isNight, setIsNight] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [discoMode, setDiscoMode] = useState(false);
  const konamiProgress = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const captureMode = useCaptureMode();

  const handleDayNight = useCallback((night: boolean) => {
    setIsNight(night);
  }, []);

  // ðŸŽ‰ Secret word listener â€” type "party" to toggle disco mode
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
        // `shadows=true` uses plain PCF sampling (basic PCFShadowMap); "soft"
        // uses PCFSoftShadowMap which costs ~30 % more fragment work per
        // shadowed pixel for barely-visible extra softness. At 120 Hz that
        // 30 % matters.
        shadows
        // "never" halts the render loop entirely while a full-screen modal
        // hides the scene — on integrated GPUs the scene otherwise keeps
        // burning the whole GPU budget behind the overlay.
        frameloop={paused ? "never" : "always"}
        dpr={MAX_DPR}
        performance={{ min: 0.6, debounce: 200 }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        camera={{ position: [-17.64, 11.72, 19.63], fov: 40, near: 0.1, far: 120 }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color("#0a0e16");
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <RendererConfig />
        {!captureMode && <AdaptiveDpr pixelated />}
        <SceneContent isNight={isNight} discoMode={discoMode} />
        <PostFxStack />
      </Canvas>
      <SensorHUD />
      <SelectedStagePanel />
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
          fontFamily: "'Montserrat', system-ui, sans-serif",
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
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path
            d={isFullscreen
              ? "M6 2v2.5a1.5 1.5 0 0 1-1.5 1.5H2M10 2v2.5A1.5 1.5 0 0 0 11.5 6H14M6 14v-2.5A1.5 1.5 0 0 0 4.5 10H2m8 4v-2.5a1.5 1.5 0 0 1 1.5-1.5H14"
              : "M2 6V3.5A1.5 1.5 0 0 1 3.5 2H6m4 0h2.5A1.5 1.5 0 0 1 14 3.5V6m0 4v2.5a1.5 1.5 0 0 1-1.5 1.5H10m-4 0H3.5A1.5 1.5 0 0 1 2 12.5V10"}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
      </button>
    </div>
  );
};

export default FactoryScene;
