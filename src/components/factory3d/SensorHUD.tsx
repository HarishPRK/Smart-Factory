"use no memo";
import React, { useState, useMemo, useCallback } from "react";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";
import { isSensorLive } from "../../stores/digitalTwinSimulation";
import type { StageId } from "../../types/digitalTwin";

/**
 * SensorHUD â€” Compact real-time sensor dashboard overlay
 *
 * Positioned absolutely over the 3D canvas (top-right).
 * Subscribes to the store `tick` counter (500ms updates) â€” not per-frame.
 * Shows one primary sensor per key stage with mini sparklines.
 * Clicking a row flies the camera to that station.
 */

const PRIMARY_SENSORS: { stageId: StageId; sensorId: string; label: string; stageLabel: string }[] = [
  // Intake
  { stageId: "intake",    sensorId: "intake_gps",           label: "GPS",          stageLabel: "Intake" },
  { stageId: "intake",    sensorId: "intake_lidar",         label: "LiDAR",        stageLabel: "Intake" },
  { stageId: "intake",    sensorId: "intake_fingerprint",   label: "Fingerprint",  stageLabel: "Intake" },
  { stageId: "intake",    sensorId: "intake_rfid",          label: "RFID",         stageLabel: "Intake" },
  { stageId: "intake",    sensorId: "intake_optical",       label: "Optical",      stageLabel: "Intake" },
  // Mixing
  { stageId: "mixing",    sensorId: "mixing_ph",            label: "pH",           stageLabel: "Mixing" },
  { stageId: "mixing",    sensorId: "mixing_orp",           label: "ORP",          stageLabel: "Mixing" },
  { stageId: "mixing",    sensorId: "mixing_turbidity",     label: "Turbidity",    stageLabel: "Mixing" },
  { stageId: "mixing",    sensorId: "mixing_mq",            label: "MQ Gas",       stageLabel: "Mixing" },
  { stageId: "mixing",    sensorId: "mixing_water_level",   label: "Syrup Tank",   stageLabel: "Mixing" },
  { stageId: "mixing",    sensorId: "mixing_flow_liquid",   label: "Syrup Flow",   stageLabel: "Mixing" },
  { stageId: "mixing",    sensorId: "mixing_valve",         label: "Fill Valve",   stageLabel: "Mixing" },
  // Forming
  { stageId: "forming",   sensorId: "forming_pressure",     label: "Pressure",     stageLabel: "Forming" },
  { stageId: "forming",   sensorId: "forming_light",        label: "Light",        stageLabel: "Forming" },
  { stageId: "forming",   sensorId: "forming_proximity",    label: "Proximity",    stageLabel: "Forming" },
  { stageId: "forming",   sensorId: "forming_flow_air",     label: "Blow Air",     stageLabel: "Forming" },
  // Curing
  { stageId: "curing",    sensorId: "curing_o2",            label: "O2",           stageLabel: "Curing" },
  { stageId: "curing",    sensorId: "curing_mq",            label: "MQ Gas",       stageLabel: "Curing" },
  { stageId: "curing",    sensorId: "curing_motion",        label: "Motion",       stageLabel: "Curing" },
  { stageId: "curing",    sensorId: "curing_fire",          label: "Fire",         stageLabel: "Curing" },
  { stageId: "curing",    sensorId: "curing_flow_air",      label: "Cooling Air",  stageLabel: "Curing" },
  // Quality
  { stageId: "quality",   sensorId: "quality_lidar",        label: "LiDAR",        stageLabel: "Quality" },
  { stageId: "quality",   sensorId: "quality_light",        label: "Light",        stageLabel: "Quality" },
  { stageId: "quality",   sensorId: "quality_turbidity",    label: "Turbidity",    stageLabel: "Quality" },
  { stageId: "quality",   sensorId: "quality_optical",      label: "Optical",      stageLabel: "Quality" },
  // Packaging
  { stageId: "packaging", sensorId: "pkg_motion",           label: "Motion",       stageLabel: "Packaging" },
  { stageId: "packaging", sensorId: "pkg_pressure",         label: "Pressure",     stageLabel: "Packaging" },
  { stageId: "packaging", sensorId: "pkg_water",            label: "Water",        stageLabel: "Packaging" },
  { stageId: "packaging", sensorId: "pkg_proximity",        label: "Proximity",    stageLabel: "Packaging" },
  { stageId: "packaging", sensorId: "pkg_fire",             label: "Fire",         stageLabel: "Packaging" },
  // Dispatch
  { stageId: "dispatch",  sensorId: "dispatch_gps",         label: "GPS",          stageLabel: "Dispatch" },
  { stageId: "dispatch",  sensorId: "dispatch_fingerprint", label: "Fingerprint",  stageLabel: "Dispatch" },
  { stageId: "dispatch",  sensorId: "dispatch_rfid",        label: "RFID",         stageLabel: "Dispatch" },
  { stageId: "dispatch",  sensorId: "dispatch_touch",       label: "Confirm Pad",  stageLabel: "Dispatch" },
];

// E-stop sensors â€” surfaced as a single line-wide pill at the top of the HUD.
const ESTOP_SENSOR_IDS = ["forming_estop", "mixing_estop", "pkg_estop"] as const;

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
  const activeStage = useSceneSelectionStore((s) => s.selectedStageId);
  const toggleStage = useSceneSelectionStore((s) => s.toggle);
  const clearStage = useSceneSelectionStore((s) => s.clear);

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

  // Line-wide E-stop status â€” any critical reading across the three operator panels
  // freezes the whole line (see digitalTwinSimulation.evaluateThresholds).
  const estopCritical = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    tick;
    const stages = useDigitalTwinStore.getState().stages;
    return stages.some((stage) =>
      stage.sensors.some(
        (s) => ESTOP_SENSOR_IDS.includes(s.sensorId as typeof ESTOP_SENSOR_IDS[number]) && s.status === "critical",
      ),
    );
  }, [tick]);

  // Clicking a row toggles the shared selection store. ProcessPipeline3D's
  // effect reacts to this and flies the camera to the stage's front-on view;
  // ControlBoard3D reacts by enlarging the matching banner. Keeps the HUD,
  // the 3D click path, and ESC all in lock-step.
  const handleStageClick = useCallback(
    (stageId: StageId) => {
      toggleStage(stageId);
    },
    [toggleStage],
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "12px",
        right: "12px",
        zIndex: 10,
        fontFamily: "'Montserrat', 'Segoe UI', system-ui, sans-serif",
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
          /* backdrop-filter removed for performance â€” causes repaint every frame */
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
                onClick={() => { clearStage(); }}
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

          {/* Line-wide E-stop pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 6px",
              marginBottom: "6px",
              borderRadius: "5px",
              background: estopCritical
                ? "rgba(239, 68, 68, 0.18)"
                : "rgba(16, 185, 129, 0.10)",
              border: `1px solid ${
                estopCritical ? "rgba(239,68,68,0.6)" : "rgba(16,185,129,0.35)"
              }`,
              boxShadow: estopCritical ? "0 0 8px rgba(239,68,68,0.55)" : "none",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: estopCritical ? "#fca5a5" : "#94a3b8",
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: estopCritical ? "#ef4444" : "#10b981",
                  boxShadow: estopCritical ? "0 0 6px #ef4444" : "none",
                }}
              />
              EMERGENCY STOP
            </span>
            <span
              style={{
                color: estopCritical ? "#fca5a5" : "#3fa66a",
                fontSize: "9px",
                fontWeight: 800,
                letterSpacing: "0.1em",
              }}
            >
              {estopCritical ? "TRIGGERED" : "CLEAR"}
            </span>
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
                    }}
                  >
                    {s.label}
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
