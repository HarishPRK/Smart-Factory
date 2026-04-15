"use no memo";
import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";

interface ConveyorBeltProps {
  path: [number, number, number][];
  running: boolean;
}

const BELT_SPEED = 2;
// Box geometry below is 0.55 wide; spacing them every 0.4 units gives a small
// overlap, eliminating any visible gaps. Floor of 60 keeps short paths dense.
const SEGMENT_SPACING = 0.4;
const MIN_SEGMENTS = 60;

const ConveyorBelt: React.FC<ConveyorBeltProps> = ({ path, running }) => {
  const instanceRef = useRef<THREE.InstancedMesh>(null);
  const rollerRef = useRef<THREE.Group>(null);

  // Build a smooth CatmullRomCurve3 from the waypoints
  const curve = useMemo(() => {
    const points = path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.3);
  }, [path]);

  const curveLength = useMemo(() => curve.getLength(), [curve]);

  // Segment count scales with path length so the belt is fully continuous
  // regardless of how big the factory layout is.
  const segmentCount = useMemo(
    () => Math.max(MIN_SEGMENTS, Math.ceil(curveLength / SEGMENT_SPACING)),
    [curveLength],
  );

  // Progress array sized to match segmentCount, evenly distributed along belt.
  const progressRef = useRef<Float32Array>(new Float32Array(0));
  useMemo(() => {
    progressRef.current = new Float32Array(segmentCount);
    for (let i = 0; i < segmentCount; i++) {
      progressRef.current[i] = i / segmentCount;
    }
  }, [segmentCount]);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  const tempTangent = useMemo(() => new THREE.Vector3(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const upVec = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const unitScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  // Pre-built segment colors. Every Nth segment is "highlight" Coke red, the
  // rest are dark grey. Because the segments themselves move along the curve,
  // the colored highlights visibly travel — making belt motion obvious.
  const COLOR_BASE = useMemo(() => new THREE.Color("#1f2937"), []);
  const COLOR_HIGHLIGHT = useMemo(() => new THREE.Color("#dc2626"), []);
  const COLOR_HIGHLIGHT_DIM = useMemo(() => new THREE.Color("#7f1d1d"), []);

  useEffect(() => {
    if (!instanceRef.current) return;

    for (let i = 0; i < segmentCount; i++) {
      const mod = i % 6;
      if (mod === 0) tempColor.copy(running ? COLOR_HIGHLIGHT : COLOR_BASE);
      else if (mod === 1)
        tempColor.copy(running ? COLOR_HIGHLIGHT_DIM : COLOR_BASE);
      else tempColor.copy(COLOR_BASE);
      instanceRef.current.setColorAt(i, tempColor);
    }

    if (instanceRef.current.instanceColor) {
      instanceRef.current.instanceColor.needsUpdate = true;
    }
  }, [
    segmentCount,
    running,
    COLOR_BASE,
    COLOR_HIGHLIGHT,
    COLOR_HIGHLIGHT_DIM,
    tempColor,
  ]);

  useFrame((_, delta) => {
    if (!instanceRef.current) return;
    const speedMul = running
      ? useDigitalTwinStore.getState().conveyorSpeedMultiplier
      : 0;

    for (let i = 0; i < segmentCount; i++) {
      if (running) {
        progressRef.current[i] =
          (progressRef.current[i] +
            (delta * BELT_SPEED * speedMul) / curveLength) %
          1;
      }

      const t = progressRef.current[i];
      // Get position and tangent from smooth curve
      curve.getPointAt(t, tempPos);
      curve.getTangentAt(t, tempTangent);

      // Compute rotation quaternion so the belt segment faces along the curve
      const angle = Math.atan2(tempTangent.x, tempTangent.z);
      tempQuat.setFromAxisAngle(upVec, angle);

      tempMatrix.compose(tempPos, tempQuat, unitScale);
      instanceRef.current.setMatrixAt(i, tempMatrix);
    }
    instanceRef.current.instanceMatrix.needsUpdate = true;

    // Spin rollers — each child is a group; its first child is the mesh
    if (running && rollerRef.current) {
      rollerRef.current.children.forEach((group) => {
        const mesh = group.children[0];
        if (mesh) mesh.rotation.y += delta * 2;
      });
    }
  });

  // Roller positions along the smooth curve
  const rollerData = useMemo(() => {
    const data: { pos: THREE.Vector3; angle: number }[] = [];
    const count = Math.ceil(curveLength / 1.5); // One roller every ~1.5 units
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const pos = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const angle = Math.atan2(tan.x, tan.z);
      data.push({ pos, angle });
    }
    return data;
  }, [curve, curveLength]);

  // Support leg positions (fewer — every ~3 units)
  const legData = useMemo(() => {
    const data: { pos: THREE.Vector3; angle: number }[] = [];
    const count = Math.ceil(curveLength / 3);
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const pos = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const angle = Math.atan2(tan.x, tan.z);
      data.push({ pos, angle });
    }
    return data;
  }, [curve, curveLength]);

  return (
    <group>
      {/* Side rails — smooth tube along curve */}
      {[-0.35, 0.35].map((offset) => {
        const sidePoints: THREE.Vector3[] = [];
        const steps = 80;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const pos = curve.getPointAt(t);
          const tan = curve.getTangentAt(t);
          // Perpendicular in XZ plane
          const perpX = -tan.z;
          const perpZ = tan.x;
          const len = Math.sqrt(perpX * perpX + perpZ * perpZ) || 1;
          sidePoints.push(
            new THREE.Vector3(
              pos.x + (perpX / len) * offset,
              pos.y + 0.08,
              pos.z + (perpZ / len) * offset,
            ),
          );
        }
        const sideCurve = new THREE.CatmullRomCurve3(sidePoints, false);
        return (
          <mesh key={offset}>
            <tubeGeometry args={[sideCurve, 64, 0.03, 6, false]} />
            <meshStandardMaterial
              color="#5a5a5a"
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        );
      })}

      {/* Belt center rail (thin, dark) */}
      <mesh>
        <tubeGeometry args={[curve, 64, 0.015, 4, false]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Belt segments (instanced) — flat rubber belt panels.
          frustumCulled=false because instance positions are far from local
          origin and three.js's bounding sphere only covers the base geometry. */}
      <instancedMesh
        ref={instanceRef}
        args={[undefined, undefined, segmentCount]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[0.55, 0.02, 0.55]} />
        <meshStandardMaterial
          color="#1f2937"
          metalness={0.15}
          roughness={0.85}
          emissive="#059669"
          emissiveIntensity={running ? 0.08 : 0}
        />
      </instancedMesh>

      {/* Rollers — perpendicular to curve, spin around cylinder axis */}
      <group ref={rollerRef}>
        {rollerData.map((r, i) => (
          <group
            key={i}
            position={[r.pos.x, r.pos.y - 0.04, r.pos.z]}
            rotation={[Math.PI / 2, r.angle, 0]}
          >
            {/* Inner mesh spins on local Y (cylinder's own axis) */}
            <mesh>
              <cylinderGeometry args={[0.035, 0.035, 0.65, 6]} />
              <meshStandardMaterial
                color="#9ca3af"
                metalness={0.9}
                roughness={0.1}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Support legs */}
      {legData.map((leg, i) => {
        const perpX = -Math.cos(leg.angle);
        const perpZ = Math.sin(leg.angle);
        return (
          <group key={`leg-${i}`}>
            {/* Two legs per station (left + right side) */}
            {[-0.3, 0.3].map((side) => (
              <mesh
                key={side}
                position={[
                  leg.pos.x + perpX * side,
                  leg.pos.y / 2,
                  leg.pos.z + perpZ * side,
                ]}
              >
                <boxGeometry args={[0.04, leg.pos.y, 0.04]} />
                <meshStandardMaterial
                  color="#4b5563"
                  metalness={0.6}
                  roughness={0.4}
                />
              </mesh>
            ))}
            {/* Cross brace */}
            <mesh
              position={[leg.pos.x, leg.pos.y * 0.25, leg.pos.z]}
              rotation={[0, leg.angle, 0]}
            >
              <boxGeometry args={[0.03, 0.03, 0.55]} />
              <meshStandardMaterial
                color="#6b7280"
                metalness={0.5}
                roughness={0.5}
              />
            </mesh>
          </group>
        );
      })}

      {/* End caps */}
      {[0, 1].map((endIdx) => {
        const t = endIdx === 0 ? 0 : 1;
        const pos = curve.getPointAt(t);
        const tan = curve.getTangentAt(Math.min(t + 0.001, 0.999));
        const angle = Math.atan2(tan.x, tan.z);
        const dir = endIdx === 0 ? -1 : 1;
        return (
          <mesh
            key={`cap-${endIdx}`}
            position={[
              pos.x + Math.sin(angle) * 0.15 * dir,
              pos.y,
              pos.z + Math.cos(angle) * 0.15 * dir,
            ]}
            rotation={[0, angle, 0]}
          >
            <boxGeometry args={[0.75, 0.18, 0.08]} />
            <meshStandardMaterial
              color="#d4a017"
              metalness={0.5}
              roughness={0.4}
            />
          </mesh>
        );
      })}

      {/* Status indicator lights */}
      {rollerData
        .filter((_, i) => i % 3 === 0)
        .map((r, i) => {
          const perpX = -Math.cos(r.angle);
          const perpZ = Math.sin(r.angle);
          return (
            <mesh
              key={`light-${i}`}
              position={[
                r.pos.x + perpX * -0.4,
                r.pos.y + 0.1,
                r.pos.z + perpZ * -0.4,
              ]}
            >
              <sphereGeometry args={[0.02, 6, 6]} />
              <meshStandardMaterial
                color={running ? "#22c55e" : "#6b7280"}
                emissive={running ? "#22c55e" : "#333"}
                emissiveIntensity={running ? 0.8 : 0.1}
              />
            </mesh>
          );
        })}
    </group>
  );
};

export default ConveyorBelt;
