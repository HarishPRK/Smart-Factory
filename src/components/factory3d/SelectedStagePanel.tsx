import React from "react";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";

/**
 * Floating 2D panel that appears whenever a stage is selected.
 *
 * Lives outside the R3F canvas so it's always on-screen regardless of where
 * the camera ends up. Renders the selected stage's sensor readings + output
 * device states, same content as the 3D billboard â€” but without relying on
 * 3D positioning, so the user can see the machine's data even when the
 * front-view camera frames the machine differently from where the 3D
 * billboard happens to sit in world space.
 */
const SelectedStagePanel: React.FC = () => {
  const selectedStageId = useSceneSelectionStore((s) => s.selectedStageId);
  const clear = useSceneSelectionStore((s) => s.clear);

  // Subscribe to the tick so live values update without remounting. Reading
  // via getState() gives us the latest mutable stage reference (the sim
  // mutates in place, so a tick subscription is what triggers the re-render).
  const tick = useDigitalTwinStore((s) => s.tick);
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  tick;

  if (!selectedStageId) return null;

  const stage = useDigitalTwinStore
    .getState()
    .stages.find((s) => s.id === selectedStageId);
  if (!stage) return null;

  const statusColor =
    stage.status === "running"
      ? "#10b981"
      : stage.status === "faulted"
        ? "#ef4444"
        : stage.status === "warning"
          ? "#f59e0b"
          : "#64748b";

  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        left: "20px",
        zIndex: 20,
        width: "300px",
        maxHeight: "80vh",
        overflowY: "auto",
        background: "rgba(10, 22, 40, 0.94)",
        border: `2px solid ${statusColor}`,
        borderRadius: "12px",
        padding: "14px",
        fontFamily: "'Montserrat', system-ui, sans-serif",
        fontSize: "12px",
        color: "#e2e8f0",
        boxShadow: `0 0 18px ${statusColor}55, 0 12px 28px rgba(0,0,0,0.55)`,
        backdropFilter: "blur(6px)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "9px",
              color: "#7fa2c7",
              fontWeight: 700,
              letterSpacing: "0.12em",
            }}
          >
            FOCUSED MACHINE
          </div>
          <div
            style={{
              fontSize: "15px",
              fontWeight: 800,
              color: "#f0f6ff",
              marginTop: "2px",
            }}
          >
            {stage.label}
          </div>
        </div>
        <button
          onClick={clear}
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "6px",
            border: "1px solid rgba(148, 163, 184, 0.3)",
            background: "rgba(148, 163, 184, 0.1)",
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: "12px",
            lineHeight: 1,
          }}
          title="Deselect (ESC)"
        >
          Ã—
        </button>
      </div>

      {/* Status + quality */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
          paddingBottom: "10px",
          borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: statusColor,
            boxShadow: `0 0 6px ${statusColor}`,
          }}
        />
        <span
          style={{
            color: statusColor,
            fontWeight: 700,
            textTransform: "uppercase",
            fontSize: "11px",
            letterSpacing: "0.08em",
          }}
        >
          {stage.status}
        </span>
        <span
          style={{
            marginLeft: "auto",
            color: "#94a3b8",
            fontSize: "10px",
          }}
        >
          Q: {stage.qualityScore}%
        </span>
      </div>

      {/* Sensors */}
      <div
        style={{
          fontSize: "9px",
          color: "#7fa2c7",
          fontWeight: 700,
          letterSpacing: "0.1em",
          marginBottom: "6px",
        }}
      >
        SENSORS
      </div>
      {stage.sensors.map((s) => (
        <div
          key={s.sensorId}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 0",
            borderBottom: "1px solid rgba(30, 41, 59, 0.7)",
          }}
        >
          <span style={{ color: "#cbd5e1", fontSize: "12px" }}>{s.label}</span>
          <span
            style={{
              color:
                s.status === "critical"
                  ? "#ef4444"
                  : s.status === "warning"
                    ? "#f59e0b"
                    : "#10b981",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              fontSize: "12px",
            }}
          >
            {s.value.toFixed(1)} {s.unit}
          </span>
        </div>
      ))}

      {/* Devices */}
      <div
        style={{
          fontSize: "9px",
          color: "#7fa2c7",
          fontWeight: 700,
          letterSpacing: "0.1em",
          marginTop: "12px",
          marginBottom: "6px",
        }}
      >
        DEVICES
      </div>
      {stage.outputDevices.map((d) => {
        // Emergency light is the one device where ON = alarm (active alarm
        // beacon) and OFF = normal. For every other device (motors, relays,
        // gate signals, etc.) ON = running and OFF = idle — neither state
        // is intrinsically a fault, so render OFF in neutral grey rather
        // than firing-alarm red to avoid alarm-fatigue noise.
        const isEmergencyBeacon = d.type === "emergency_light";
        const activeColor = isEmergencyBeacon ? "#ef4444" : "#10b981";
        const inactiveColor = "#64748b";
        const color = d.active ? activeColor : inactiveColor;
        return (
          <div
            key={d.deviceId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "5px 0",
              borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
            }}
          >
            <span style={{ color: "#cbd5e1", fontSize: "11px" }}>{d.label}</span>
            <span style={{ color, fontWeight: 700, fontSize: "11px" }}>
              {d.active ? (d.rpm ? `${d.rpm} RPM` : "ON") : "OFF"}
            </span>
          </div>
        );
      })}

      <div
        style={{
          marginTop: "10px",
          paddingTop: "8px",
          borderTop: "1px dashed rgba(148, 163, 184, 0.2)",
          fontSize: "9px",
          color: "#64748b",
          textAlign: "center",
          letterSpacing: "0.08em",
        }}
      >
        Click machine again or press ESC to exit
      </div>
    </div>
  );
};

export default SelectedStagePanel;
