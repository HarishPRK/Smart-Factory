"use no memo";
// The maintenance target comes from the mutable twin snapshot on each store tick.
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { StageId } from "../../types/digitalTwin";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { useLineClock } from "./LineProcess";
import { MACHINE_PAINT, METAL } from "./industrialPrimitives";
import { ALARM_LIGHT_COLORS, alarmPulse, maintenanceHazardActive, maintenanceTarget } from "./alarmLighting";
import { readTwinAlarmState } from "./twinAlarmState";
import MaintenanceResponse from "./MaintenanceResponse";

type Surface = { material: THREE.MeshStandardMaterial; emissive: THREE.Color; intensity: number };
const HOUSING_COLORS = new Set([...Object.values(MACHINE_PAINT), METAL.shell].map((color) => color.slice(1)));

/** Light the actual housings without replacing their recognizable paint or matte finish. */
export function MachineAlarmFeedback({ stageId, footprint, children }: { stageId: StageId; footprint: [number, number]; children: ReactNode }) {
  const clock = useLineClock();
  const machine = useRef<THREE.Group>(null);
  const surfaces = useRef<Surface[]>([]);
  const perimeter = useRef<THREE.Group>(null);
  const wash = useRef<THREE.PointLight>(null);
  useLayoutEffect(() => {
    const unique = new Set<THREE.MeshStandardMaterial>();
    machine.current?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial && !material.transparent && HOUSING_COLORS.has(material.color.getHexString())) unique.add(material);
      });
    });
    const captured = [...unique].map((material) => ({ material, emissive: material.emissive.clone(), intensity: material.emissiveIntensity }));
    surfaces.current = captured;
    return () => { captured.forEach(({ material, emissive, intensity }) => { material.emissive.copy(emissive); material.emissiveIntensity = intensity; }); };
  }, [stageId]);
  useFrame(({ clock: visualClock }) => {
    const severity = clock.current.alarm.stageAlarms[stageId]?.severity ?? "normal";
    const pulse = alarmPulse(severity, visualClock.elapsedTime, clock.current.reducedMotion);
    const color = severity === "critical" ? ALARM_LIGHT_COLORS.critical : ALARM_LIGHT_COLORS.warning;
    surfaces.current.forEach(({ material, emissive, intensity }) => {
      if (severity === "normal") { material.emissive.copy(emissive); material.emissiveIntensity = intensity; }
      else { material.emissive.set(color); material.emissiveIntensity = pulse * (severity === "critical" ? 0.75 : 0.28); }
    });
    if (perimeter.current) {
      perimeter.current.visible = severity !== "normal";
      perimeter.current.children.forEach((object) => {
        const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial;
        material.color.set(color); material.emissive.set(color); material.emissiveIntensity = pulse * 1.3;
      });
    }
    if (wash.current) { wash.current.color.set(color); wash.current.intensity = pulse * (severity === "critical" ? 35 : 14); }
  });
  const [width, depth] = footprint;
  return <>
    <group ref={machine}>{children}</group>
    <group ref={perimeter} visible={false}>
      {[-1, 1].flatMap((side) => [
        <mesh key={`x${side}`} position={[side * width / 2, 0.052, -0.5]}><boxGeometry args={[0.085, 0.02, depth]} /><meshStandardMaterial color={ALARM_LIGHT_COLORS.critical} emissive={ALARM_LIGHT_COLORS.critical} metalness={0} roughness={1} envMapIntensity={0} /></mesh>,
        <mesh key={`z${side}`} position={[0, 0.052, side * depth / 2 - 0.5]}><boxGeometry args={[width, 0.02, 0.085]} /><meshStandardMaterial color={ALARM_LIGHT_COLORS.critical} emissive={ALARM_LIGHT_COLORS.critical} metalness={0} roughness={1} envMapIntensity={0} /></mesh>,
      ])}
    </group>
    <pointLight ref={wash} position={[0, 4.5, 1.6]} color={ALARM_LIGHT_COLORS.critical} intensity={0} distance={12} decay={1.6} />
  </>;
}

/** A low-frequency hall wash makes the stopped line apparent even with labels hidden. */
export function HallAlarmLight() {
  const clock = useLineClock();
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(({ clock: visualClock }) => {
    const severity = clock.current.alarm.severity;
    if (!light.current) return;
    light.current.color.set(severity === "critical" ? ALARM_LIGHT_COLORS.critical : ALARM_LIGHT_COLORS.warning);
    light.current.intensity = alarmPulse(severity, visualClock.elapsedTime, clock.current.reducedMotion) * (severity === "critical" ? 0.6 : 0.18);
  });
  return <directionalLight ref={light} position={[0, 12, 12]} intensity={0} color={ALARM_LIGHT_COLORS.critical} />;
}

/** A presentation actor only: there is no worker dispatch, repair or PLC command. */
export function MaintenanceDispatch() {
  useDigitalTwinStore((s) => s.tick);
  const alarm = readTwinAlarmState();
  return <MaintenanceResponse targetStageId={maintenanceTarget(alarm)} hazardActive={maintenanceHazardActive(alarm, useDigitalTwinStore.getState().stages)} />;
}
