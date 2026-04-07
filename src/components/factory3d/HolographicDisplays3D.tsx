"use no memo";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";

/**
 * HolographicDisplays3D — Floating holographic stat screens in 3D space
 *
 * Large transparent panels floating above the factory showing live KPIs.
 * Gently rotating, with scan-line effects.
 */
const HolographicDisplays3D: React.FC = () => {
  const panel1Ref = useRef<THREE.Group>(null);
  const panel2Ref = useRef<THREE.Group>(null);
  const scanLineRef = useRef<THREE.Mesh>(null);

  const tick = useDigitalTwinStore((s) => s.tick);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Gentle float
    if (panel1Ref.current) {
      panel1Ref.current.position.y = 3.8 + Math.sin(t * 0.5) * 0.1;
      panel1Ref.current.rotation.y = Math.sin(t * 0.1) * 0.05;
    }
    if (panel2Ref.current) {
      panel2Ref.current.position.y = 3.8 + Math.sin(t * 0.5 + 1) * 0.1;
      panel2Ref.current.rotation.y = Math.sin(t * 0.1 + 2) * 0.05;
    }
    // Scan line sweep
    if (scanLineRef.current) {
      scanLineRef.current.position.y = ((t * 0.3) % 1) * 1.2 - 0.6;
    }
  });

  const state = useDigitalTwinStore.getState();
  const produced = state.totalProduced;
  const rejected = state.totalRejected;
  const throughput = state.throughputPerMin;
  const speed = state.userSpeedMultiplier;
  const scenario = state.activeScenario;

  return (
    <group>
      {/* ── Main KPI Hologram — left side of factory ── */}
      <group ref={panel1Ref} position={[-10, 3.8, 2]}>
        {/* Holographic frame */}
        <mesh>
          <planeGeometry args={[2.5, 1.5]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.04} side={THREE.DoubleSide} />
        </mesh>
        {/* Frame border */}
        <mesh>
          <planeGeometry args={[2.55, 1.55]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.08} side={THREE.DoubleSide} wireframe />
        </mesh>
        {/* Scan line */}
        <mesh ref={scanLineRef} position={[0, 0, 0.01]}>
          <planeGeometry args={[2.4, 0.02]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.3} />
        </mesh>
        {/* Content via Html */}
        <Html position={[0, 0, 0.02]} center distanceFactor={8} style={{ pointerEvents: "none", willChange: "transform" }}>
          <div style={{
            width: "240px",
            fontFamily: "'Inter', system-ui, sans-serif",
            color: "#93c5fd",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "8px", letterSpacing: "0.15em", color: "#60a5fa", marginBottom: "8px" }}>
              SMART FACTORY - LIVE PRODUCTION
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "6px" }}>
              <div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#10b981" }}>{produced}</div>
                <div style={{ fontSize: "7px", color: "#64748b" }}>PRODUCED</div>
              </div>
              <div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#ef4444" }}>{rejected}</div>
                <div style={{ fontSize: "7px", color: "#64748b" }}>REJECTED</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-around" }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#3b82f6" }}>{throughput.toFixed(1)}/min</div>
                <div style={{ fontSize: "7px", color: "#64748b" }}>THROUGHPUT</div>
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#f59e0b" }}>{(speed * 100).toFixed(0)}%</div>
                <div style={{ fontSize: "7px", color: "#64748b" }}>BELT SPEED</div>
              </div>
            </div>
            {scenario && (
              <div style={{ marginTop: "6px", fontSize: "9px", color: "#ef4444", fontWeight: 700, animation: "pulse 1s infinite" }}>
                ⚠ SCENARIO: {scenario.replace(/_/g, " ").toUpperCase()}
              </div>
            )}
          </div>
        </Html>
        {/* Holographic base beam */}
        <pointLight position={[0, -0.8, 0]} color="#3b82f6" intensity={0.15} distance={3} decay={2} />
      </group>

      {/* ── Quality Hologram — right side ── */}
      <group ref={panel2Ref} position={[10, 3.8, -2]}>
        <mesh>
          <planeGeometry args={[2.0, 1.2]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.04} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <planeGeometry args={[2.05, 1.25]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.08} side={THREE.DoubleSide} wireframe />
        </mesh>
        <Html position={[0, 0, 0.02]} center distanceFactor={8} style={{ pointerEvents: "none", willChange: "transform" }}>
          <div style={{
            width: "200px",
            fontFamily: "'Inter', system-ui, sans-serif",
            color: "#86efac",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "8px", letterSpacing: "0.15em", color: "#4ade80", marginBottom: "8px" }}>
              QUALITY METRICS
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: rejected === 0 ? "#10b981" : "#f59e0b" }}>
              {produced > 0 ? ((1 - rejected / Math.max(1, produced)) * 100).toFixed(1) : "100.0"}%
            </div>
            <div style={{ fontSize: "8px", color: "#64748b", marginBottom: "6px" }}>YIELD RATE</div>
            <div style={{ display: "flex", justifyContent: "space-around" }}>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#10b981" }}>0</div>
                <div style={{ fontSize: "7px", color: "#64748b" }}>DEFECTS/HR</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#22d3ee" }}>A+</div>
                <div style={{ fontSize: "7px", color: "#64748b" }}>GRADE</div>
              </div>
            </div>
          </div>
        </Html>
        <pointLight position={[0, -0.8, 0]} color="#10b981" intensity={0.15} distance={3} decay={2} />
      </group>
    </group>
  );
};

export default HolographicDisplays3D;
