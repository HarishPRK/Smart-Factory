"use no memo";
import { useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import { STAGE_POSITIONS } from "./digitalTwinLayout";

interface FlyTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

let _flyTarget: FlyTarget | null = null;
let _onTargetReached: (() => void) | null = null;
let _autoTourActive = false;
let _autoTourStep = 0;

const TOUR_STOPS: {
  position: [number, number, number];
  lookAt: [number, number, number];
  dwell: number;
  label: string;
}[] = [
  { position: [-17.64, 11.72, 19.63], lookAt: [-3.08, -2.43, -1.14], dwell: 3, label: "Overview" },
  {
    position: [STAGE_POSITIONS.intake[0] - 6, 3, STAGE_POSITIONS.intake[2] + 5],
    lookAt: STAGE_POSITIONS.intake,
    dwell: 4,
    label: "Raw Material Intake",
  },
  {
    position: [
      STAGE_POSITIONS.forming[0] - 2,
      3,
      STAGE_POSITIONS.forming[2] + 4,
    ],
    lookAt: STAGE_POSITIONS.forming,
    dwell: 4,
    label: "Bottle Blow Molding",
  },
  {
    position: [
      STAGE_POSITIONS.mixing[0] + 3,
      2.5,
      STAGE_POSITIONS.mixing[2] + 3,
    ],
    lookAt: STAGE_POSITIONS.mixing,
    dwell: 4,
    label: "Pepsi Filling",
  },
  {
    position: [STAGE_POSITIONS.curing[0] + 3, 2, STAGE_POSITIONS.curing[2] + 3],
    lookAt: STAGE_POSITIONS.curing,
    dwell: 4,
    label: "Cooling Tunnel",
  },
  {
    position: [
      STAGE_POSITIONS.quality[0] - 3,
      2.5,
      STAGE_POSITIONS.quality[2] + 4,
    ],
    lookAt: STAGE_POSITIONS.quality,
    dwell: 4,
    label: "Quality Inspection",
  },
  {
    position: [
      STAGE_POSITIONS.packaging[0] + 3,
      3,
      STAGE_POSITIONS.packaging[2] + 3,
    ],
    lookAt: STAGE_POSITIONS.packaging,
    dwell: 3,
    label: "Packaging",
  },
  {
    position: [
      STAGE_POSITIONS.dispatch[0] + 5,
      4,
      STAGE_POSITIONS.dispatch[2] + 5,
    ],
    lookAt: STAGE_POSITIONS.dispatch,
    dwell: 4,
    label: "Dispatch",
  },
  { position: [0, 22, 1], lookAt: [0, 0, 0], dwell: 3, label: "Bird's Eye" },
  { position: [-12, 6, 10], lookAt: [0, 0, 0], dwell: 3, label: "Cinematic" },
];

export function setCameraTarget(
  position: [number, number, number],
  lookAt: [number, number, number],
  onReached?: () => void,
) {
  _flyTarget = {
    position: new THREE.Vector3(...position),
    lookAt: new THREE.Vector3(...lookAt),
  };
  _onTargetReached = onReached ?? null;
}

export function resetCameraView() {
  _autoTourActive = false;
  setCameraTarget([-17.64, 11.72, 19.63], [-3.08, -2.43, -1.14]);
}

export function startAutoTour() {
  _autoTourActive = true;
  _autoTourStep = 0;
  const stop = TOUR_STOPS[0];
  setCameraTarget(stop.position, stop.lookAt);
}

export function stopAutoTour() {
  _autoTourActive = false;
}

export function isAutoTourActive() {
  return _autoTourActive;
}

export function getAutoTourLabel(): string {
  if (!_autoTourActive) return "";
  return TOUR_STOPS[_autoTourStep % TOUR_STOPS.length]?.label ?? "";
}

const CameraController: React.FC = () => {
  const { camera, controls } = useThree();
  const lerpSpeed = 0.035;
  const dwellTimerRef = { current: 0 };

  // DEV camera-capture helper: orbit/pan/zoom to the framing you want, then
  // press "C" to log + copy the current camera position and orbit target.
  // Paste those numbers in to bake the view in as the default (Canvas camera,
  // OrbitControls target, resetCameraView, and the "Overview" tour stop).
  // Dev-only — stripped from production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key !== "c" && e.key !== "C") return;
      const oc = controls as unknown as OrbitControlsImpl | null;
      const t = oc?.target ?? new THREE.Vector3();
      const fmt = (v: THREE.Vector3) =>
        `[${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}]`;
      const out = `position: ${fmt(camera.position)}  target: ${fmt(t)}`;
      // eslint-disable-next-line no-console
      console.log("[camera]", out);
      navigator.clipboard?.writeText(out).catch(() => {});
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [camera, controls]);

  useFrame((_, delta) => {
    if (!_flyTarget) {
      // Auto-tour: dwell at current stop, then move to next
      if (_autoTourActive) {
        dwellTimerRef.current += delta;
        const stop = TOUR_STOPS[_autoTourStep % TOUR_STOPS.length];
        if (dwellTimerRef.current >= stop.dwell) {
          dwellTimerRef.current = 0;
          _autoTourStep = (_autoTourStep + 1) % TOUR_STOPS.length;
          const next = TOUR_STOPS[_autoTourStep];
          setCameraTarget(next.position, next.lookAt);
        }
      }
      return;
    }

    camera.position.lerp(_flyTarget.position, lerpSpeed);

    const orbitControls = controls as unknown as OrbitControlsImpl | null;
    if (orbitControls && orbitControls.target) {
      orbitControls.target.lerp(_flyTarget.lookAt, lerpSpeed);
      orbitControls.update();
    }

    const dist = camera.position.distanceTo(_flyTarget.position);
    if (dist < 0.1) {
      camera.position.copy(_flyTarget.position);
      if (orbitControls && orbitControls.target) {
        orbitControls.target.copy(_flyTarget.lookAt);
        orbitControls.update();
      }
      _flyTarget = null;
      if (_onTargetReached) {
        _onTargetReached();
        _onTargetReached = null;
      }
    }
  });

  return null;
};

export default CameraController;
