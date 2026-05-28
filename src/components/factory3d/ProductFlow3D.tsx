"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { isBlowMolderEngaged } from "./InlineMachine3D";

interface ProductFlow3DProps {
  path: [number, number, number][];
}

// Halved from 160 → 80: 80 slots still fills the full zig-zag belt densely
// enough to look continuous (one bottle every ~25 cm of belt), and halves
// the per-frame matrix/color update cost across 6 InstancedMesh buffers.
const MAX_PRODUCTS = 80;

/**
 * ISBM Manufacturing Stages (Injection Stretch Blow Molding):
 *
 *  0.00–0.10  PELLETS   — PET resin pellets (clear + blue masterbatch)
 *  0.10–0.25  MOLTEN    — melted resin being injected (growing cylinder in mold)
 *  0.25–0.40  PREFORM   — solidified test-tube with finished neck threads
 *  0.40–0.55  HEATED    — preform reheated in IR oven (emissive glow)
 *  0.55–0.75  BLOWN     — stretch-blow molded bottle (morph from tube to bottle)
 *  0.75–0.90  FINISHED  — cooled rigid bottle (high-gloss clear)
 *  0.90–1.00  PACKAGED  — shrink-wrapped carton
 */
const Stage = {
  PELLET: 0,
  PREFORM: 1,
  BOTTLE: 2,
  PACKAGED: 3,
} as const;

type Stage = (typeof Stage)[keyof typeof Stage];

// New Pepsi bottling sequence conveyor t-values:
//   intake=0.04 → forming=0.18 (center) → filling=0.40 → cooling=0.55 →
//   quality=0.72 → packaging=0.85 → dispatch=0.96
// Blow molder spans: entrance ~0.16, center 0.18, exit ~0.20
function classifyStage(progress: number): Stage {
  if (progress < 0.1) return Stage.PELLET; // raw pellets (intake area)
  if (progress < 0.19) return Stage.PREFORM; // preform until exiting blow molder
  if (progress < 0.9) return Stage.BOTTLE; // bottle emerges at 0.19+ (empty then filled)
  return Stage.PACKAGED; // carton (post case-packing)
}

// Cobot pickup hide-zone: bottles whose progress lands inside this window are
// not rendered, so visually they "vanish into" the packaging cobot's gripper.
const COBOT_HIDE_START = 0.83;
const COBOT_HIDE_END = 0.9;

// Forming tunnel - NO HIDING - show transformation inside the machine!
// STAGE_CONVEYOR_T.forming = 0.18, tunnel is ~3 units on ~80-unit path.
const FORMING_ZONE_START = 0.16;
const FORMING_ZONE_END = 0.2;

// Filling station - bottles now STAY VISIBLE during filling!
// The color transition from empty (light blue) to filled (dark brown)
// happens gradually as they pass through the filling station.
// STAGE_CONVEYOR_T.mixing (filling) = 0.40.

// ── Bottle profile — 10x larger base so scales don't need to be huge ──
function createBottleGeometry(): THREE.LatheGeometry {
  const s = 10; // scale factor baked into geometry
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0 * s, 0.0 * s),
    new THREE.Vector2(0.035 * s, 0.0 * s),
    new THREE.Vector2(0.038 * s, 0.005 * s),
    new THREE.Vector2(0.038 * s, 0.015 * s),
    new THREE.Vector2(0.04 * s, 0.025 * s),
    new THREE.Vector2(0.042 * s, 0.04 * s),
    new THREE.Vector2(0.039 * s, 0.05 * s),
    new THREE.Vector2(0.042 * s, 0.06 * s),
    new THREE.Vector2(0.039 * s, 0.07 * s),
    new THREE.Vector2(0.042 * s, 0.08 * s),
    new THREE.Vector2(0.039 * s, 0.09 * s),
    new THREE.Vector2(0.042 * s, 0.1 * s),
    new THREE.Vector2(0.042 * s, 0.12 * s),
    new THREE.Vector2(0.04 * s, 0.13 * s),
    new THREE.Vector2(0.035 * s, 0.14 * s),
    new THREE.Vector2(0.025 * s, 0.15 * s),
    new THREE.Vector2(0.014 * s, 0.158 * s),
    new THREE.Vector2(0.013 * s, 0.165 * s),
    new THREE.Vector2(0.015 * s, 0.167 * s),
    new THREE.Vector2(0.015 * s, 0.17 * s),
    new THREE.Vector2(0.013 * s, 0.172 * s),
    new THREE.Vector2(0.016 * s, 0.174 * s),
    new THREE.Vector2(0.016 * s, 0.185 * s),
    new THREE.Vector2(0.0 * s, 0.185 * s),
  ];
  return new THREE.LatheGeometry(pts, 16);
}

// ── Preform — 10x larger base ──
function createPreformGeometry(): THREE.LatheGeometry {
  const s = 10;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0 * s, 0.0 * s),
    new THREE.Vector2(0.008 * s, 0.002 * s),
    new THREE.Vector2(0.014 * s, 0.008 * s),
    new THREE.Vector2(0.016 * s, 0.02 * s),
    new THREE.Vector2(0.016 * s, 0.06 * s),
    new THREE.Vector2(0.016 * s, 0.08 * s),
    new THREE.Vector2(0.015 * s, 0.09 * s),
    new THREE.Vector2(0.014 * s, 0.095 * s),
    new THREE.Vector2(0.013 * s, 0.1 * s),
    new THREE.Vector2(0.015 * s, 0.102 * s),
    new THREE.Vector2(0.015 * s, 0.105 * s),
    new THREE.Vector2(0.013 * s, 0.107 * s),
    new THREE.Vector2(0.016 * s, 0.109 * s),
    new THREE.Vector2(0.016 * s, 0.12 * s),
    new THREE.Vector2(0.0 * s, 0.12 * s),
  ];
  return new THREE.LatheGeometry(pts, 12);
}

const ProductFlow3D: React.FC<ProductFlow3DProps> = ({ path }) => {
  const pelletRef = useRef<THREE.InstancedMesh>(null);
  const preformRef = useRef<THREE.InstancedMesh>(null);
  const bottleRef = useRef<THREE.InstancedMesh>(null);
  const labelRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const packageRef = useRef<THREE.InstancedMesh>(null);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  const hideMatrix = useMemo(
    () => new THREE.Matrix4().makeTranslation(0, -100, 0),
    [],
  );
  const unitScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  const bottleGeo = useMemo(() => createBottleGeometry(), []);
  const preformGeo = useMemo(() => createPreformGeometry(), []);

  const curve = useMemo(() => {
    const points = path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.3);
  }, [path]);

  const getPathPosition = (t: number) => {
    const clampedT = Math.max(0, Math.min(1, t));
    curve.getPointAt(clampedT, tempPos);
    tempPos.y += 0.18;
  };

  useFrame(({ clock }) => {
    // Filling Station Manager - handles stop-and-fill behavior
    const FILLING_ZONE_START = 0.38;
    const FILLING_ZONE_END = 0.42;
    const NOZZLE_POSITIONS = [0.385, 0.395, 0.405, 0.415];
    const FILL_TIME = 2.0; // seconds

    const meshes = [
      pelletRef.current,
      preformRef.current,
      bottleRef.current,
      packageRef.current,
    ];
    if (!meshes[0] || !meshes[1] || !meshes[2] || !meshes[3]) return;

    const products = useDigitalTwinStore.getState().products;
    const visibleCount = Math.min(products.length, MAX_PRODUCTS);
    const t = clock.elapsedTime;
    const moldEngaged = isBlowMolderEngaged(t);

    const counts = [0, 0, 0, 0];

    for (let i = 0; i < visibleCount; i++) {
      const product = products[i];
      const stage = classifyStage(product.progress);

      // Blow-molder — hide products that land inside the forming zone while
      // the press cycle has the die closed. Without this, bottles visibly
      // slide *through* the solid mold halves. Only the window [0.16, 0.20]
      // is affected, so products arriving before the mold or leaving after
      // remain visible.
      if (
        moldEngaged &&
        product.progress >= FORMING_ZONE_START &&
        product.progress < FORMING_ZONE_END
      ) {
        continue;
      }

      // Bottles are now visible through the glass filling station enclosure!
      // The color transition from empty (light blue) to filled (dark brown)
      // happens as they pass through, visible in real-time.

      // Hide bottles inside the packaging cobot's pickup zone — the cobot
      // animation visually "consumes" them, and they reappear as packaged
      // cartons further down the belt.
      if (
        stage === Stage.BOTTLE &&
        product.progress >= COBOT_HIDE_START &&
        product.progress < COBOT_HIDE_END
      ) {
        continue;
      }

      // Bottles flow continuously through filling station
      getPathPosition(product.progress);

      // ── Stage-specific scale + visual behavior ──
      let sx: number, sy: number, sz: number;
      let color = product.color;

      // Geometries are 10x baked (bottle radius 0.42, height 1.85).
      // Sizes tuned so a finished bottle is ~0.07 wide × ~0.30 tall — about
      // half a worker's height, the right scale relative to the cobot's
      // gripper and the stage equipment.
      switch (stage) {
        case Stage.PELLET: {
          const bounce = Math.sin(t * 4 + i * 2) * 0.008;
          sx = 1.2;
          sy = 1.2 + bounce;
          sz = 1.2;
          break;
        }
        case Stage.PREFORM: {
          const subProgress = (product.progress - 0.1) / 0.3;
          if (subProgress < 0.5) {
            const growT = subProgress * 2;
            sx = 0.26;
            sy = 0.16 + growT * 0.16;
            sz = 0.26;
            color = "#f59e0b";
          } else if (subProgress < 0.7) {
            sx = 0.26;
            sy = 0.32;
            sz = 0.26;
            color = "#93c5fd";
          } else {
            sx = 0.26;
            sy = 0.32;
            sz = 0.26;
            const heatPulse = 0.5 + Math.sin(t * 3 + i) * 0.5;
            color = heatPulse > 0.5 ? "#fb923c" : "#fdba74";
          }
          break;
        }
        case Stage.BOTTLE: {
          // Bottle appearance depends on whether it's been through the
          // filling station (STAGE_CONVEYOR_T.mixing = 0.40).
          // Before filling: clear/empty bottle (light blue transparent).
          // After filling: dark Pepsi-filled bottle (dark brown).
          sx = 0.18;
          sy = 0.2;
          sz = 0.18;
          if (product.progress < 0.42) {
            color = "#bfdbfe"; // clear empty PET bottle (light blue)
          } else {
            color = "#1c0a00"; // dark brown — Pepsi inside clear PET
          }
          break;
        }
        case Stage.PACKAGED: {
          sx = 0.85;
          sy = 0.85;
          sz = 0.85;
          color = "#e2e8f0";
          break;
        }
      }

      tempScale.set(sx, sy, sz);
      tempMatrix.compose(tempPos, tempQuat, tempScale);

      const mesh = meshes[stage]!;
      const idx = counts[stage];
      mesh.setMatrixAt(idx, tempMatrix);
      tempColor.set(color);
      mesh.setColorAt(idx, tempColor);

      // ── Bottle accessories: red label band + red cap ──
      // Only shown on FILLED bottles (after the filling station at t=0.42).
      // Empty clear bottles pre-filling don't have labels yet.
      if (stage === Stage.BOTTLE && labelRef.current && capRef.current) {
        if (product.progress >= 0.42) {
          // Label band — centered at ~50% of bottle height
          const savedX = tempPos.x;
          const savedY = tempPos.y;
          const savedZ = tempPos.z;
          tempPos.set(savedX, savedY + 0.185, savedZ);
          tempMatrix.compose(tempPos, tempQuat, unitScale);
          labelRef.current.setMatrixAt(idx, tempMatrix);
          // Cap — at top of bottle
          tempPos.set(savedX, savedY + 0.355, savedZ);
          tempMatrix.compose(tempPos, tempQuat, unitScale);
          capRef.current.setMatrixAt(idx, tempMatrix);
        } else {
          // Pre-filling: hide label + cap
          labelRef.current.setMatrixAt(idx, hideMatrix);
          capRef.current.setMatrixAt(idx, hideMatrix);
        }
      }

      counts[stage]++;
    }

    // Hide unused instances
    for (let m = 0; m < 4; m++) {
      const mesh = meshes[m]!;
      for (let i = counts[m]; i < MAX_PRODUCTS; i++) {
        mesh.setMatrixAt(i, hideMatrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // Hide unused label + cap instances (same count as bottles = index 2)
    const bottleCount = counts[Stage.BOTTLE];
    if (labelRef.current) {
      for (let i = bottleCount; i < MAX_PRODUCTS; i++)
        labelRef.current.setMatrixAt(i, hideMatrix);
      labelRef.current.instanceMatrix.needsUpdate = true;
    }
    if (capRef.current) {
      for (let i = bottleCount; i < MAX_PRODUCTS; i++)
        capRef.current.setMatrixAt(i, hideMatrix);
      capRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Stage 1: PET Resin Pellets */}
      {/* frustumCulled=false: InstancedMesh's bounding sphere is computed from
          the base geometry at local origin, not from per-instance matrices.
          Since products live far from world origin (after the spread-out
          layout), three.js was culling the whole mesh. */}
      <instancedMesh
        ref={pelletRef}
        args={[undefined, undefined, MAX_PRODUCTS]}
        /* castShadow intentionally disabled — 80 moving bottles each writing
           to the shadow depth pass added ~1.5 ms/frame for very little
           visual gain (the belt already gets ContactShadows underneath). */
        frustumCulled={false}
      >
        <dodecahedronGeometry args={[0.05, 0]} />
        <meshStandardMaterial
          color="#e2e8f0"
          metalness={0.1}
          roughness={0.5}
          emissive="#94a3b8"
          emissiveIntensity={0.15}
        />
      </instancedMesh>

      {/* Stage 2: Preform — thick test tube with finished neck threads */}
      <instancedMesh
        ref={preformRef}
        args={[preformGeo, undefined, MAX_PRODUCTS]}
        /* castShadow intentionally disabled — 80 moving bottles each writing
           to the shadow depth pass added ~1.5 ms/frame for very little
           visual gain (the belt already gets ContactShadows underneath). */
        frustumCulled={false}
      >
        <meshStandardMaterial
          color="#93c5fd"
          metalness={0.15}
          roughness={0.2}
          transparent
          opacity={0.85}
          emissive="#60a5fa"
          emissiveIntensity={0.15}
        />
      </instancedMesh>

      {/* Stage 3: Pepsi bottle body — color set per-instance:
          clear blue (empty, pre-filling) or dark brown (filled with Pepsi) */}
      <instancedMesh
        ref={bottleRef}
        args={[bottleGeo, undefined, MAX_PRODUCTS]}
        /* castShadow intentionally disabled — 80 moving bottles each writing
           to the shadow depth pass added ~1.5 ms/frame for very little
           visual gain (the belt already gets ContactShadows underneath). */
        frustumCulled={false}
      >
        <meshStandardMaterial
          color="#bfdbfe"
          metalness={0.15}
          roughness={0.15}
          transparent
          opacity={0.88}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* Pepsi blue label band — cylinder wrapping around mid-body.
          Radius 0.078 sits just outside the bottle body (0.076 at widest).
          Height 0.10 covers roughly the label area. */}
      <instancedMesh
        ref={labelRef}
        args={[undefined, undefined, MAX_PRODUCTS]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.078, 0.078, 0.1, 12]} />
        <meshStandardMaterial
          color="#004B93"
          emissive="#004B93"
          emissiveIntensity={0.35}
          metalness={0.1}
          roughness={0.4}
        />
      </instancedMesh>

      {/* Blue bottle cap — small cylinder at the top */}
      <instancedMesh
        ref={capRef}
        args={[undefined, undefined, MAX_PRODUCTS]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.028, 0.028, 0.025, 8]} />
        <meshStandardMaterial
          color="#004B93"
          emissive="#001f4d"
          emissiveIntensity={0.3}
          metalness={0.3}
          roughness={0.35}
        />
      </instancedMesh>

      {/* Stage 4: Packaged — opaque shrink-wrapped carton */}
      <instancedMesh
        ref={packageRef}
        args={[undefined, undefined, MAX_PRODUCTS]}
        /* castShadow intentionally disabled — 80 moving bottles each writing
           to the shadow depth pass added ~1.5 ms/frame for very little
           visual gain (the belt already gets ContactShadows underneath). */
        frustumCulled={false}
      >
        <boxGeometry args={[0.12, 0.15, 0.1]} />
        <meshStandardMaterial
          color="#e2e8f0"
          metalness={0.1}
          roughness={0.5}
          emissive="#10b981"
          emissiveIntensity={0.15}
        />
      </instancedMesh>
    </group>
  );
};

export default ProductFlow3D;
