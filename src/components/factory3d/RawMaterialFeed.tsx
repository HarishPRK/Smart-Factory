import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useLineClock } from "./LineProcess";
import { FEED_PATH } from "./productionCycle";
import { Block, Cylinder, METAL, Pipe } from "./industrialPrimitives";

const MOVING_PELLETS = 340;
const HOPPER_PELLETS = 220;
// Bulk feed uses a gentler travel rate than discrete products on the shared clock.
// Eighteen logical seconds is a third of the former particle velocity.
const FEED_TRAVEL_SECONDS = 18;
const scatter = (n: number) => { const f = Math.sin(n * 127.1 + 311.7) * 43758.5453; return f - Math.floor(f); };

/** Bulk resin is a continuous metered stream, not a single enlarged product on the belt. */
export default function RawMaterialFeed() {
  const clock = useLineClock();
  const pellets = useRef<THREE.InstancedMesh>(null);
  const screw = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!pellets.current) return;
    const time = clock.current.time;
    for (let i = 0; i < MOVING_PELLETS + HOPPER_PELLETS; i++) {
      if (i < MOVING_PELLETS) {
        const t = (i / MOVING_PELLETS + time / FEED_TRAVEL_SECONDS) % 1;
        FEED_PATH.getPointAt(t, point);
        const radius = Math.sqrt(scatter(i + 91)) * 0.07;
        const angle = scatter(i + 217) * Math.PI * 2;
        dummy.position.set(point.x, point.y + Math.cos(angle) * radius, point.z + Math.sin(angle) * radius);
      } else {
        const y = 1.98 + scatter(i) * 0.84;
        const radius = Math.sqrt(scatter(i + 31)) * (0.17 + (y - 1.9) * 0.49);
        const angle = scatter(i + 84) * Math.PI * 2;
        dummy.position.set(-13 + Math.cos(angle) * radius, y + Math.sin(time * 2 + i) * 0.006, 9.8 + Math.sin(angle) * radius);
      }
      dummy.rotation.set(i * 0.41, i * 0.23 + time * 0.22, i * 0.73);
      dummy.scale.setScalar(0.75 + scatter(i + 3) * 0.5);
      dummy.updateMatrix(); pellets.current.setMatrixAt(i, dummy.matrix);
    }
    pellets.current.instanceMatrix.needsUpdate = true;
    if (screw.current) screw.current.rotation.x = time * 0.9;
  });
  return <group>
    <Pipe points={FEED_PATH.points.map((p) => p.toArray() as [number, number, number])} radius={0.14} color="#73bdd0" opacity={0.14} />
    <Cylinder at={[-13, 2.4, 9.8]} radius={0.2} top={0.78} height={1} color="#8bd1dc" opacity={0.22} metal={0.1} />
    <Cylinder at={[-13, 2.91, 9.8]} radius={0.79} height={0.055} color={METAL.steel} />
    <Cylinder at={[-13, 1.8, 9.8]} radius={0.16} height={0.3} color={METAL.steel} />
    {[-0.8, 0.8].map((x) => <Block key={x} at={[-13 + x, 1.25, 9.8]} size={[0.07, 2.5, 0.07]} color={METAL.steel} />)}
    <Block at={[-13, 0.1, 9.8]} size={[2, 0.18, 1.5]} color={METAL.shell} />
    <Block at={[-12.5, 1.65, 10.15]} size={[0.45, 0.35, 0.4]} color={METAL.blue} round />
    <group ref={screw} position={[-13, 1.75, 9.8]}>
      <Cylinder at={[0, 0, 0]} radius={0.04} height={0.7} rotation={[0, 0, Math.PI / 2]} />
      {[0, 1, 2, 3, 4].map((n) => <mesh key={n} position={[-0.28 + n * 0.14, 0, 0]} rotation={[0, Math.PI / 2, n * 0.6]}><torusGeometry args={[0.105, 0.014, 5, 16, Math.PI * 1.7]} /><meshStandardMaterial color={METAL.steel} /></mesh>)}
    </group>
    {[-14.55, -11.45].map((x) => <Pipe key={x} points={[[x, 1.48, 8.7], [x, 3.25, 8.9], [-13, 3.25, 9.8], [-13, 2.9, 9.8]]} radius={0.085} color={METAL.steel} />)}
    <Cylinder at={[-2.4, 3.4, 7.3]} radius={0.2} top={0.6} height={0.65} color="#97cdd4" opacity={0.35} />
    <instancedMesh ref={pellets} args={[undefined, undefined, MOVING_PELLETS + HOPPER_PELLETS]} frustumCulled={false}>
      <cylinderGeometry args={[0.027, 0.025, 0.043, 6]} /><meshStandardMaterial color="#eef9f4" roughness={0.68} />
    </instancedMesh>
  </group>;
}
