import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { StageId } from "../../types/digitalTwin";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { Block, Cylinder, Feet, Fence, HMI, MACHINE_PAINT, METAL, Pallet, Pipe, StackLight } from "./industrialPrimitives";
import { useLineClock } from "./LineProcess";
import { AnchorFeet, FanGuard, GuardFrame, Hose, InspectionPort, ServicePanel } from "./MachineDetails";
import { ARM_LENGTHS, BELT_Y, CELL_Y, BOTTLE_SCALE, WRIST_DROP, PACK, ROBOT_BASE, fillingPose, robotToolPoint, smooth, solveRobotArm, stationPhase } from "./productionCycle";

function Intake() {
  return <group>
    <Block at={[0, 0.15, -0.8]} size={[6.3, 0.3, 4.9]} color={METAL.dark} />
    {[-1.55, 1.55].map((x) => <group key={x} position={[x, 0, -1.1]}>
      {[-0.7, 0.7].flatMap((dx) => [-0.6, 0.6].map((z) => <Block key={`${dx}${z}`} at={[dx, 1, z]} size={[0.12, 1.8, 0.12]} color={METAL.steel} />))}
      <mesh position={[0, 3.6, 0]} castShadow><cylinderGeometry args={[1.17, 1.17, 3.4, 48]} /><meshStandardMaterial color={MACHINE_PAINT.intake} metalness={0.05} roughness={0.72} envMapIntensity={0.35} /></mesh>
      <Cylinder at={[0, 1.45, 0]} radius={0.26} top={1.16} height={0.9} />
      <Cylinder at={[0, 5.35, 0]} radius={1.17} top={0.37} height={0.38} />
      <Cylinder at={[0, 5.66, 0]} radius={0.3} height={0.26} color={METAL.dark} />
      {[2.1, 3.25, 5.13].map((y) => <Cylinder key={y} at={[0, y, 0]} radius={1.19} height={0.065} color={METAL.edge} />)}
      <Cylinder at={[0, 3.1, 0]} radius={0.7} height={2.6} color="#b4a386" metal={0} />
      <Pipe points={[[0, 1.1, 0], [0, 0.72, 0], [0, 0.72, 1.8], [0, 1.4, 1.8]]} color={METAL.blue} radius={0.14} />
      <Block at={[0, 3.7, 1.18]} size={[0.18, 2.15, 0.05]} color={METAL.dark} />
      <Block at={[0, 3.45, 1.22]} size={[0.09, 1.55, 0.04]} color="#6bb2c1" />
      <InspectionPort at={[0.48, 4.65, 1.07]} radius={0.28} rotation={[0, 0.42, 0]} />
      <AnchorFeet points={[-0.7, 0.7].flatMap((dx) => [-0.6, 0.6].map((z): [number, number, number] => [dx, 0.31, z]))} />
    </group>)}
    {[-0.25, 0.25].map((x) => <Pipe key={x} points={[[x, 0.35, -2.55], [x, 5.4, -2.55], [x, 5.85, -2.1]]} radius={0.04} />)}
    {Array.from({ length: 14 }, (_, i) => <Block key={i} at={[0, 0.6 + i * 0.37, -2.55]} size={[0.56, 0.04, 0.05]} color={METAL.steel} />)}
    <Block at={[2.5, 1.05, 1.5]} size={[0.7, 1.8, 0.65]} color={METAL.shell} round /><HMI at={[2.5, 1.5, 1.86]} />
    <ServicePanel at={[2.5, 0.75, 1.836]} width={0.58} height={0.8} color={METAL.shell} vent />
    <Hose points={[[2.5, 0.6, 1.17], [2.5, 0.4, 0.85], [1.55, 0.4, 0.7]]} radius={0.045} />
    <StackLight at={[2.5, 2, 1.5]} />
  </group>;
}

function Molder() {
  const clock = useLineClock();
  const halves = useRef<THREE.Group>(null); const rod = useRef<THREE.Group>(null); const injector = useRef<THREE.Group>(null);
  useFrame(() => {
    const phase = stationPhase(clock.current.time, "forming"); const age = phase === null ? 0 : 6 + phase * 12;
    const shut = smooth((age - 12) / 1.5) * (1 - smooth((age - 16) / 1.5));
    halves.current?.children.forEach((half, i) => { half.position.x = (i === 0 ? -1 : 1) * (0.25 + (1 - shut) * 0.55); });
    if (rod.current) rod.current.position.y = -0.38 * smooth((age - 13.8) / 0.7) * (1 - smooth((age - 15.3) / 0.7));
    if (injector.current) injector.current.position.y = -0.16 * smooth((age - 6) / 1) * (1 - smooth((age - 9) / 1));
  });
  return <group>
    <Feet width={5.6} depth={2.6} />
    <Block at={[0, 0.65, 0]} size={[6.4, 0.65, 3.2]} color={METAL.dark} round />
    <Block at={[0, 1.95, -1.45]} size={[6.4, 2.1, 0.25]} color={MACHINE_PAINT.forming} metal={0.18} round />
    {/* A permanently sectioned guard keeps the real forming action visible. */}
    {[-3, 3].map((x) => <Block key={x} at={[x, 2.15, 0]} size={[0.18, 2.4, 3]} color={MACHINE_PAINT.forming} metal={0.18} />)}
    {[-1.48, 1.48].map((z) => <Block key={z} at={[0, 3.25, z]} size={[6.3, 0.18, 0.15]} color={METAL.shell} />)}
    <Block at={[0, 2.05, 1.49]} size={[5.75, 1.9, 0.03]} color={METAL.glass} opacity={0.08} />
    <GuardFrame at={[0, 2.05, 1.53]} width={5.75} height={1.9} />
    <ServicePanel at={[-3.105, 2.05, 0]} width={2.5} height={1.82} color={MACHINE_PAINT.forming} rotation={[0, -Math.PI / 2, 0]} vent />
    {[-1.63, 1.63].map((x) => <ServicePanel key={x} at={[x, 0.65, 1.614]} width={2.84} height={0.46} color={MACHINE_PAINT.forming} />)}
    {[-1, 1].map((side) => <Hose key={side} points={[[side * 1.72, 2.65, -1.19], [side * 2, 2.45, -1.2], [side * 2.05, 1.35, -1.2], [side * 1.8, 1.03, -1.2]]} radius={0.046} />)}
    {/* Injection barrel and preform core, followed by a separate stretch-blow cavity. */}
    <Cylinder at={[-2.1, 2.3, 0]} radius={0.22} height={0.62} color="#d3b78a" metal={0.5} />
    {[2.11, 2.32, 2.52].map((y) => <Cylinder key={y} at={[-2.1, y, 0]} radius={0.24} height={0.08} color="#e4ac62" />)}
    <group ref={injector}><Cylinder at={[-2.1, 2.93, 0]} radius={0.07} height={0.64} /><Cylinder at={[-2.1, 1.99, 0]} radius={0.065} height={0.16} color={METAL.dark} /></group>
    <Pipe points={[[-2.4, 3.1, -0.7], [-2.1, 3.1, -0.7], [-2.1, 2.4, -0.4], [-2.1, 2.4, 0]]} radius={0.1} />
    {[1.42, 2.5].map((y) => <Cylinder key={y} at={[0, y, -0.5]} radius={0.07} height={3.3} rotation={[0, 0, Math.PI / 2]} />)}
    <group ref={halves}>{[-1, 1].map((sign) => <group key={sign}>
      <Block at={[0, 1.6, -0.12]} size={[0.23, 0.8, 0.46]} color="#8caab6" metal={0.82} round />
      <Pipe points={[[sign * -0.08, 1.25, 0.13], [sign * -0.14, 1.32, 0.13], [sign * -0.14, 1.64, 0.13], [sign * -0.07, 1.76, 0.13], [sign * -0.05, 1.84, 0.13]]} radius={0.018} color="#e0f2f1" />
      {[1.28, 1.9].map((y) => <Cylinder key={y} at={[0, y, 0.13]} radius={0.035} height={0.025} rotation={[Math.PI / 2, 0, 0]} color={METAL.dark} />)}
    </group>)}</group>
    <group ref={rod}><Cylinder at={[0, 2.42, 0]} radius={0.025} height={0.8} /><Cylinder at={[0, 3.02, 0]} radius={0.13} height={0.4} color={METAL.blue} /></group>
    <Block at={[2.53, 2, 1.24]} size={[0.6, 1.9, 0.44]} round /><HMI at={[2.53, 2.5, 1.5]} /><StackLight at={[2.75, 3.35, -0.9]} />
  </group>;
}

function Filler() {
  const clock = useLineClock(); const head = useRef<THREE.Group>(null); const stream = useRef<THREE.Mesh>(null); const capper = useRef<THREE.Group>(null);
  const nozzleSlide = useRef<THREE.Mesh>(null); const capperSlide = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = stationPhase(clock.current.time, "mixing"); const age = t === null ? 0 : 31 + t * 8;
    const pose = fillingPose(age);
    if (head.current) { head.current.position.x = pose.nozzleX; head.current.position.y = pose.nozzleTip; }
    if (stream.current) {
      const liquidTop = BELT_Y - CELL_Y + (0.045 + 0.96 * pose.fill) * BOTTLE_SCALE;
      stream.current.visible = pose.stream > 0;
      stream.current.scale.y = Math.max(0.001, pose.nozzleTip - liquidTop);
      stream.current.position.y = (pose.nozzleTip + liquidTop) / 2;
      (stream.current.material as THREE.MeshBasicMaterial).opacity = pose.stream * 0.85;
    }
    if (capper.current) { capper.current.position.x = pose.capperX; capper.current.position.y = pose.capperY; }
    if (nozzleSlide.current) { const bottom = pose.nozzleTip + 0.6; nozzleSlide.current.position.set(pose.nozzleX, (bottom + 3.35) / 2, 0); nozzleSlide.current.scale.y = 3.35 - bottom; }
    if (capperSlide.current) { const bottom = pose.capperY + 0.26; capperSlide.current.position.set(pose.capperX, (bottom + 3.35) / 2, 0); capperSlide.current.scale.y = 3.35 - bottom; }
  });
  return <group>
    <Feet width={4.6} depth={3} /><Block at={[0, 0.65, 0]} size={[5.2, 0.6, 3.5]} color={METAL.dark} round />
    {[-2.2, 2.2].map((x) => <Block key={x} at={[x, 2.3, -0.9]} size={[0.15, 3.1, 0.2]} color={METAL.steel} />)}
    <Block at={[0, 3.8, -0.9]} size={[4.8, 0.22, 0.35]} color={MACHINE_PAINT.mixing} metal={0.18} round />
    <Cylinder at={[0, 3.4, -1.4]} radius={0.9} height={1.4} color={METAL.shell} />
    <Cylinder at={[0, 4.18, -1.4]} radius={0.9} top={0.4} height={0.2} />
    <Cylinder at={[0, 4.33, -1.4]} radius={0.25} height={0.13} color={METAL.steel} />
    <Cylinder at={[0, 4.56, -1.4]} radius={0.21} height={0.35} color={MACHINE_PAINT.mixing} metal={0.18} />
    <Cylinder at={[0, 4.76, -1.4]} radius={0.22} height={0.08} color={METAL.dark} />
    {[2.79, 4.07].map((y) => <Cylinder key={y} at={[0, y, -1.4]} radius={0.925} height={0.055} />)}
    {[-0.67, 0.67].map((x) => <Block key={x} at={[x, 2.02, -1.4]} size={[0.13, 1.45, 0.15]} color={METAL.steel} />)}
    <Cylinder at={[0, 3.4, -1.4]} radius={0.912} height={0.38} color={MACHINE_PAINT.mixing} metal={0.15} />
    <Pipe points={[[0, 2.7, -1.4], [0, 2.7, -0.75], [0, 3.35, -0.65], [0, 3.35, 0]]} color={METAL.blue} radius={0.09} />
    <Block at={[0.12, 3.35, -0.38]} size={[1.65, 0.15, 0.95]} color={MACHINE_PAINT.mixing} metal={0.18} />
    <mesh ref={nozzleSlide}><cylinderGeometry args={[0.036, 0.036, 1, 12]} /><meshStandardMaterial color={METAL.steel} metalness={0.8} roughness={0.25} /></mesh>
    <mesh ref={capperSlide}><cylinderGeometry args={[0.045, 0.045, 1, 12]} /><meshStandardMaterial color={METAL.steel} metalness={0.8} roughness={0.25} /></mesh>
    <group ref={head}><Cylinder at={[0, 0.4, 0]} radius={0.1} height={0.4} color={METAL.blue} /><Cylinder at={[0, 0.1, 0]} radius={0.022} height={0.2} /></group>
    <mesh ref={stream} position={[0, 2, 0]}><cylinderGeometry args={[0.012, 0.015, 1, 10]} /><meshBasicMaterial color="#bc772d" transparent opacity={0.85} /></mesh>
    <group ref={capper}><Cylinder at={[0, 0.14, 0]} radius={0.11} height={0.24} color={METAL.shell} /><Cylinder at={[0, 0.015, 0]} radius={0.065} height={0.03} color={METAL.blue} /></group>
    <Block at={[1.5, 3.45, 0]} size={[2.5, 0.15, 0.25]} color={METAL.steel} />
    <Block at={[0, 2.2, 1.48]} size={[4.5, 2, 0.03]} color={METAL.glass} opacity={0.07} />
    <GuardFrame at={[0, 2.2, 1.51]} width={4.5} height={2} />
    {[-1.27, 1.27].map((x) => <ServicePanel key={x} at={[x, 0.66, 1.765]} width={2.3} height={0.43} color={MACHINE_PAINT.mixing} />)}
    <Hose points={[[2.2, 3.65, -1.01], [2.28, 3.65, -1.12], [2.28, 0.95, -1.12], [1.8, 0.9, -1.12]]} />
    <HMI at={[2.25, 2.65, 0.9]} /><StackLight at={[2.25, 3.8, -0.9]} />
  </group>;
}

function Cooling() {
  const clock = useLineClock(); const fans = useRef<THREE.Group>(null); const air = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = stationPhase(clock.current.time, "curing");
    fans.current?.children.forEach((fan) => { fan.rotation.y = clock.current.time * 5; });
    if (air.current) { air.current.visible = t !== null; air.current.position.x = 3 - (t ?? 0) * 6; air.current.children.forEach((line, i) => { line.position.y = 0.1 - ((clock.current.time * 1.6 + i * 0.17) % 1) * 0.6; }); }
  });
  return <group>
    <Feet width={5.5} depth={2.6} /><Block at={[0, 0.65, 0]} size={[6.3, 0.5, 3.2]} color={METAL.dark} round />
    <Block at={[0, 2, -1.4]} size={[6.3, 2.15, 0.15]} color={MACHINE_PAINT.curing} metal={0.18} round />
    {[-2.85, 2.85].map((x) => <Block key={x} at={[x, 2.1, 1.4]} size={[0.09, 2.15, 0.09]} color={METAL.edge} />)}
    <Block at={[0, 2.05, 1.4]} size={[5.6, 1.9, 0.025]} color={METAL.glass} opacity={0.06} />
    <GuardFrame at={[0, 2.05, 1.43]} width={5.6} height={1.9} />
    {[-1.6, 1.6].map((x) => <ServicePanel key={x} at={[x, 0.65, 1.612]} width={2.92} height={0.38} color={MACHINE_PAINT.curing} />)}
    <ServicePanel at={[0, 2.06, -1.49]} width={2.4} height={1.65} color={MACHINE_PAINT.curing} rotation={[0, Math.PI, 0]} vent />
    {[-1.1, 1.1].map((z) => <Block key={z} at={[0, 3.1, z]} size={[6.3, 0.15, 0.16]} color={MACHINE_PAINT.curing} metal={0.18} />)}
    <group ref={fans}>{[-1.9, 0, 1.9].map((x) => <group key={x} position={[x, 3.25, 0]}>
      <Cylinder at={[0, 0, 0]} radius={0.15} height={0.15} color={METAL.blue} />
      {[0, 1, 2].map((n) => <Block key={n} at={[0, 0, 0]} size={[1.25, 0.04, 0.2]} rotation={[0, n * Math.PI / 3, 0]} color={METAL.steel} />)}
    </group>)}</group>
    {[-1.9, 0, 1.9].map((x) => <group key={x}>
      <FanGuard at={[x, 3.34, 0]} />
      {[-0.72, 0.72].map((dx) => <Block key={dx} at={[x + dx, 3.15, 0]} size={[0.08, 0.08, 2.2]} color={METAL.steel} />)}
    </group>)}
    <group ref={air}>{[-0.45, 0, 0.45].map((z) => <group key={z}><Pipe points={[[0.12, 2.9, z], [0.28, 2.4, z], [0.45, 1.9, z]]} radius={0.025} color="#38add0" opacity={0.7} /></group>)}</group>
    <HMI at={[2.6, 2.25, 1.53]} /><StackLight at={[-2.8, 3.2, -1.1]} />
  </group>;
}

function Inspection() {
  const clock = useLineClock(); const scanner = useRef<THREE.Mesh>(null); const pass = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = stationPhase(clock.current.time, "quality");
    if (scanner.current) { scanner.current.visible = t !== null && t < 0.85; scanner.current.position.y = BELT_Y - CELL_Y + 0.02 + (t === null ? 0 : (t / 0.85) * 0.61); }
    if (pass.current) {
      pass.current.visible = t !== null && t >= 0.85;
      const bad = useDigitalTwinStore.getState().stages.find((s) => s.id === "quality")?.status === "faulted";
      (pass.current.material as THREE.MeshBasicMaterial).color.set(bad ? "#db5a42" : "#42a77f");
    }
  });
  return <group>
    <Feet width={3.6} depth={2.4} />
    <Block at={[0, 0.65, 0]} size={[4.1, 0.6, 2.9]} color={METAL.dark} round />
    <ServicePanel at={[0, 0.65, 1.465]} width={3.6} height={0.45} color={MACHINE_PAINT.quality} />
    {[-1.65, 1.65].map((x) => <Block key={x} at={[x, 2.05, -0.5]} size={[0.2, 2.6, 0.6]} color={MACHINE_PAINT.quality} metal={0.18} round />)}
    <Block at={[0, 3.3, -0.5]} size={[3.7, 0.25, 0.65]} color={MACHINE_PAINT.quality} metal={0.18} round />
    <Block at={[0, 2.05, -1.15]} size={[2.4, 1.55, 0.07]} color="#e7f4ed" metal={0} />
    {[-1, 1].map((x) => <group key={x} position={[x, 1.6, 0]} rotation={[0, -x * Math.PI / 2, 0]}><Block at={[0, 0, 0]} size={[0.36, 0.36, 0.42]} color={METAL.blue} round /><Cylinder at={[0, 0, 0.3]} radius={0.1} height={0.2} rotation={[Math.PI / 2, 0, 0]} color={METAL.dark} /></group>)}
    {[-1, 1].map((side) => <group key={side}>
      <Block at={[side * 1.28, 1.43, -0.25]} size={[0.62, 0.06, 0.5]} color={METAL.steel} />
      <Hose points={[[side * 1.15, 1.65, -0.2], [side * 1.45, 1.8, -0.65], [side * 1.5, 1.8, -0.92], [side * 1.5, 0.95, -0.92]]} radius={0.027} />
    </group>)}
    <mesh ref={scanner} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.25, 1.2]} /><meshBasicMaterial color="#27a8c6" transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    <mesh ref={pass} position={[0, 3.48, -0.5]}><sphereGeometry args={[0.16, 16, 12]} /><meshBasicMaterial color="#42a77f" /></mesh>
    <HMI at={[-1.65, 2.65, 0]} /><StackLight at={[1.65, 3.5, -0.5]} />
  </group>;
}

function Robot() {
  const clock = useLineClock();
  const base = useRef<THREE.Group>(null); const shoulder = useRef<THREE.Group>(null); const elbow = useRef<THREE.Group>(null); const wrist = useRef<THREE.Group>(null); const fingers = useRef<THREE.Group>(null);
  useFrame(() => {
    const phase = stationPhase(clock.current.time, "packaging"); const joint = solveRobotArm(robotToolPoint(phase ?? 0));
    if (base.current) base.current.rotation.y = joint.yaw;
    if (shoulder.current) shoulder.current.rotation.z = joint.shoulder;
    if (elbow.current) elbow.current.rotation.z = joint.elbow;
    if (wrist.current) wrist.current.rotation.z = joint.wrist;
    const grip = smooth(((phase ?? 0) - 0.26) / 0.04) * (1 - smooth(((phase ?? 0) - PACK.release) / 0.04));
    fingers.current?.children.forEach((finger, i) => { finger.position.x = (i === 0 ? -1 : 1) * (0.14 - grip * 0.078); });
  });
  return <group position={ROBOT_BASE}>
    <Block at={[0, -0.64, 0]} size={[1.38, 0.11, 1.24]} color={METAL.steel} />
    <Cylinder at={[0, -0.35, 0]} radius={0.62} height={0.7} color={METAL.dark} />
    <group ref={base}><Cylinder at={[0, 0, 0]} radius={0.43} height={0.3} color={MACHINE_PAINT.packaging} metal={0.18} />
      <group ref={shoulder}>
        <Cylinder at={[0, 0, 0]} radius={0.29} height={0.54} rotation={[Math.PI / 2, 0, 0]} />
        <Block at={[0, ARM_LENGTHS[0] / 2, 0]} size={[0.34, ARM_LENGTHS[0], 0.38]} color={MACHINE_PAINT.packaging} metal={0.18} round />
        <group ref={elbow} position={[0, ARM_LENGTHS[0], 0]}>
          <Cylinder at={[0, 0, 0]} radius={0.27} height={0.5} rotation={[Math.PI / 2, 0, 0]} />
          <Block at={[0, ARM_LENGTHS[1] / 2, 0]} size={[0.26, ARM_LENGTHS[1], 0.3]} color={MACHINE_PAINT.packaging} metal={0.18} round />
          <group ref={wrist} position={[0, ARM_LENGTHS[1], 0]}>
            <Cylinder at={[0, -(WRIST_DROP - 0.14) / 2, 0]} radius={0.05} height={WRIST_DROP - 0.14} color={METAL.steel} />
            <group position={[0, -WRIST_DROP, 0]}>
              <Cylinder at={[0, 0.14, 0]} radius={0.1} height={0.16} color={METAL.blue} />
              <Block at={[0, 0.09, 0]} size={[0.32, 0.08, 0.16]} color={METAL.steel} />
              <group ref={fingers}>{[-1, 1].map((i) => <group key={i}><Block at={[0, -0.02, 0]} size={[0.03, 0.08, 0.08]} color={METAL.dark} /></group>)}</group>
            </group>
          </group>
        </group>
      </group>
    </group>
  </group>;
}

function Packaging() {
  return <group>
    <Block at={[0, 0.1, -0.4]} size={[6.6, 0.2, 5.8]} color="#597788" />
    <Robot />
    <Block at={[-2.65, 1.25, -2]} size={[0.7, 2.1, 0.7]} round /><HMI at={[-2.65, 1.85, -1.62]} /><StackLight at={[-2.65, 2.4, -2]} />
    <ServicePanel at={[-2.65, 1.01, -1.639]} width={0.58} height={1.05} color={METAL.shell} vent />
    {/* An empty case enters beside the pickup point, clear of the arm pedestal. */}
    {[-0.48, 0.48].map((x) => <Block key={x} at={[2.1 + x, 1.1, -1.5]} size={[0.07, 0.16, 3]} color={METAL.dark} />)}
    {Array.from({ length: 13 }, (_, i) => <Cylinder key={i} at={[2.1, 1.14, -2.85 + i * 0.23]} radius={0.08} height={0.85} rotation={[0, 0, Math.PI / 2]} />)}
    {[-2.6, -0.6].flatMap((z) => [-0.42, 0.42].map((x) => <Block key={`${z}${x}`} at={[2.1 + x, 0.66, z]} size={[0.08, 0.9, 0.08]} color={METAL.steel} />))}
    <Fence at={[0, 0.2, -3.2]} length={6.5} /><Fence at={[-3.25, 0.2, -1.4]} length={3.6} rotation={Math.PI / 2} />
  </group>;
}

function Dispatch() {
  return <group>
    {[-1.7, 1.7].map((x) => <Block key={x} at={[x, 1.8, -0.2]} size={[0.13, 3.4, 0.2]} color={MACHINE_PAINT.dispatch} metal={0.18} />)}
    <Block at={[0, 3.45, -0.2]} size={[3.6, 0.15, 0.2]} color={MACHINE_PAINT.dispatch} metal={0.18} />
    <AnchorFeet points={[[-1.7, 0.08, -0.2], [1.7, 0.08, -0.2]]} />
    <Hose points={[[0, 3.32, -0.5], [0, 3.45, -0.52], [1.7, 3.45, -0.52], [1.76, 2.46, -0.52], [1.7, 2.46, -0.25]]} radius={0.029} />
    <Block at={[0, 3.2, -0.2]} size={[0.4, 0.3, 0.5]} color={METAL.shell} round />
    <HMI at={[1.7, 2.5, 0]} /><StackLight at={[1.65, 3.55, -0.2]} />
    <Pallet at={[0, 0.08, -2.25]} /><Pallet at={[3.2, 0.08, -1.4]} /><Pallet at={[3.2, 0.08, 1.35]} />
    <Fence at={[0, 0, -3.6]} length={4} />
  </group>;
}

const machines = { intake: Intake, forming: Molder, mixing: Filler, curing: Cooling, quality: Inspection, packaging: Packaging, dispatch: Dispatch };
export default function IndustrialMachine({ stageId }: { stageId: StageId }) {
  const Machine = machines[stageId];
  return <Machine />;
}
