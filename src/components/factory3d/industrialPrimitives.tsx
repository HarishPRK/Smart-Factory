/* eslint-disable react-refresh/only-export-components -- Shared material colors accompany the primitive geometry API. */
import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

export type Point3 = [number, number, number];
export const METAL = { shell: "#e4e9e8", edge: "#87999f", dark: "#26353d", steel: "#c1c9cc", blue: "#22b9d4", yellow: "#e3ad52", glass: "#b9eaf1" };
export const MACHINE_PAINT = { intake: "#3b759b", forming: "#a14b4a", mixing: "#438a8b", curing: "#527d61", quality: "#b89b4f", packaging: "#c18046", dispatch: "#837093" };
const PAINT_COLORS = new Set<string>(Object.values(MACHINE_PAINT));

export function Block({ at, size, color = METAL.shell, metal = 0.45, opacity = 1, round = false, rotation, roughness, environmentIntensity = 1 }: {
  at: Point3; size: Point3; color?: string; metal?: number; opacity?: number; round?: boolean; rotation?: Point3; roughness?: number; environmentIntensity?: number;
}) {
  // Powder-coated housings stay matte; exposed stainless retains a satin finish.
  const painted = PAINT_COLORS.has(color) && opacity === 1 && size[1] > 0.1;
  const material = painted
    ? <meshStandardMaterial color={color} metalness={0.05} roughness={Math.max(0.72, roughness ?? 0)} envMapIntensity={0.35} />
    : <meshStandardMaterial color={color} metalness={metal} roughness={roughness ?? (metal > 0.7 ? 0.46 : 0.58)} envMapIntensity={environmentIntensity} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />;
  // Thin floor markings must not cast sub-pixel shadows across the concrete.
  return round ? <RoundedBox position={at} rotation={rotation} args={size} radius={Math.min(0.06, Math.min(...size) * 0.4)} smoothness={3} castShadow={size[1] > 0.1} receiveShadow>{material}</RoundedBox>
    : <mesh position={at} rotation={rotation} castShadow={size[1] > 0.1} receiveShadow><boxGeometry args={size} />{material}</mesh>;
}

export function Cylinder({ at, radius, height, color = METAL.steel, rotation, top, metal = 0.8, opacity = 1 }: {
  at: Point3; radius: number; height: number; color?: string; rotation?: Point3; top?: number; metal?: number; opacity?: number;
}) {
  return <mesh position={at} rotation={rotation} castShadow={opacity === 1} receiveShadow><cylinderGeometry args={[top ?? radius, radius, height, radius > 0.5 ? 48 : 24]} /><meshStandardMaterial color={color} metalness={PAINT_COLORS.has(color) ? 0.05 : metal} roughness={PAINT_COLORS.has(color) ? 0.72 : 0.46} envMapIntensity={PAINT_COLORS.has(color) ? 0.35 : 1} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} /></mesh>;
}

export function Pipe({ points, color = METAL.steel, radius = 0.065, opacity = 1 }: { points: Point3[]; color?: string; radius?: number; opacity?: number }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.08), [points]);
  return <mesh castShadow={opacity === 1}><tubeGeometry args={[curve, Math.max(12, points.length * 5), radius, 8, false]} /><meshStandardMaterial color={color} metalness={opacity < 1 ? 0 : 0.78} roughness={0.46} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} /></mesh>;
}

export function HMI({ at, rotation = [0, 0, 0] }: { at: Point3; rotation?: Point3 }) {
  return <group position={at} rotation={rotation}>
    <Block at={[0, 0, 0]} size={[0.7, 0.58, 0.14]} color={METAL.dark} round />
    <Block at={[-0.04, 0.055, 0.077]} size={[0.5, 0.34, 0.01]} color="#10313e" metal={0} />
    {[0, 1, 2].map((i) => <Block key={i} at={[-0.13 + i * 0.14, 0.015, 0.087]} size={[0.08, 0.09 + i * 0.055, 0.009]} color="#74d4df" metal={0} />)}
    <Cylinder at={[0.2, -0.2, 0.09]} radius={0.055} height={0.035} color="#e96150" rotation={[Math.PI / 2, 0, 0]} metal={0.1} />
  </group>;
}

export function StackLight({ at, color = "#63d9b5" }: { at: Point3; color?: string }) {
  return <group position={at}>
    <Cylinder at={[0, 0.25, 0]} radius={0.035} height={0.5} color={METAL.dark} />
    {["#aa6058", "#bca566", color].map((c, i) => <mesh key={i} position={[0, 0.56 + i * 0.13, 0]}><cylinderGeometry args={[0.09, 0.09, 0.1, 12]} /><meshStandardMaterial color={c} emissive={i === 2 ? c : "#000000"} emissiveIntensity={i === 2 ? 0.7 : 0} /></mesh>)}
  </group>;
}

export function Feet({ width, depth }: { width: number; depth: number }) {
  return <>{[-1, 1].flatMap((x) => [-1, 1].map((z) => <group key={`${x}${z}`} position={[x * width / 2, 0, z * depth / 2]}>
    <Cylinder at={[0, 0.21, 0]} radius={0.07} height={0.42} /><Cylinder at={[0, 0.05, 0]} radius={0.18} height={0.08} color={METAL.dark} />
  </group>))}</>;
}

export function Fence({ at, length, rotation = 0 }: { at: Point3; length: number; rotation?: number }) {
  const panels = Math.ceil(length / 1.7);
  return <group position={at} rotation={[0, rotation, 0]}>
    {Array.from({ length: panels + 1 }, (_, i) => <Block key={`p${i}`} at={[-length / 2 + i * length / panels, 1.05, 0]} size={[0.065, 2.1, 0.065]} color={METAL.yellow} />)}
    {[0.2, 2.05].map((y) => <Block key={y} at={[0, y, 0]} size={[length, 0.045, 0.045]} color={METAL.dark} />)}
    {Array.from({ length: Math.floor(length / 0.24) }, (_, i) => <Block key={i} at={[-length / 2 + 0.15 + i * 0.24, 1.13, 0]} size={[0.012, 1.78, 0.012]} color={METAL.dark} />)}
    {[0.65, 1.15, 1.65].map((y) => <Block key={y} at={[0, y, 0]} size={[length, 0.012, 0.012]} color={METAL.dark} />)}
  </group>;
}

export function Pallet({ at, loaded = true }: { at: Point3; loaded?: boolean }) {
  return <group position={at}>
    {[-0.56, 0, 0.56].map((z) => <Block key={z} at={[0, 0.11, z]} size={[1.65, 0.15, 0.18]} color="#997551" metal={0} />)}
    {Array.from({ length: 6 }, (_, i) => <Block key={i} at={[-0.69 + i * 0.275, 0.24, 0]} size={[0.22, 0.1, 1.3]} color="#bea27b" metal={0} />)}
    {loaded && [0, 1, 2].flatMap((y) => [-0.4, 0.4].flatMap((x) => [-0.33, 0.33].map((z) => <group key={`${x}${y}${z}`}>
      <Block at={[x, 0.54 + y * 0.51, z]} size={[0.76, 0.49, 0.62]} color="#b69260" metal={0} />
      <Block at={[x, 0.55 + y * 0.51, z + 0.316]} size={[0.22, 0.13, 0.008]} color="#ebe5d8" metal={0} />
    </group>)))}
  </group>;
}
