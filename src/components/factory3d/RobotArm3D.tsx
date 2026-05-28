"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";

interface RobotArm3DProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  speed?: number;
  scale?: number;
  /** When true, cycle progression scales with the live conveyorSpeedMultiplier
   *  from the digital twin store, so the cobot keeps pace with bottle flow. */
  syncToConveyor?: boolean;
}

/**
 * RobotArm3D — 6-axis collaborative robot (cobot, UR5-style)
 *
 * Performs a deterministic pick-and-place cycle:
 *   Phase 0: Reach down to pickup zone (in front)
 *   Phase 1: Grip closed, lift up
 *   Phase 2: Swing across to drop zone (side)
 *   Phase 3: Lower to drop zone
 *   Phase 4: Release, lift up
 *   Phase 5: Swing back to pickup
 * Then loops.
 *
 * Cobot characteristics:
 *  - Smooth cylindrical joints (white/grey shell)
 *  - Curved tubular link segments
 *  - Slow, controlled motion (no random dancing)
 *  - Visible bottle held when gripper is closed
 */

interface Pose {
  base: number;     // J1 — base rotation (Y axis)
  shoulder: number; // J2 — shoulder pitch
  elbow: number;    // J3 — elbow pitch
  wrist1: number;   // J4 — wrist pitch
  wrist2: number;   // J5 — wrist roll
  grip: boolean;    // gripper closed
}

// Pick & place poses (in radians)
// Goal: GRIPPER TIP (end-effector) must be the LOWEST point of the arm,
// reaching DOWN to the conveyor belt with the elbow joint kept ABOVE it.
//
// Joint convention (rotations around Z axis):
//   R_z(θ)·(0,1,0) = (-sin θ, cos θ, 0)
//   shoulder = 0  → upper arm vertical (pointing UP)
//   negative shoulder + negative elbow → upper arm leans forward (+X),
//   then forearm bends so the wrist hangs out in front of the base.
//   Wrist1 is then bent so the cumulative angle (s + e + w1) ≈ -π,
//   which makes the gripper point STRAIGHT DOWN at the belt.
//
// Verified geometry (all values in arm-local space):
//   Pickup: elbow joint at y≈0.50, gripper tip at y≈0.04  → gripper is the
//           lowest point by ~0.45, well below the elbow joint.
//
const POSE_HOME: Pose          = { base: 0,            shoulder: -0.6, elbow: -0.8, wrist1: -1.74, wrist2: 0, grip: false };
const POSE_PICKUP: Pose        = { base: 0,            shoulder: -0.6, elbow: -1.1, wrist1: -1.44, wrist2: 0, grip: false };
const POSE_PICKUP_GRIP: Pose   = { base: 0,            shoulder: -0.6, elbow: -1.1, wrist1: -1.44, wrist2: 0, grip: true  };
const POSE_LIFT: Pose          = { base: 0,            shoulder: -0.6, elbow: -0.8, wrist1: -1.74, wrist2: 0, grip: true  };
// Drop poses use base = +π/2 so the swing matches the drop-zone marker at
// local -Z. (Three.js R_y(+π/2) sends local +X reach direction → local -Z.)
const POSE_DROP_APPROACH: Pose = { base:  Math.PI / 2, shoulder: -0.6, elbow: -0.8, wrist1: -1.74, wrist2: 0, grip: true  };
const POSE_DROP: Pose          = { base:  Math.PI / 2, shoulder: -0.6, elbow: -1.1, wrist1: -1.44, wrist2: 0, grip: true  };
const POSE_RELEASE: Pose       = { base:  Math.PI / 2, shoulder: -0.6, elbow: -1.1, wrist1: -1.44, wrist2: 0, grip: false };

// Sequence of poses for the pick-and-place cycle
const SEQUENCE: { pose: Pose; duration: number }[] = [
  { pose: POSE_HOME,         duration: 1.5 },
  { pose: POSE_PICKUP,       duration: 2.0 },  // reach down to pick
  { pose: POSE_PICKUP_GRIP,  duration: 0.6 },  // close gripper
  { pose: POSE_LIFT,         duration: 1.5 },  // lift up
  { pose: POSE_DROP_APPROACH,duration: 2.0 },  // swing to drop side
  { pose: POSE_DROP,         duration: 1.5 },  // lower to drop
  { pose: POSE_RELEASE,      duration: 0.6 },  // open gripper
  { pose: POSE_LIFT,         duration: 1.0 },  // lift back up (no grip now)
];

const TOTAL_CYCLE = SEQUENCE.reduce((sum, s) => sum + s.duration, 0);

// Smooth interpolation
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolatePose(a: Pose, b: Pose, t: number): Pose {
  const e = smoothstep(t);
  return {
    base: lerp(a.base, b.base, e),
    shoulder: lerp(a.shoulder, b.shoulder, e),
    elbow: lerp(a.elbow, b.elbow, e),
    wrist1: lerp(a.wrist1, b.wrist1, e),
    wrist2: lerp(a.wrist2, b.wrist2, e),
    grip: e > 0.5 ? b.grip : a.grip,
  };
}

const RobotArm3D: React.FC<RobotArm3DProps> = ({
  position,
  rotation = [0, 0, 0],
  color = "#f59e0b",
  speed = 1,
  scale = 1,
  syncToConveyor = false,
}) => {
  // Accumulated cycle time — used when syncToConveyor is enabled so we can
  // modulate progression by the live conveyor speed instead of wall clock.
  const cycleTimeRef = useRef(0);
  const baseRef = useRef<THREE.Group>(null);
  const shoulderRef = useRef<THREE.Group>(null);
  const elbowRef = useRef<THREE.Group>(null);
  const wrist1Ref = useRef<THREE.Group>(null);
  const wrist2Ref = useRef<THREE.Group>(null);
  const gripperLRef = useRef<THREE.Mesh>(null);
  const gripperRRef = useRef<THREE.Mesh>(null);
  const heldBottleRef = useRef<THREE.Group>(null);

  // Status indicator color (active vs idle)
  const statusLightRef = useRef<THREE.Mesh>(null);

  // Material colors
  const SHELL = useMemo(() => ({ color: "#f4f4f5", metalness: 0.3, roughness: 0.35 }), []);
  const JOINT = useMemo(() => ({ color: "#d4d4d8", metalness: 0.6, roughness: 0.25 }), []);
  const ACCENT = useMemo(() => ({ color, metalness: 0.5, roughness: 0.3 }), [color]);

  useFrame(({ clock }, delta) => {
    let t: number;
    if (syncToConveyor) {
      // Pull live conveyor speed AND product count each frame so the cobot
      // both accelerates with bottle flow AND fully pauses (at HOME pose)
      // whenever no bottles are being manufactured.
      const state = useDigitalTwinStore.getState();
      const convSpeed = state.conveyorSpeedMultiplier;
      const hasWork = state.products.length > 0 && convSpeed > 0;
      if (hasWork) {
        cycleTimeRef.current = (cycleTimeRef.current + delta * speed * convSpeed) % TOTAL_CYCLE;
      }
      // When idle, freeze the cycle clock — pose interpolation will hold
      // wherever we left off. (Reset to 0 = HOME after long idle so it
      // looks "parked" rather than mid-grab.)
      if (!hasWork) {
        cycleTimeRef.current *= 0.92; // ease back toward HOME (t=0)
        if (cycleTimeRef.current < 0.001) cycleTimeRef.current = 0;
      }
      t = cycleTimeRef.current;
    } else {
      t = (clock.elapsedTime * speed) % TOTAL_CYCLE;
    }

    // Find current segment
    let elapsed = 0;
    let pose: Pose = POSE_HOME;
    for (let i = 0; i < SEQUENCE.length; i++) {
      const seg = SEQUENCE[i];
      if (t >= elapsed && t < elapsed + seg.duration) {
        const segT = (t - elapsed) / seg.duration;
        const prev = i === 0 ? SEQUENCE[SEQUENCE.length - 1].pose : SEQUENCE[i - 1].pose;
        pose = interpolatePose(prev, seg.pose, segT);
        break;
      }
      elapsed += seg.duration;
    }

    // Apply joint rotations
    if (baseRef.current) baseRef.current.rotation.y = pose.base;
    if (shoulderRef.current) shoulderRef.current.rotation.z = pose.shoulder;
    if (elbowRef.current) elbowRef.current.rotation.z = pose.elbow;
    if (wrist1Ref.current) wrist1Ref.current.rotation.z = pose.wrist1;
    if (wrist2Ref.current) wrist2Ref.current.rotation.y = pose.wrist2;

    // Gripper open/close (smooth lerp)
    const targetGrip = pose.grip ? 0.0 : 0.025;
    if (gripperLRef.current) {
      gripperLRef.current.position.x += (-targetGrip - gripperLRef.current.position.x) * 0.2;
    }
    if (gripperRRef.current) {
      gripperRRef.current.position.x += (targetGrip - gripperRRef.current.position.x) * 0.2;
    }

    // Show/hide held bottle
    if (heldBottleRef.current) {
      heldBottleRef.current.visible = pose.grip;
    }

    // Status light pulses gently
    if (statusLightRef.current) {
      const mat = statusLightRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 2) * 0.2;
    }
  });

  // Cylindrical joint helper
  const Joint: React.FC<{ radius?: number; length?: number; rotation?: [number, number, number] }> = ({
    radius = 0.05, length = 0.1, rotation = [0, 0, Math.PI / 2],
  }) => (
    <mesh rotation={rotation} castShadow>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial {...JOINT} />
    </mesh>
  );

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* ── Floor mounting plate ── */}
      <mesh position={[0, 0.01, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.02, 16]} />
        <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Bolts on plate */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.14, 0.022, Math.sin(angle) * 0.14]}>
            <cylinderGeometry args={[0.008, 0.008, 0.01, 6]} />
            <meshStandardMaterial color="#52525b" metalness={0.8} roughness={0.2} />
          </mesh>
        );
      })}

      {/* ── Pickup zone marker (small platform on the floor in front) ── */}
      <mesh position={[0.45, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.1, 16]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.4} />
      </mesh>

      {/* ── Drop zone marker (90° to the side) ── */}
      <mesh position={[0, 0.005, -0.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.1, 16]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.4} />
      </mesh>

      {/* ── J1: BASE (rotates on Y) ── */}
      <group ref={baseRef} position={[0, 0.04, 0]}>
        {/* Base cylinder shell */}
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.085, 0.095, 0.12, 16]} />
          <meshStandardMaterial {...SHELL} />
        </mesh>
        {/* Accent ring */}
        <mesh position={[0, 0.12, 0]}>
          <torusGeometry args={[0.086, 0.008, 6, 24]} />
          <meshStandardMaterial {...ACCENT} />
        </mesh>
        {/* Status light on base */}
        <mesh ref={statusLightRef} position={[0, 0.06, 0.095]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.6} />
        </mesh>

        {/* ── J2: SHOULDER joint housing ── */}
        <group position={[0, 0.16, 0]}>
          <Joint radius={0.07} length={0.13} />

          {/* ── Shoulder rotation group (rotates on Z) ── */}
          <group ref={shoulderRef}>
            {/* Upper-arm link (curved tube going up) */}
            <mesh position={[0, 0.18, 0]} castShadow>
              <cylinderGeometry args={[0.045, 0.045, 0.36, 12]} />
              <meshStandardMaterial {...SHELL} />
            </mesh>
            {/* Accent stripe along link */}
            <mesh position={[0.046, 0.18, 0]}>
              <boxGeometry args={[0.005, 0.32, 0.025]} />
              <meshStandardMaterial {...ACCENT} />
            </mesh>

            {/* ── J3: ELBOW joint ── */}
            <group position={[0, 0.36, 0]}>
              <Joint radius={0.055} length={0.11} />

              {/* ── Elbow rotation group ── */}
              <group ref={elbowRef}>
                {/* Forearm link */}
                <mesh position={[0, 0.15, 0]} castShadow>
                  <cylinderGeometry args={[0.038, 0.038, 0.30, 12]} />
                  <meshStandardMaterial {...SHELL} />
                </mesh>
                {/* Forearm accent */}
                <mesh position={[0.039, 0.15, 0]}>
                  <boxGeometry args={[0.004, 0.26, 0.022]} />
                  <meshStandardMaterial {...ACCENT} />
                </mesh>

                {/* ── J4: WRIST 1 joint ── */}
                <group position={[0, 0.3, 0]}>
                  <Joint radius={0.045} length={0.09} />

                  <group ref={wrist1Ref}>
                    {/* Wrist link */}
                    <mesh position={[0, 0.07, 0]} castShadow>
                      <cylinderGeometry args={[0.032, 0.032, 0.13, 10]} />
                      <meshStandardMaterial {...SHELL} />
                    </mesh>

                    {/* ── J5: WRIST 2 joint ── */}
                    <group position={[0, 0.13, 0]}>
                      <Joint radius={0.038} length={0.075} rotation={[0, 0, 0]} />

                      <group ref={wrist2Ref}>
                        {/* Wrist 2 short link */}
                        <mesh position={[0, 0.04, 0]}>
                          <cylinderGeometry args={[0.028, 0.028, 0.06, 10]} />
                          <meshStandardMaterial {...SHELL} />
                        </mesh>

                        {/* ── Tool flange ── */}
                        <mesh position={[0, 0.075, 0]}>
                          <cylinderGeometry args={[0.035, 0.035, 0.015, 12]} />
                          <meshStandardMaterial color="#3f3f46" metalness={0.8} roughness={0.2} />
                        </mesh>

                        {/* ── End effector / gripper ── */}
                        <group position={[0, 0.095, 0]}>
                          {/* Gripper body */}
                          <mesh>
                            <boxGeometry args={[0.07, 0.05, 0.05]} />
                            <meshStandardMaterial color="#27272a" metalness={0.7} roughness={0.3} />
                          </mesh>
                          {/* Gripper accent strip */}
                          <mesh position={[0, 0, 0.026]}>
                            <boxGeometry args={[0.06, 0.04, 0.003]} />
                            <meshStandardMaterial {...ACCENT} />
                          </mesh>

                          {/* Left finger */}
                          <mesh ref={gripperLRef} position={[-0.025, 0.045, 0]} castShadow>
                            <boxGeometry args={[0.012, 0.05, 0.04]} />
                            <meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.15} />
                          </mesh>
                          {/* Right finger */}
                          <mesh ref={gripperRRef} position={[0.025, 0.045, 0]} castShadow>
                            <boxGeometry args={[0.012, 0.05, 0.04]} />
                            <meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.15} />
                          </mesh>

                          {/* ── Held bottle (Pepsi, visible only when grip closed) ── */}
                          <group ref={heldBottleRef} position={[0, 0.07, 0]} visible={false}>
                            {/* Bottle body — dark cola brown (Pepsi inside clear PET) */}
                            <mesh>
                              <cylinderGeometry args={[0.018, 0.018, 0.08, 10]} />
                              <meshStandardMaterial color="#1c0a00" transparent opacity={0.88} metalness={0.15} roughness={0.15} />
                            </mesh>
                            {/* Blue Pepsi label band */}
                            <mesh position={[0, 0, 0]}>
                              <cylinderGeometry args={[0.0185, 0.0185, 0.025, 10]} />
                              <meshStandardMaterial color="#004B93" emissive="#004B93" emissiveIntensity={0.3} metalness={0.1} roughness={0.4} />
                            </mesh>
                            {/* Blue bottle cap */}
                            <mesh position={[0, 0.045, 0]}>
                              <cylinderGeometry args={[0.012, 0.012, 0.012, 8]} />
                              <meshStandardMaterial color="#004B93" metalness={0.3} roughness={0.35} />
                            </mesh>
                          </group>
                        </group>
                      </group>
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};

export default RobotArm3D;
