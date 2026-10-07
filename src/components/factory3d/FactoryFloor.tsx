import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Block } from "./industrialPrimitives";

// Deterministic, seamless aggregate: the finish is authored in scene units,
// not a screen-space noise layer. One texture pair serves the entire floor.
function aggregateTextures() {
  const size = 256;
  const color = new Uint8Array(size * size * 4);
  const height = new Uint8Array(size * size * 4);
  const hash = (x: number, y: number, period: number) => {
    let value = ((x % period + period) % period) * 374761393 + ((y % period + period) % period) * 668265263;
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x: number, y: number, period: number) => {
    const sx = x / size * period; const sy = y / size * period;
    const ix = Math.floor(sx); const iy = Math.floor(sy);
    const fx = sx - ix; const fy = sy - iy;
    const ux = fx * fx * (3 - 2 * fx); const uy = fy * fy * (3 - 2 * fy);
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(hash(ix, iy, period), hash(ix + 1, iy, period), ux),
      THREE.MathUtils.lerp(hash(ix, iy + 1, period), hash(ix + 1, iy + 1, period), ux), uy);
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = hash(x, y, size);
    const mineral = noise(x, y, 4) * 0.55 + noise(x, y, 16) * 0.3 + grain * 0.15;
    const tone = Math.round(205 + mineral * 42);
    const relief = Math.round(105 + noise(x, y, 32) * 34 + grain * 26);
    const index = (y * size + x) * 4;
    color.set([tone, tone, tone, 255], index);
    height.set([relief, relief, relief, 255], index);
  }
  const map = new THREE.DataTexture(color, size, size, THREE.RGBAFormat);
  const bump = new THREE.DataTexture(height, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, bump]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 8);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  }
  return { map, bump };
}

export default function FactoryFloor() {
  const textures = useMemo(() => aggregateTextures(), []);
  useEffect(() => () => { textures.map.dispose(); textures.bump.dispose(); }, [textures]);
  return <group>
    <Block at={[0, -0.36, 0]} size={[46, 0.7, 30]} color="#20292d" metal={0} roughness={1} environmentIntensity={0} />
    <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[45.8, 29.8]} />
      <meshStandardMaterial color="#343d40" map={textures.map} bumpMap={textures.bump} bumpScale={0.018} roughness={1} metalness={0} envMapIntensity={0} />
    </mesh>
    {/* Flush concrete control joints give the hall a physical scale. */}
    {[-13.7, -4.6, 4.6, 13.7].map((x) => <Block key={`x${x}`} at={[x, 0.05, 0]} size={[0.022, 0.004, 29.8]} color="#293134" metal={0} roughness={1} environmentIntensity={0} />)}
    {[-9.9, 0, 9.9].map((z) => <Block key={`z${z}`} at={[0, 0.05, z]} size={[45.8, 0.004, 0.022]} color="#293134" metal={0} roughness={1} environmentIntensity={0} />)}
  </group>;
}
