"use no memo";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ════════════════════════════════════════════════════════
   FACTORY BUILDING — walls, roof trusses, doors, windows
   ════════════════════════════════════════════════════════ */

const WALL_COLOR = "#3d3d3d";
const WALL_INSIDE = "#4a4a4a";
const ROOF_COLOR = "#2a2a2a";
const BEAM_COLOR = "#555555";
const FLOOR_Y = 0;
const WALL_H = 7;
const HALF_W = 14;  // half-width (x)
const HALF_D = 8.5; // half-depth (z)
const CENTER_Z = 0.5;

const DOUBLE = THREE.DoubleSide;

const Walls: React.FC = () => (
  <group>
    {/* Back wall */}
    <mesh position={[0, WALL_H / 2, CENTER_Z - HALF_D]}>
      <boxGeometry args={[HALF_W * 2, WALL_H, 0.2]} />
      <meshStandardMaterial color={WALL_INSIDE} roughness={0.85} metalness={0.1} side={DOUBLE} />
    </mesh>

    {/* Left wall */}
    <mesh position={[-HALF_W, WALL_H / 2, CENTER_Z]}>
      <boxGeometry args={[0.2, WALL_H, HALF_D * 2]} />
      <meshStandardMaterial color={WALL_COLOR} roughness={0.85} metalness={0.1} side={DOUBLE} />
    </mesh>

    {/* Right wall */}
    <mesh position={[HALF_W, WALL_H / 2, CENTER_Z]}>
      <boxGeometry args={[0.2, WALL_H, HALF_D * 2]} />
      <meshStandardMaterial color={WALL_COLOR} roughness={0.85} metalness={0.1} side={DOUBLE} />
    </mesh>

    {/* Front wall — two sections with gap for roller door */}
    <mesh position={[-9, WALL_H / 2, CENTER_Z + HALF_D]}>
      <boxGeometry args={[10, WALL_H, 0.2]} />
      <meshStandardMaterial color={WALL_COLOR} roughness={0.85} metalness={0.1} side={DOUBLE} />
    </mesh>
    <mesh position={[9, WALL_H / 2, CENTER_Z + HALF_D]}>
      <boxGeometry args={[10, WALL_H, 0.2]} />
      <meshStandardMaterial color={WALL_COLOR} roughness={0.85} metalness={0.1} side={DOUBLE} />
    </mesh>

    {/* Roller door frame */}
    <mesh position={[0, WALL_H - 0.15, CENTER_Z + HALF_D]}>
      <boxGeometry args={[8, 0.3, 0.25]} />
      <meshStandardMaterial color="#d4a017" metalness={0.5} roughness={0.4} />
    </mesh>

    {/* Roller door — partially open (yellow/grey stripes) */}
    {Array.from({ length: 6 }).map((_, i) => (
      <mesh key={i} position={[0, WALL_H - 0.8 - i * 0.25, CENTER_Z + HALF_D - 0.05]}>
        <boxGeometry args={[7.8, 0.22, 0.05]} />
        <meshStandardMaterial color={i % 2 === 0 ? "#d4a017" : "#333"} metalness={0.4} roughness={0.5} side={DOUBLE} />
      </mesh>
    ))}

    {/* Yellow safety stripe at door base */}
    <mesh position={[0, 0.02, CENTER_Z + HALF_D - 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[8, 0.6]} />
      <meshBasicMaterial color="#d4a017" transparent opacity={0.5} />
    </mesh>

    {/* Wall-mounted yellow/black hazard stripes near door */}
    {[-4.1, 4.1].map((x) => (
      <group key={x}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[x, 0.5 + i * 0.5, CENTER_Z + HALF_D - 0.08]}>
            <boxGeometry args={[0.3, 0.22, 0.02]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#d4a017" : "#1a1a1a"} />
          </mesh>
        ))}
      </group>
    ))}

    {/* Small windows on back wall */}
    {[-8, -4, 4, 8].map((x) => (
      <mesh key={x} position={[x, 5.5, CENTER_Z - HALF_D + 0.12]}>
        <planeGeometry args={[1.8, 1]} />
        <meshStandardMaterial color="#1a3050" emissive="#1a3050" emissiveIntensity={0.15} metalness={0.3} roughness={0.3} />
      </mesh>
    ))}
  </group>
);

/* ── Roof Trusses ─────────────────────────────────────── */

const RoofTrusses: React.FC = () => (
  <group>
    {/* Main ridge beam */}
    <mesh position={[0, WALL_H + 0.8, CENTER_Z]}>
      <boxGeometry args={[HALF_W * 2, 0.15, 0.15]} />
      <meshStandardMaterial color={BEAM_COLOR} metalness={0.7} roughness={0.3} />
    </mesh>

    {/* Roof panels (two sloped planes) */}
    <mesh position={[-HALF_W / 2, WALL_H + 0.4, CENTER_Z]} rotation={[0, 0, 0.12]}>
      <boxGeometry args={[HALF_W + 1, 0.06, HALF_D * 2]} />
      <meshStandardMaterial color={ROOF_COLOR} roughness={0.9} metalness={0.15} side={DOUBLE} />
    </mesh>
    <mesh position={[HALF_W / 2, WALL_H + 0.4, CENTER_Z]} rotation={[0, 0, -0.12]}>
      <boxGeometry args={[HALF_W + 1, 0.06, HALF_D * 2]} />
      <meshStandardMaterial color={ROOF_COLOR} roughness={0.9} metalness={0.15} side={DOUBLE} />
    </mesh>

    {/* Cross trusses (triangular frames) */}
    {[-10, -5, 0, 5, 10].map((x) => (
      <group key={x}>
        {/* Bottom chord */}
        <mesh position={[x, WALL_H, CENTER_Z]}>
          <boxGeometry args={[0.1, 0.1, HALF_D * 2 - 0.5]} />
          <meshStandardMaterial color={BEAM_COLOR} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Vertical posts */}
        {[-6, -3, 0, 3, 6].map((z) => (
          <mesh key={z} position={[x, WALL_H + 0.4, CENTER_Z + z]}>
            <boxGeometry args={[0.06, 0.8, 0.06]} />
            <meshStandardMaterial color={BEAM_COLOR} metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
      </group>
    ))}
  </group>
);

/* ════════════════════════════════════════════════════════
   WORKERS — stick-figure humans with helmet + high-vis
   ════════════════════════════════════════════════════════ */

const Worker: React.FC<{
  position: [number, number, number];
  rotation?: number;
  helmetColor?: string;
  jacketColor?: string;
  inspecting?: boolean;
}> = ({ position, rotation = 0, helmetColor = "#f59e0b", jacketColor = "#f97316", inspecting = false }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Subtle idle sway
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const sway = Math.sin(clock.elapsedTime * 1.2 + position[0] * 3) * 0.015;
    groupRef.current.rotation.z = sway;
    if (inspecting) {
      // Looking down slightly
      groupRef.current.children.forEach((child) => {
        if (child.name === "head") {
          child.rotation.x = -0.3 + Math.sin(clock.elapsedTime * 0.8) * 0.1;
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
      {/* Boots */}
      <mesh position={[-0.06, 0.06, 0]}>
        <boxGeometry args={[0.08, 0.12, 0.12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
      <mesh position={[0.06, 0.06, 0]}>
        <boxGeometry args={[0.08, 0.12, 0.12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>

      {/* Legs (dark trousers) */}
      <mesh position={[-0.055, 0.35, 0]}>
        <boxGeometry args={[0.07, 0.5, 0.07]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.8} />
      </mesh>
      <mesh position={[0.055, 0.35, 0]}>
        <boxGeometry args={[0.07, 0.5, 0.07]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.8} />
      </mesh>

      {/* Torso — high-vis jacket */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[0.22, 0.35, 0.14]} />
        <meshStandardMaterial color={jacketColor} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Reflective stripes on jacket */}
      <mesh position={[0, 0.68, 0.072]}>
        <boxGeometry args={[0.23, 0.03, 0.005]} />
        <meshStandardMaterial color="#e8e8e8" emissive="#cccccc" emissiveIntensity={0.3} metalness={0.8} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0.78, 0.072]}>
        <boxGeometry args={[0.23, 0.03, 0.005]} />
        <meshStandardMaterial color="#e8e8e8" emissive="#cccccc" emissiveIntensity={0.3} metalness={0.8} roughness={0.1} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.15, 0.72, inspecting ? 0.08 : 0]} rotation={[inspecting ? -0.8 : 0, 0, 0]}>
        <boxGeometry args={[0.06, 0.35, 0.06]} />
        <meshStandardMaterial color={jacketColor} roughness={0.6} />
      </mesh>
      <mesh position={[0.15, 0.72, inspecting ? 0.08 : 0]} rotation={[inspecting ? -0.6 : 0, 0, 0]}>
        <boxGeometry args={[0.06, 0.35, 0.06]} />
        <meshStandardMaterial color={jacketColor} roughness={0.6} />
      </mesh>
      {/* Hands (skin) */}
      <mesh position={[-0.15, inspecting ? 0.6 : 0.53, inspecting ? 0.2 : 0]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#d4a574" roughness={0.7} />
      </mesh>
      <mesh position={[0.15, inspecting ? 0.62 : 0.53, inspecting ? 0.18 : 0]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#d4a574" roughness={0.7} />
      </mesh>

      {/* Clipboard (if inspecting) */}
      {inspecting && (
        <group position={[0, 0.58, 0.22]} rotation={[-0.7, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.12, 0.16, 0.01]} />
            <meshStandardMaterial color="#f5f0e0" roughness={0.9} />
          </mesh>
          {/* Clip */}
          <mesh position={[0, 0.075, 0.008]}>
            <boxGeometry args={[0.06, 0.02, 0.01]} />
            <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      )}

      {/* Neck */}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.04, 6]} />
        <meshStandardMaterial color="#d4a574" roughness={0.7} />
      </mesh>

      {/* Head */}
      <group name="head" position={[0, 1.06, 0]}>
        {/* Face */}
        <mesh>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color="#d4a574" roughness={0.7} />
        </mesh>
        {/* Hard hat */}
        <mesh position={[0, 0.04, 0]}>
          <sphereGeometry args={[0.095, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={helmetColor} roughness={0.4} metalness={0.2} />
        </mesh>
        {/* Hat brim */}
        <mesh position={[0, 0.01, 0]} rotation={[0.15, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.015, 12]} />
          <meshStandardMaterial color={helmetColor} roughness={0.4} metalness={0.2} />
        </mesh>
      </group>
    </group>
  );
};

/* ════════════════════════════════════════════════════════
   INDUSTRIAL PROPS — shelves, barrels, pallets, extinguisher
   ════════════════════════════════════════════════════════ */

const MetalShelf: React.FC<{ position: [number, number, number]; rotation?: number }> = ({ position, rotation = 0 }) => (
  <group position={position} rotation={[0, rotation, 0]}>
    {/* Uprights */}
    {[[-0.45, -0.2], [-0.45, 0.2], [0.45, -0.2], [0.45, 0.2]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.9, z]}>
        <boxGeometry args={[0.04, 1.8, 0.04]} />
        <meshStandardMaterial color="#5a5a5a" metalness={0.7} roughness={0.3} />
      </mesh>
    ))}
    {/* Shelves */}
    {[0.15, 0.7, 1.25, 1.75].map((y) => (
      <mesh key={y} position={[0, y, 0]}>
        <boxGeometry args={[0.95, 0.03, 0.45]} />
        <meshStandardMaterial color="#666" metalness={0.6} roughness={0.4} />
      </mesh>
    ))}
    {/* Some boxes on shelves */}
    <mesh position={[-0.2, 0.3, 0]}>
      <boxGeometry args={[0.2, 0.25, 0.2]} />
      <meshStandardMaterial color="#8b6914" roughness={0.9} />
    </mesh>
    <mesh position={[0.15, 0.3, 0.05]}>
      <boxGeometry args={[0.25, 0.2, 0.18]} />
      <meshStandardMaterial color="#7a5c1a" roughness={0.9} />
    </mesh>
    <mesh position={[0, 0.85, -0.05]}>
      <boxGeometry args={[0.3, 0.22, 0.2]} />
      <meshStandardMaterial color="#2563eb" roughness={0.7} />
    </mesh>
  </group>
);

const Barrel: React.FC<{ position: [number, number, number]; color?: string }> = ({ position, color = "#2563eb" }) => (
  <group position={position}>
    <mesh position={[0, 0.35, 0]}>
      <cylinderGeometry args={[0.2, 0.2, 0.7, 12]} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
    </mesh>
    {/* Top/bottom rims */}
    {[0.02, 0.68].map((y) => (
      <mesh key={y} position={[0, y, 0]}>
        <torusGeometry args={[0.2, 0.015, 6, 16]} />
        <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
      </mesh>
    ))}
  </group>
);

const Pallet: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    {/* Boards */}
    {[-0.18, 0, 0.18].map((z) => (
      <mesh key={z} position={[0, 0.04, z]}>
        <boxGeometry args={[0.5, 0.03, 0.12]} />
        <meshStandardMaterial color="#8b7355" roughness={0.95} />
      </mesh>
    ))}
    {/* Blocks */}
    {[-0.18, 0, 0.18].map((x) => (
      <mesh key={x} position={[x, 0.015, 0]}>
        <boxGeometry args={[0.1, 0.06, 0.45]} />
        <meshStandardMaterial color="#7a6644" roughness={0.95} />
      </mesh>
    ))}
  </group>
);

const FireExtinguisher: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    {/* Tank */}
    <mesh position={[0, 0.3, 0]}>
      <cylinderGeometry args={[0.06, 0.06, 0.45, 8]} />
      <meshStandardMaterial color="#cc0000" metalness={0.4} roughness={0.4} />
    </mesh>
    {/* Top valve */}
    <mesh position={[0, 0.54, 0]}>
      <cylinderGeometry args={[0.03, 0.04, 0.06, 6]} />
      <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
    </mesh>
    {/* Handle */}
    <mesh position={[0.04, 0.55, 0]}>
      <boxGeometry args={[0.04, 0.02, 0.02]} />
      <meshStandardMaterial color="#333" metalness={0.6} roughness={0.3} />
    </mesh>
    {/* Wall bracket */}
    <mesh position={[0, 0.35, -0.07]}>
      <boxGeometry args={[0.12, 0.25, 0.02]} />
      <meshStandardMaterial color="#555" metalness={0.6} roughness={0.4} />
    </mesh>
  </group>
);

/* ════════════════════════════════════════════════════════
   MAIN EXPORT — Everything combined
   ════════════════════════════════════════════════════════ */

const FactoryEnvironment: React.FC = () => (
  <group>
    <Walls />
    <RoofTrusses />

    {/* ── Workers ────────────────────────────────────── */}

    {/* Inspector at Injection Molding — looking at machine with clipboard */}
    <Worker position={[-5.5, 0, -1.5]} rotation={-0.5} helmetColor="#f59e0b" jacketColor="#f97316" inspecting />

    {/* Technician at Hydraulic Press */}
    <Worker position={[1.5, 0, -1]} rotation={-1.2} helmetColor="#ffffff" jacketColor="#f97316" inspecting />

    {/* Supervisor walking near conveyor */}
    <Worker position={[-2, 0, 4]} rotation={0.3} helmetColor="#2563eb" jacketColor="#eab308" />

    {/* Worker near Industrial Boiler — checking gauges */}
    <Worker position={[5.8, 0, -1]} rotation={1.8} helmetColor="#f59e0b" jacketColor="#f97316" inspecting />

    {/* Worker near CNC Lathe */}
    <Worker position={[1.5, 0, 4.2]} rotation={-0.8} helmetColor="#ffffff" jacketColor="#ea580c" />

    {/* Worker near Cooling Tower */}
    <Worker position={[8.5, 0, 4]} rotation={2.5} helmetColor="#f59e0b" jacketColor="#f97316" />

    {/* ── Industrial Props ───────────────────────────── */}

    {/* Shelving units against back wall */}
    <MetalShelf position={[-12.5, 0, -7]} rotation={0} />
    <MetalShelf position={[-12.5, 0, -4.5]} rotation={0} />
    <MetalShelf position={[12.5, 0, -7]} rotation={Math.PI} />
    <MetalShelf position={[12.5, 0, -4.5]} rotation={Math.PI} />

    {/* Barrel clusters */}
    <Barrel position={[-12, 0, 0]} color="#2563eb" />
    <Barrel position={[-11.6, 0, 0.5]} color="#059669" />
    <Barrel position={[-12.3, 0, 0.7]} color="#dc2626" />

    <Barrel position={[12, 0, 2]} color="#2563eb" />
    <Barrel position={[12.4, 0, 2.5]} color="#f59e0b" />

    {/* Pallets removed — stray crates cluttering the floor */}


    {/* Fire extinguishers on walls */}
    <FireExtinguisher position={[-13.8, 0, -2]} />
    <FireExtinguisher position={[13.8, 0, -2]} />
    <FireExtinguisher position={[0, 0, -7.8]} />

    {/* EXIT sign above door */}
    <mesh position={[0, WALL_H - 0.3, CENTER_Z + HALF_D - 0.15]}>
      <boxGeometry args={[0.8, 0.25, 0.04]} />
      <meshStandardMaterial color="#059669" emissive="#059669" emissiveIntensity={0.8} side={DOUBLE} />
    </mesh>

    {/* ── Interior wall lights ──────────────────────── */}

    {/* Back wall lights */}
    {[-9, -3, 3, 9].map((x) => (
      <group key={`bw-${x}`}>
        <mesh position={[x, 4.5, CENTER_Z - HALF_D + 0.2]}>
          <boxGeometry args={[0.6, 0.12, 0.15]} />
          <meshStandardMaterial color="#ddd" emissive="#ffeedd" emissiveIntensity={0.6} />
        </mesh>
        <pointLight position={[x, 4.2, CENTER_Z - HALF_D + 0.8]} color="#ffeedd" intensity={0.4} distance={8} decay={2} />
      </group>
    ))}

    {/* Side wall lights */}
    {[-5, 0, 5].map((z) => (
      <React.Fragment key={`sw-${z}`}>
        <group>
          <mesh position={[-HALF_W + 0.2, 4.5, CENTER_Z + z]}>
            <boxGeometry args={[0.15, 0.12, 0.6]} />
            <meshStandardMaterial color="#ddd" emissive="#ffeedd" emissiveIntensity={0.6} />
          </mesh>
          <pointLight position={[-HALF_W + 0.8, 4.2, CENTER_Z + z]} color="#ffeedd" intensity={0.35} distance={7} decay={2} />
        </group>
        <group>
          <mesh position={[HALF_W - 0.2, 4.5, CENTER_Z + z]}>
            <boxGeometry args={[0.15, 0.12, 0.6]} />
            <meshStandardMaterial color="#ddd" emissive="#ffeedd" emissiveIntensity={0.6} />
          </mesh>
          <pointLight position={[HALF_W - 0.8, 4.2, CENTER_Z + z]} color="#ffeedd" intensity={0.35} distance={7} decay={2} />
        </group>
      </React.Fragment>
    ))}
  </group>
);

export default FactoryEnvironment;
