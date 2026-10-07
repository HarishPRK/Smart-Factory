import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Block, Cylinder, METAL, type Point3 } from "./industrialPrimitives";

// Repeated small hardware shares both geometry and finish. Each set is one draw call.
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitBolt = new THREE.CylinderGeometry(1, 1, 1, 6);
const steel = new THREE.MeshStandardMaterial({ color: METAL.steel, metalness: 0.78, roughness: 0.5 });
const rubber = new THREE.MeshStandardMaterial({ color: "#172125", metalness: 0.05, roughness: 0.86 });
const brushed = new THREE.MeshStandardMaterial({ color: METAL.edge, metalness: 0.7, roughness: 0.58 });
type Part = { at: Point3; size: Point3; rotation?: Point3 };

function Hardware({ parts, finish = steel, geometry = unitBox }: { parts: Part[]; finish?: THREE.Material; geometry?: THREE.BufferGeometry }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const transform = new THREE.Object3D();
    parts.forEach(({ at, size, rotation = [0, 0, 0] }, index) => {
      transform.position.set(...at);
      transform.rotation.set(...rotation);
      transform.scale.set(...size);
      transform.updateMatrix();
      mesh.current!.setMatrixAt(index, transform.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [parts]);
  return <instancedMesh ref={mesh} args={[geometry, finish, parts.length]} castShadow receiveShadow dispose={null} />;
}

/** Flush sheet-metal door, recessed perimeter, hinges, pull handle and optional louvers. */
export function ServicePanel({ at, width, height, color, rotation = [0, 0, 0], vent = false }: {
  at: Point3; width: number; height: number; color: string; rotation?: Point3; vent?: boolean;
}) {
  const handleX = width * 0.34;
  return <group position={at} rotation={rotation}>
    <Block at={[0, 0, 0]} size={[width, height, 0.028]} color="#172125" metal={0.08} roughness={0.8} />
    <Block at={[0, 0, 0.019]} size={[width - 0.045, height - 0.045, 0.025]} color={color} metal={0.18} roughness={0.48} />
    {height < 0.6 ? <Hardware geometry={unitBolt} parts={[-1, 1].flatMap((x) => [-1, 1].map((y): Part => ({
      at: [x * (width / 2 - 0.08), y * (height / 2 - 0.065), 0.05], size: [0.022, 0.018, 0.022], rotation: [Math.PI / 2, 0, 0],
    })))} /> : <>
      <Hardware finish={brushed} parts={[-0.31, 0.31].map((y) => ({ at: [-width / 2 + 0.04, y * height, 0.047], size: [0.055, Math.min(0.16, height * 0.15), 0.045] }))} />
      <Hardware finish={rubber} parts={[
        { at: [handleX, 0, 0.11], size: [0.045, Math.min(0.3, height * 0.4), 0.045] },
        ...[-1, 1].map((sign): Part => ({ at: [handleX, sign * Math.min(0.13, height * 0.16), 0.074], size: [0.045, 0.035, 0.09] })),
      ]} />
    </>}
    {vent && <group position={[-width * 0.05, -height * 0.19, 0.04]}>
      <Block at={[0, 0, 0]} size={[width * 0.52, height * 0.35, 0.01]} color="#172125" metal={0} roughness={0.9} />
      <Hardware finish={brushed} parts={Array.from({ length: 6 }, (_, i) => ({ at: [0, (i - 2.5) * height * 0.051, 0.02], size: [width * 0.5, height * 0.019, 0.045], rotation: [0.25, 0, 0] }))} />
    </group>}
  </group>;
}

/** Thin extrusion frames keep the sectioned process view open while explaining its guard. */
export function GuardFrame({ at, width, height }: { at: Point3; width: number; height: number }) {
  return <group position={at}>
    <Hardware finish={brushed} parts={[
      ...[-1, 1].map((sign): Part => ({ at: [0, sign * height / 2, 0], size: [width, 0.055, 0.07] })),
      ...[-1, 0, 1].map((sign): Part => ({ at: [sign * width / 2, 0, 0], size: [0.045, height, 0.07] })),
    ]} />
    <Hardware finish={rubber} parts={[-0.15, 0.15].flatMap((x): Part[] => [
      { at: [x, 0, 0.1], size: [0.035, 0.32, 0.04] },
      { at: [x, -0.14, 0.05], size: [0.035, 0.035, 0.11] },
      { at: [x, 0.14, 0.05], size: [0.035, 0.035, 0.11] },
    ])} />
  </group>;
}

const fanGuardGeometry = (() => {
  const rings = [0.25, 0.48, 0.73].map((radius) => {
    const ring = new THREE.TorusGeometry(radius, radius === 0.73 ? 0.043 : 0.018, 5, 32);
    ring.rotateX(-Math.PI / 2);
    return ring;
  });
  const bars = [0, Math.PI / 2].map((angle) => {
    const bar = new THREE.BoxGeometry(1.45, 0.025, 0.024);
    bar.rotateY(angle);
    return bar;
  });
  const merged = mergeGeometries([...rings, ...bars]);
  [...rings, ...bars].forEach((geometry) => geometry.dispose());
  return merged;
})();

export function FanGuard({ at }: { at: Point3 }) {
  return <group position={at}>
    <mesh geometry={fanGuardGeometry} material={brushed} castShadow dispose={null} />
    <Hardware finish={brushed} parts={[-1, 1].map((sign) => ({ at: [sign * 0.72, -0.09, 0], size: [0.09, 0.16, 0.13] }))} />
  </group>;
}

export function InspectionPort({ at, radius = 0.3, rotation = [0, 0, 0] }: { at: Point3; radius?: number; rotation?: Point3 }) {
  const bolts = useMemo(() => Array.from({ length: 6 }, (_, i): Part => {
    const angle = i * Math.PI / 3;
    return { at: [Math.sin(angle) * radius * 0.82, Math.cos(angle) * radius * 0.82, 0.09], size: [0.022, 0.035, 0.022], rotation: [Math.PI / 2, 0, 0] };
  }), [radius]);
  return <group position={at} rotation={rotation}>
    <Cylinder at={[0, 0, 0]} radius={radius} height={0.11} rotation={[Math.PI / 2, 0, 0]} />
    <Cylinder at={[0, 0, 0.068]} radius={radius * 0.65} height={0.025} rotation={[Math.PI / 2, 0, 0]} color={METAL.dark} />
    <Hardware geometry={unitBolt} parts={bolts} />
    <Hardware parts={[{ at: [0, 0, 0.1], size: [radius * 0.85, 0.045, 0.04] }]} />
  </group>;
}

export function AnchorFeet({ points }: { points: Point3[] }) {
  return <>
    <Hardware finish={brushed} parts={points.map((at) => ({ at, size: [0.34, 0.06, 0.3] }))} />
    <Hardware geometry={unitBolt} parts={points.flatMap(([x, y, z]) => [-1, 1].map((side): Part => ({ at: [x + side * 0.11, y + 0.04, z], size: [0.03, 0.035, 0.03] })))} />
  </>;
}

export function Hose({ points, radius = 0.035 }: { points: Point3[]; radius?: number }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)), false, "catmullrom", 0.15), [points]);
  return <mesh material={rubber} castShadow>
    <tubeGeometry args={[curve, 20, radius, 7, false]} />
  </mesh>;
}
