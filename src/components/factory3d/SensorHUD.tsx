"use no memo";
import React, { useState, useMemo, useCallback } from "react";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { isSensorLive } from "../../stores/digitalTwinSimulation";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import { setCameraTarget, resetCameraView } from "./CameraController";
import type { StageId } from "../../types/digitalTwin";

/**
 * SensorHUD — Compact real-time sensor dashboard overlay
 *
 * Positioned absolutely over the 3D canvas (top-right).
 * Subscribes to the store `tick` counter (500ms updates) — not per-frame.
 * Shows one primary sensor per key stage with mini sparklines.
 * Clicking a row flies the camera to that station.
 */

const PRIMARY_SENSORS: { stageId: StageId; sensorId: string; label: string; stageLabel: string }[] = [
  // Intake
  { stageId: "intake",    sensorId: "intake_gps",         label: "GPS",          stageLabel: "Intake" },
  { stageId: "intake",    sensorId: "intake_lidar",       label: "LiDAR",        stageLabel: "Intake" },
  { stageId: "intake",    sensorId: "intake_fingerprint", label: "Fingerprint",  stageLabel: "Intake" },
  // Mixing
  { stageId: "mixing",    sensorId: "mixing_ph",          label: "pH",           stageLabel: "Mixing" },
  { stageId: "mixing",    sensorId: "mixing_orp",         label: "ORP",          stageLabel: "Mixing" },
  { stageId: "mixing",    sensorId: "mixing_turbidity",   label: "Turbidity",    stageLabel: "Mixing" },
  { stageId: "mixing",    sensorId: "mixing_mq",          label: "MQ Gas",       stageLabel: "Mixing" },
  // Forming
  { stageId: "forming",   sensorId: "forming_pressure",   label: "Pressure",     stageLabel: "Forming" },
  { stageId: "forming",   sensorId: "forming_light",      label: "Light",        stageLabel: "Forming" },
  // Curing
  { stageId: "curing",    sensorId: "curing_o2",          label: "O2",           stageLabel: "Curing" },
  { stageId: "curing",    sensorId: "curing_mq",          label: "MQ Gas",       stageLabel: "Curing" },
  { stageId: "curing",    sensorId: "curing_motion",      label: "Motion",       stageLabel: "Curing" },
  // Quality
  { stageId: "quality",   sensorId: "quality_lidar",      label: "LiDAR",        stageLabel: "Quality" },
  { stageId: "quality",   sensorId: "quality_light",      label: "Light",        stageLabel: "Quality" },
  { stageId: "quality",   sensorId: "quality_turbidity",  label: "Turbidity",    stageLabel: "Quality" },
  // Packaging
  { stageId: "packaging", sensorId: "pkg_motion",         label: "Motion",       stageLabel: "Packaging" },
  { stageId: "packaging", sensorId: "pkg_pressure",       label: "Pressure",     stageLabel: "Packaging" },
  { stageId: "packaging", sensorId: "pkg_water",          label: "Water",        stageLabel: "Packaging" },
  // Dispatch
  { stageId: "dispatch",  sensorId: "dispatch_gps",       label: "GPS",          stageLabel: "Dispatch" },
  { stageId: "dispatch",  sensorId: "dispatch_fingerprint", label: "Fingerprint", stageLabel: "Dispatch" },
];

const STATUS_COLORS: Record<string, string> = {
  normal: "#10b981",
  warning: "#f59e0b",
  critical: "#ef4444",
};

const MiniSparkline: React.FC<{ data: number[]; color: string; width?: number; height?: number }> = ({
  data,
  color,
  width = 60,
  height = 18,
}) => {
  const valid = data.filter((v) => typeof v === "number" && !isNaN(v));
  if (valid.length < 2) return null;

  const slice = valid.slice(-20);
  const min = Math.min(...slice);
  const max = Math.max(...slice);
  const range = max - min || 1;

  const points = slice
    .map((v, i) => {
      const x = (i / Math.max(1, slice.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
    </svg>
  );
};

const SensorHUD: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeStage, setActiveStage] = useState<StageId | null>(null);

  const tick = useDigitalTwinStore((s) => s.tick);

  const sensorData = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    tick;
    const state = useDigitalTwinStore.getState();
    const stages = state.stages;
    const histories = state.sensorHistories;

    return PRIMARY_SENSORS.map((ps) => {
      const stage = stages.find((s) => s.id === ps.stageId);
      const sensor = stage?.sensors.find((s) => s.sensorId === ps.sensorId);
      const history = histories[ps.sensorId] ?? [];

      return {
        ...ps,
        value: sensor?.value ?? 0,
        unit: sensor?.unit ?? "",
        status: sensor?.status ?? "normal",
        history: history,
        stageStatus: stage?.status ?? "idle",
        live: isSensorLive(ps.sensorId),
      };
    });
  }, [tick]);

  const handleStageClick = useCallback((stageId: StageId) => {
    if (activeStage === stageId) {
      // Click again to reset to overview
      setActiveStage(null);
      resetCameraView();
      return;
    }

    setActiveStage(stageId);
    const pos = STAGE_POSITIONS[stageId];
    // Camera flies to a position offset from the stage (elevated + angled)
    setCameraTarget(
      [pos[0] + 3, pos[1] + 4, pos[2] + 5],
      [pos[0], pos[1], pos[2]],
    );
  }, [activeStage]);

  return (
    <div
      style={{
        position: "absolute",
        top: "12px",
        right: "12px",
        zIndex: 10,
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        userSelect: "none",
        willChange: "transform",
        contain: "layout style",
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "28px",
          height: "28px",
          background: "rgba(10, 22, 40, 0.9)",
          /* backdrop-filter removed for performance — causes repaint every frame */
          border: "1px solid rgba(100,116,139,0.3)",
          borderRadius: "6px",
          color: "#94a3b8",
          fontSize: "14px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 11,
        }}
      >
        {collapsed ? "\u25C0" : "\u25B6"}
      </button>

      {!collapsed && (
        <div
          style={{
            background: "rgba(10, 22, 40, 0.92)",
            /* backdrop-filter removed for performance */
            border: "1px solid rgba(100,116,139,0.25)",
            borderRadius: "8px",
            padding: "10px",
            paddingTop: "6px",
            width: "240px",
            maxHeight: "calc(100vh - 80px)",
            overflowY: "auto",
            marginRight: "36px",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
              paddingBottom: "4px",
              borderBottom: "1px solid rgba(100,116,139,0.2)",
            }}
          >
            <span style={{ color: "#e2e8f0", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em" }}>
              SENSOR MONITOR
            </span>
            {activeStage && (
              <button
                onClick={() => { setActiveStage(null); resetCameraView(); }}
                style={{
                  background: "rgba(100,116,139,0.2)",
                  border: "none",
                  borderRadius: "3px",
                  color: "#94a3b8",
                  fontSize: "8px",
                  padding: "2px 5px",
                  cursor: "pointer",
                }}
              >
                RESET VIEW
              </button>
            )}
          </div>

          {/* Sensor rows */}
          {sensorData.map((s) => {
            const statusColor = STATUS_COLORS[s.status] ?? STATUS_COLORS.normal;
            const formatted = s.unit === "" || s.unit === "m"
              ? s.value.toFixed(1)
              : s.value.toFixed(s.value >= 100 ? 0 : 1);
            const isActive = activeStage === s.stageId;

            return (
              <div
                key={s.sensorId}
                onClick={() => handleStageClick(s.stageId)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 4px",
                  borderBottom: "1px solid rgba(100,116,139,0.1)",
                  cursor: "pointer",
                  borderRadius: "4px",
                  background: isActive ? "rgba(59, 130, 246, 0.15)" : "transparent",
                  borderLeft: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                  transition: "background 0.2s, border-left 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "rgba(100,116,139,0.1)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              >
                {/* Status dot */}
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: statusColor,
                    boxShadow: s.status !== "normal" ? `0 0 6px ${statusColor}` : "none",
                    flexShrink: 0,
                  }}
                />

                {/* Stage + sensor label */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#94a3b8", fontSize: "8px", lineHeight: 1.2 }}>
                    {s.stageLabel}
                  </div>
                  <div
                    style={{
                      color: "#e2e8f0",
                      fontSize: "10px",
                      fontWeight: 600,
                      lineHeight: 1.2,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {s.label}
                    {/* LIVE vs SIM chip — tells the operator whether this row
                        is fed by the real MQTT payload or simulated drift. */}
                    <span
                      title={
                        s.live
                          ? "Live — driven by the PLC MQTT payload"
                          : "Simulated — no matching payload key"
                      }
                      style={{
                        fontSize: "7px",
                        fontWeight: 800,
                        letterSpacing: "0.1em",
                        padding: "1px 4px",
                        borderRadius: "2px",
                        border: `1px solid ${s.live ? "rgba(63,166,106,0.5)" : "rgba(138,151,168,0.35)"}`,
                        color: s.live ? "#3fa66a" : "#8a97a8",
                        background: s.live ? "rgba(63,166,106,0.10)" : "transparent",
                      }}
                    >
                      {s.live ? "LIVE" : "SIM"}
                    </span>
                  </div>
                </div>

                {/* Value */}
                <div
                  style={{
                    color: statusColor,
                    fontSize: "11px",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                    minWidth: "45px",
                    textAlign: "right",
                  }}
                >
                  {formatted}
                  <span style={{ fontSize: "8px", color: "#94a3b8", marginLeft: "2px" }}>{s.unit}</span>
                </div>

                {/* Sparkline */}
                <MiniSparkline data={s.history} color={statusColor} width={50} height={16} />
              </div>
            );
          })}

          {/* Click hint */}
          <div style={{ color: "#64748b", fontSize: "7px", textAlign: "center", marginTop: "6px" }}>
            Click a sensor to fly to station
          </div>
        </div>
      )}
    </div>
  );
};

export default SensorHUD;
