"use no memo";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import {
  runDigitalTwinScenario,
  DT_SCENARIOS,
} from "../../stores/digitalTwinSimulation";
import {
  resetCameraView,
  setCameraTarget,
  startAutoTour,
  stopAutoTour,
  isAutoTourActive,
  getAutoTourLabel,
} from "./CameraController";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import { useSceneSettingsStore } from "../../stores/sceneSettingsStore";

/**
 * FunControls â€” Interactive control panel for playing with the factory
 *
 * Features:
 *  - Conveyor speed slider (0.1x to 3x)
 *  - Scenario trigger buttons (Chemical Spill, Gas Leak, etc.)
 *  - Day/Night mode toggle
 *  - Camera preset views (Overview, Close-up stations, Fly-through)
 *  - Production counter with milestone celebrations
 *  - Keyboard shortcuts guide
 */

const CAMERA_PRESETS: {
  label: string;
  icon: string;
  position: [number, number, number];
  target: [number, number, number];
}[] = [
  {
    label: "Overview",
    icon: "\uD83C\uDFED",
    position: [18, 14, 18],
    target: [0, 0, 0],
  },
  {
    label: "Intake Close-up",
    icon: "\uD83D\uDCE6",
    position: [STAGE_POSITIONS.intake[0] + 2, 3, STAGE_POSITIONS.intake[2] + 3],
    target: STAGE_POSITIONS.intake,
  },
  {
    label: "Blow Molding",
    icon: "\uD83C\uDFAF",
    position: [
      STAGE_POSITIONS.forming[0] - 2,
      3,
      STAGE_POSITIONS.forming[2] + 3,
    ],
    target: STAGE_POSITIONS.forming,
  },
  {
    label: "Filling Station",
    icon: "\uD83E\uDD64",
    position: [STAGE_POSITIONS.mixing[0] + 3, 3, STAGE_POSITIONS.mixing[2] + 2],
    target: STAGE_POSITIONS.mixing,
  },
  {
    label: "Cooling Tunnel",
    icon: "\u2744\uFE0F",
    position: [STAGE_POSITIONS.curing[0] + 3, 2, STAGE_POSITIONS.curing[2] + 3],
    target: STAGE_POSITIONS.curing,
  },
  {
    label: "Quality Lab",
    icon: "\uD83D\uDD2C",
    position: [
      STAGE_POSITIONS.quality[0] - 2,
      3,
      STAGE_POSITIONS.quality[2] + 3,
    ],
    target: STAGE_POSITIONS.quality,
  },
  {
    label: "Dispatch Dock",
    icon: "\uD83D\uDE9A",
    position: [
      STAGE_POSITIONS.dispatch[0] + 4,
      4,
      STAGE_POSITIONS.dispatch[2] + 5,
    ],
    target: STAGE_POSITIONS.dispatch,
  },
  {
    label: "Bird's Eye",
    icon: "\uD83E\uDD85",
    position: [0, 25, 0.1],
    target: [0, 0, 0],
  },
  {
    label: "Cinematic",
    icon: "\uD83C\uDFAC",
    position: [-15, 8, 12],
    target: [0, 0, 0],
  },
];

const FunControls: React.FC<{
  onDayNightToggle?: (isNight: boolean) => void;
}> = ({ onDayNightToggle }) => {
  // Default collapsed. On laptop-sized viewports the fully-expanded panel is
  // taller than the 3D scene container and pushes the CONTROLS toggle off-screen
  // (the user couldn't close it). Starting collapsed keeps the trigger visible
  // and lets the user choose to expand.
  const [expanded, setExpanded] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [isNight, setIsNight] = useState(true);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const particlesEnabled = useSceneSettingsStore((s) => s.particlesEnabled);
  const extrasEnabled    = useSceneSettingsStore((s) => s.extrasEnabled);
  const cctvEnabled      = useSceneSettingsStore((s) => s.cctvEnabled);
  const labelsVisible    = useSceneSettingsStore((s) => s.labelsVisible);
  const quality          = useSceneSettingsStore((s) => s.quality);
  const setParticles     = useSceneSettingsStore((s) => s.setParticles);
  const setExtras        = useSceneSettingsStore((s) => s.setExtras);
  const setCCTV          = useSceneSettingsStore((s) => s.setCCTV);
  const setLabels        = useSceneSettingsStore((s) => s.setLabels);
  const setQuality       = useSceneSettingsStore((s) => s.setQuality);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    // Set the user override â€” simulation combines this with threshold speed
    useDigitalTwinStore.setState({ userSpeedMultiplier: newSpeed });
  }, []);

  const handleScenario = useCallback((scenarioId: string) => {
    setActiveScenario(scenarioId);
    runDigitalTwinScenario(scenarioId);
    // Auto-clear after scenario duration
    setTimeout(() => setActiveScenario(null), 30000);
  }, []);

  const handleDayNight = useCallback(() => {
    const next = !isNight;
    setIsNight(next);
    onDayNightToggle?.(next);
  }, [isNight, onDayNightToggle]);

  const handleCameraPreset = useCallback(
    (preset: (typeof CAMERA_PRESETS)[0]) => {
      setCameraTarget(preset.position, preset.target);
    },
    [],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      switch (e.key) {
        case "1":
          handleCameraPreset(CAMERA_PRESETS[0]);
          break;
        case "2":
          handleCameraPreset(CAMERA_PRESETS[1]);
          break;
        case "3":
          handleCameraPreset(CAMERA_PRESETS[2]);
          break;
        case "4":
          handleCameraPreset(CAMERA_PRESETS[3]);
          break;
        case "5":
          handleCameraPreset(CAMERA_PRESETS[4]);
          break;
        case "6":
          handleCameraPreset(CAMERA_PRESETS[5]);
          break;
        case "7":
          handleCameraPreset(CAMERA_PRESETS[6]);
          break;
        case "8":
          handleCameraPreset(CAMERA_PRESETS[7]);
          break;
        case "9":
          handleCameraPreset(CAMERA_PRESETS[8]);
          break;
        case "+":
        case "=":
          handleSpeedChange(Math.min(3, speed + 0.25));
          break;
        case "-":
        case "_":
          handleSpeedChange(Math.max(0.1, speed - 0.25));
          break;
        case " ":
          e.preventDefault();
          handleSpeedChange(speed > 0.1 ? 0 : 1.0);
          break;
        case "n":
          handleDayNight();
          break;
        case "r":
          resetCameraView();
          break;
        case "?":
          setShowShortcuts((s) => !s);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [speed, handleSpeedChange, handleCameraPreset, handleDayNight]);

  const panelStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "12px",
    left: "12px",
    zIndex: 10,
    fontFamily: "'Montserrat', 'Segoe UI', system-ui, sans-serif",
    userSelect: "none",
    willChange: "transform",
  };

  return (
    <>
      {/* Shortcuts overlay */}
      {showShortcuts && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 40,
            background: "rgba(10, 22, 40, 0.95)",
            border: "1px solid rgba(59,130,246,0.3)",
            borderRadius: "12px",
            padding: "20px",
            fontFamily: "'Montserrat', system-ui, sans-serif",
            color: "#e2e8f0",
            minWidth: "280px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "14px" }}>
              Keyboard Shortcuts
            </span>
            <button
              onClick={() => setShowShortcuts(false)}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              x
            </button>
          </div>
          {[
            ["1-9", "Camera presets"],
            ["+ / -", "Speed up / slow down belt"],
            ["Space", "Pause / resume belt"],
            ["N", "Toggle day/night mode"],
            ["R", "Reset camera to overview"],
            ["?", "Show/hide shortcuts"],
          ].map(([key, desc], i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 0",
                borderBottom: "1px solid rgba(100,116,139,0.15)",
              }}
            >
              <kbd
                style={{
                  background: "rgba(100,116,139,0.2)",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                }}
              >
                {key}
              </kbd>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>{desc}</span>
            </div>
          ))}
        </div>
      )}

      <div style={panelStyle}>
        {expanded && (
          <div
            style={{
              background: "rgba(10, 22, 40, 0.92)",
              border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: "10px",
              padding: "12px",
              width: "260px",
              // Cap height so the panel + bottom CLOSE button stay inside the
              // 3D-scene container (which has overflow:hidden). Anything
              // beyond this height scrolls internally.
              maxHeight: "calc(100vh - 380px)",
              overflowY: "auto",
              marginBottom: "8px",
            }}
          >
            {/* â”€â”€ Speed Control â”€â”€ */}
            <div style={{ marginBottom: "10px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <span
                  style={{
                    color: "#94a3b8",
                    fontSize: "9px",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                  }}
                >
                  BELT SPEED
                </span>
                <span
                  style={{
                    color: "#10b981",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  {speed.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={speed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: "#10b981",
                  cursor: "pointer",
                }}
              />
              <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                {[0, 0.5, 1, 2, 3].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSpeedChange(s)}
                    style={{
                      flex: 1,
                      background:
                        speed === s
                          ? "rgba(16,185,129,0.2)"
                          : "rgba(100,116,139,0.1)",
                      border:
                        speed === s
                          ? "1px solid #10b981"
                          : "1px solid rgba(100,116,139,0.2)",
                      borderRadius: "4px",
                      color: speed === s ? "#10b981" : "#94a3b8",
                      fontSize: "9px",
                      fontWeight: 600,
                      padding: "3px 0",
                      cursor: "pointer",
                    }}
                  >
                    {s === 0 ? "STOP" : `${s}x`}
                  </button>
                ))}
              </div>
            </div>

            {/* â”€â”€ Scenario Triggers â”€â”€ */}
            <div style={{ marginBottom: "10px" }}>
              <span
                style={{
                  color: "#94a3b8",
                  fontSize: "9px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                }}
              >
                SCENARIOS
              </span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "4px",
                  marginTop: "6px",
                }}
              >
                {DT_SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => handleScenario(sc.id)}
                    title={sc.description}
                    style={{
                      background:
                        activeScenario === sc.id
                          ? `${sc.color}20`
                          : "rgba(100,116,139,0.08)",
                      border:
                        activeScenario === sc.id
                          ? `1px solid ${sc.color}`
                          : "1px solid rgba(100,116,139,0.15)",
                      borderRadius: "6px",
                      color: activeScenario === sc.id ? sc.color : "#94a3b8",
                      fontSize: "9px",
                      fontWeight: 600,
                      padding: "6px 4px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                  >
                    <div>{sc.label}</div>
                    <div
                      style={{
                        fontSize: "7px",
                        color: "#64748b",
                        marginTop: "2px",
                      }}
                    >
                      {sc.duration}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* â”€â”€ Camera Presets â”€â”€ */}
            <div style={{ marginBottom: "10px" }}>
              <span
                style={{
                  color: "#94a3b8",
                  fontSize: "9px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                }}
              >
                CAMERA VIEWS
              </span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "3px",
                  marginTop: "6px",
                }}
              >
                {CAMERA_PRESETS.map((preset, i) => (
                  <button
                    key={preset.label}
                    onClick={() => handleCameraPreset(preset)}
                    title={`Press ${i + 1}`}
                    style={{
                      background: "rgba(100,116,139,0.08)",
                      border: "1px solid rgba(100,116,139,0.15)",
                      borderRadius: "5px",
                      color: "#94a3b8",
                      fontSize: "8px",
                      padding: "4px 6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.background =
                        "rgba(59,130,246,0.15)";
                      (e.target as HTMLElement).style.color = "#e2e8f0";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.background =
                        "rgba(100,116,139,0.08)";
                      (e.target as HTMLElement).style.color = "#94a3b8";
                    }}
                  >
                    <span style={{ fontSize: "11px" }}>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* â”€â”€ Display Toggles â”€â”€ */}
            <div style={{ marginBottom: "10px" }}>
              <span
                style={{
                  color: "#94a3b8",
                  fontSize: "9px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                }}
              >
                DISPLAY
              </span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "4px",
                  marginTop: "6px",
                }}
              >
                {([
                  ["Particles", particlesEnabled, setParticles, "#22d3ee"],
                  ["Extras",    extrasEnabled,    setExtras,    "#a78bfa"],
                  ["CCTV",      cctvEnabled,      setCCTV,      "#f472b6"],
                  ["Labels",    labelsVisible,    setLabels,    "#34d399"],
                ] as const).map(([label, on, setter, color]) => (
                  <button
                    key={label}
                    onClick={() => setter(!on)}
                    style={{
                      background: on
                        ? `${color}18`
                        : "rgba(100,116,139,0.08)",
                      border: on
                        ? `1px solid ${color}`
                        : "1px solid rgba(100,116,139,0.15)",
                      borderRadius: "6px",
                      color: on ? color : "#94a3b8",
                      fontSize: "9px",
                      fontWeight: 600,
                      padding: "6px 8px",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.15s",
                    }}
                  >
                    <span>{label}</span>
                    <span
                      style={{
                        width: "18px",
                        height: "10px",
                        borderRadius: "999px",
                        background: on ? color : "rgba(100,116,139,0.3)",
                        position: "relative",
                        flexShrink: 0,
                        boxShadow: on ? `0 0 6px ${color}` : "none",
                        transition: "background 0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: "1px",
                          left: on ? "9px" : "1px",
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#0f172a",
                          transition: "left 0.2s",
                        }}
                      />
                    </span>
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  marginTop: "6px",
                }}
              >
                {(["low", "medium", "high", "ultra"] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    style={{
                      flex: 1,
                      background:
                        quality === q
                          ? "rgba(59,130,246,0.18)"
                          : "rgba(100,116,139,0.08)",
                      border:
                        quality === q
                          ? "1px solid #3b82f6"
                          : "1px solid rgba(100,116,139,0.15)",
                      borderRadius: "5px",
                      color: quality === q ? "#60a5fa" : "#94a3b8",
                      fontSize: "9px",
                      fontWeight: 700,
                      padding: "4px 0",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* â”€â”€ Auto Tour â”€â”€ */}
            <button
              onClick={() => {
                if (isAutoTourActive()) {
                  stopAutoTour();
                  resetCameraView();
                } else startAutoTour();
              }}
              style={{
                width: "100%",
                background: isAutoTourActive()
                  ? "rgba(59,130,246,0.2)"
                  : "rgba(100,116,139,0.08)",
                border: isAutoTourActive()
                  ? "1px solid #3b82f6"
                  : "1px solid rgba(100,116,139,0.15)",
                borderRadius: "6px",
                color: isAutoTourActive() ? "#3b82f6" : "#94a3b8",
                fontSize: "10px",
                fontWeight: 600,
                padding: "8px",
                cursor: "pointer",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "14px" }}>
                {isAutoTourActive() ? "\u23F9" : "\u25B6"}
              </span>
              {isAutoTourActive()
                ? `TOURING: ${getAutoTourLabel()}`
                : "START FACTORY TOUR"}
            </button>

            {/* â”€â”€ Day/Night Toggle â”€â”€ */}
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={handleDayNight}
                style={{
                  flex: 1,
                  background: isNight
                    ? "rgba(100,116,139,0.1)"
                    : "rgba(251,191,36,0.15)",
                  border: isNight
                    ? "1px solid rgba(100,116,139,0.2)"
                    : "1px solid #fbbf24",
                  borderRadius: "6px",
                  color: isNight ? "#94a3b8" : "#fbbf24",
                  fontSize: "10px",
                  fontWeight: 600,
                  padding: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                }}
              >
                {isNight ? "\uD83C\uDF19 Night Mode" : "\u2600\uFE0F Day Mode"}
              </button>
              <button
                onClick={() => setShowShortcuts((s) => !s)}
                style={{
                  background: "rgba(100,116,139,0.1)",
                  border: "1px solid rgba(100,116,139,0.2)",
                  borderRadius: "6px",
                  color: "#94a3b8",
                  fontSize: "14px",
                  padding: "6px 10px",
                  cursor: "pointer",
                }}
                title="Keyboard shortcuts"
              >
                ?
              </button>
            </div>
          </div>
        )}

        {/* Bottom-anchored toggle. Renders AFTER the expanded panel in DOM
            order, so the panel anchors this button to its bottom (12px from
            the 3D-scene container's bottom). The expanded content can grow
            upward and even get clipped at the top by the scene's overflow:
            hidden â€” this trigger remains visible and clickable, so the user
            can always close the panel. */}
        <button
          onClick={() => setExpanded((e) => !e)}
          title={expanded ? "Close controls" : "Open controls"}
          style={{
            background: expanded
              ? "rgba(220, 38, 38, 0.85)"
              : "rgba(10, 22, 40, 0.9)",
            border: expanded
              ? "1px solid rgba(248, 113, 113, 0.6)"
              : "1px solid rgba(59,130,246,0.3)",
            borderRadius: "8px",
            color: expanded ? "#fff5f5" : "#e2e8f0",
            padding: "8px 14px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: expanded
              ? "0 6px 18px rgba(220, 38, 38, 0.35)"
              : "0 4px 12px rgba(0,0,0,0.45)",
          }}
        >
          <span style={{ fontSize: "14px", lineHeight: 1 }}>
            {expanded ? "✕" : "▲"}
          </span>
          {expanded ? "CLOSE CONTROLS" : "CONTROLS"}
        </button>
      </div>
    </>
  );
};

export default FunControls;
