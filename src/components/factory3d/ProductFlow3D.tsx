"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";

interface ProductFlow3DProps {
  path: [number, number, number][];
}

const MAX_PRODUCTS = 60;

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
const enum Stage { PELLET, PREFORM, BOTTLE, PACKAGED }

function classifyStage(progress: number): Stage {
  if (progress < 0.10) return Stage.PELLET;
  if (progress < 0.40) return Stage.PREFORM;
  if (progress < 0.90) return Stage.BOTTLE;
  return Stage.PACKAGED;
}

// ── Bottle profile — 10x larger base so scales don't need to be huge ──
function createBottleGeometry(): THREE.LatheGeometry {
  const s = 10; // scale factor baked into geometry
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.000 * s, 0.000 * s),
    new THREE.Vector2(0.035 * s, 0.000 * s),
    new THREE.Vector2(0.038 * s, 0.005 * s),
    new THREE.Vector2(0.038 * s, 0.015 * s),
    new THREE.Vector2(0.040 * s, 0.025 * s),
    new THREE.Vector2(0.042 * s, 0.040 * s),
    new THREE.Vector2(0.039 * s, 0.050 * s),
    new THREE.Vector2(0.042 * s, 0.060 * s),
    new THREE.Vector2(0.039 * s, 0.070 * s),
    new THREE.Vector2(0.042 * s, 0.080 * s),
    new THREE.Vector2(0.039 * s, 0.090 * s),
    new THREE.Vector2(0.042 * s, 0.100 * s),
    new THREE.Vector2(0.042 * s, 0.120 * s),
    new THREE.Vector2(0.040 * s, 0.130 * s),
    new THREE.Vector2(0.035 * s, 0.140 * s),
    new THREE.Vector2(0.025 * s, 0.150 * s),
    new THREE.Vector2(0.014 * s, 0.158 * s),
    new THREE.Vector2(0.013 * s, 0.165 * s),
    new THREE.Vector2(0.015 * s, 0.167 * s),
    new THREE.Vector2(0.015 * s, 0.170 * s),
    new THREE.Vector2(0.013 * s, 0.172 * s),
    new THREE.Vector2(0.016 * s, 0.174 * s),
    new THREE.Vector2(0.016 * s, 0.185 * s),
    new THREE.Vector2(0.000 * s, 0.185 * s),
  ];
  return new THREE.LatheGeometry(pts, 16);
}

// ── Preform — 10x larger base ──
function createPreformGeometry(): THREE.LatheGeometry {
  const s = 10;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.000 * s, 0.000 * s),
    new THREE.Vector2(0.008 * s, 0.002 * s),
    new THREE.Vector2(0.014 * s, 0.008 * s),
    new THREE.Vector2(0.016 * s, 0.020 * s),
    new THREE.Vector2(0.016 * s, 0.060 * s),
    new THREE.Vector2(0.016 * s, 0.080 * s),
    new THREE.Vector2(0.015 * s, 0.090 * s),
    new THREE.Vector2(0.014 * s, 0.095 * s),
    new THREE.Vector2(0.013 * s, 0.100 * s),
    new THREE.Vector2(0.015 * s, 0.102 * s),
    new THREE.Vector2(0.015 * s, 0.105 * s),
    new THREE.Vector2(0.013 * s, 0.107 * s),
    new THREE.Vector2(0.016 * s, 0.109 * s),
    new THREE.Vector2(0.016 * s, 0.120 * s),
    new THREE.Vector2(0.000 * s, 0.120 * s),
  ];
  return new THREE.LatheGeometry(pts, 12);
}

const ProductFlow3D: React.FC<ProductFlow3DProps> = ({ path }) => {
  const pelletRef = useRef<THREE.InstancedMesh>(null);
  const preformRef = useRef<THREE.InstancedMesh>(null);
  const bottleRef = useRef<THREE.InstancedMesh>(null);
  const packageRef = useRef<THREE.InstancedMesh>(null);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  const hideMatrix = useMemo(() => new THREE.Matrix4().makeTranslation(0, -100, 0), []);

  const bottleGeo = useMemo(() => createBottleGeometry(), []);
  const preformGeo = useMemo(() => createPreformGeometry(), []);

  const curve = useMemo(() => {
    const points = path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.3);
  }, [path]);

  const getPathPosition = (t: number): [number, number, number] => {
    const clampedT = Math.max(0, Math.min(1, t));
    curve.getPointAt(clampedT, tempPos);
    return [tempPos.x, tempPos.y + 0.18, tempPos.z];
  };

  useFrame(({ clock }) => {
    const meshes = [pelletRef.current, preformRef.current, bottleRef.current, packageRef.current];
    if (!meshes[0] || !meshes[1] || !meshes[2] || !meshes[3]) return;

    const products = useDigitalTwinStore.getState().products;
    const visibleCount = Math.min(products.length, MAX_PRODUCTS);
    const t = clock.elapsedTime;

    const counts = [0, 0, 0, 0];

    for (let i = 0; i < visibleCount; i++) {
      const product = products[i];
      const stage = classifyStage(product.progress);
      const pos = getPathPosition(product.progress);

      tempPos.set(pos[0], pos[1], pos[2]);

      // ── Stage-specific scale + visual behavior ──
      let sx: number, sy: number, sz: number;
      let color = product.color;

      // Geometries are 10x baked (bottle radius 0.42, height 1.85)
      // Scale 0.15 → bottle radius ~0.06, height ~0.28 (small, realistic on belt)
      switch (stage) {
        case Stage.PELLET: {
          const bounce = Math.sin(t * 4 + i * 2) * 0.005;
          sx = 0.5; sy = 0.5 + bounce; sz = 0.5;
          break;
        }
        case Stage.PREFORM: {
          const subProgress = (product.progress - 0.10) / 0.30;
          if (subProgress < 0.5) {
            const growT = subProgress * 2;
            sx = 0.12; sy = 0.08 + growT * 0.08; sz = 0.12;
            color = "#f59e0b";
          } else if (subProgress < 0.7) {
            sx = 0.12; sy = 0.16; sz = 0.12;
            color = "#93c5fd";
          } else {
            sx = 0.12; sy = 0.16; sz = 0.12;
            const heatPulse = 0.5 + Math.sin(t * 3 + i) * 0.5;
            color = heatPulse > 0.5 ? "#fb923c" : "#fdba74";
          }
          break;
        }
        case Stage.BOTTLE: {
          const subProgress = (product.progress - 0.40) / 0.50;
          if (subProgress < 0.3) {
            const morphT = subProgress / 0.3;
            const stretchT = Math.min(1, morphT * 2);
            const blowT = Math.max(0, (morphT - 0.4) / 0.6);
            sx = 0.12 + blowT * 0.05;
            sy = 0.16 + stretchT * 0.04;
            sz = 0.12 + blowT * 0.05;
            color = blowT < 0.5 ? "#fbbf24" : "#93c5fd";
          } else if (subProgress < 0.5) {
            sx = 0.17; sy = 0.20; sz = 0.17;
            color = "#93c5fd";
          } else {
            sx = 0.17; sy = 0.20; sz = 0.17;
            color = "#93c5fd";
          }
          break;
        }
        case Stage.PACKAGED: {
          sx = 0.8; sy = 0.8; sz = 0.8;
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
  });

  return (
    <group>
      {/* Stage 1: PET Resin Pellets */}
      <instancedMesh ref={pelletRef} args={[undefined, undefined, MAX_PRODUCTS]} castShadow>
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
      <instancedMesh ref={preformRef} args={[preformGeo, undefined, MAX_PRODUCTS]} castShadow>
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

      {/* Stage 3: Blown Bottle — full PET bottle, visible from all angles */}
      <instancedMesh ref={bottleRef} args={[bottleGeo, undefined, MAX_PRODUCTS]} castShadow>
        <meshStandardMaterial
          color="#93c5fd"
          metalness={0.15}
          roughness={0.15}
          transparent
          opacity={0.8}
          emissive="#3b82f6"
          emissiveIntensity={0.2}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* Stage 4: Packaged — opaque shrink-wrapped carton */}
      <instancedMesh ref={packageRef} args={[undefined, undefined, MAX_PRODUCTS]} castShadow>
        <boxGeometry args={[0.12, 0.15, 0.10]} />
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
