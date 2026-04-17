"use no memo";
/**
 * MachineSensorLabels — persistent in-scene sensor readouts.
 *
 * Renders one drei <Billboard> per manufacturing stage with the stage name and
 * its primary sensor value, always facing the camera. Values refresh with the
 * digital-twin store's tick (500ms) — no per-frame subscription, no DOM.
 *
 * Disabled automatically under capture-mode for frame-budget headroom.
 */
import React, { useMemo } from "react";
import { Billboard, Text } from "@react-three/drei";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { STAGE_POSITIONS } from "./digitalTwinLayout";
import type { StageId } from "../../types/digitalTwin";

interface StagePrimary {
  stageId: StageId;
  stageLabel: string;
  sensorId: string;
  unit: string;
  precision: number;
}

const STAGE_PRIMARY: StagePrimary[] = [
  { stageId: "intake",    stageLabel: "Intake",     sensorId: "intake_lidar",      unit: "mm",  precision: 1 },
  { stageId: "forming",   stageLabel: "Blow Mold",  sensorId: "forming_pressure",  unit: "bar", precision: 1 },
  { stageId: "mixing",    stageLabel: "Filling",    sensorId: "mixing_ph",         unit: "pH",  precision: 2 },
  { stageId: "curing",    stageLabel: "Cooling",    sensorId: "curing_o2",         unit: "%",   precision: 1 },
  { stageId: "quality",   stageLabel: "Quality",    sensorId: "quality_lidar",     unit: "mm",  precision: 2 },
  { stageId: "packaging", stageLabel: "Packaging",  sensorId: "pkg_pressure",      unit: "bar", precision: 1 },
  { stageId: "dispatch",  stageLabel: "Dispatch",   sensorId: "dispatch_gps",      unit: "m",   precision: 0 },
];

const STATUS_COLOR: Record<string, string> = {
  normal:   "#10b981",
  warning:  "#f59e0b",
  critical: "#ef4444",
  idle:     "#94a3b8",
};

const LABEL_Y_OFFSET = 3.2;

interface LabelProps {
  config: StagePrimary;
}

const MachineSensorLabel: React.FC<LabelProps> = ({ config }) => {
  const tick = useDigitalTwinStore((s) => s.tick);

  const view = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    tick;
    const state = useDigitalTwinStore.getState();
    const stage = state.stages.find((s) => s.id === config.stageId);
    const sensor = stage?.sensors.find((s) => s.sensorId === config.sensorId);
    const value = sensor?.value;
    const status = sensor?.status ?? stage?.status ?? "idle";
    const color = STATUS_COLOR[status] ?? STATUS_COLOR.idle;
    const text =
      typeof value === "number" && Number.isFinite(value)
        ? `${value.toFixed(config.precision)} ${config.unit}`.trim()
        : "— " + config.unit;
    return { text, color };
  }, [tick, config]);

  const pos = STAGE_POSITIONS[config.stageId];

  return (
    <Billboard position={[pos[0], pos[1] + LABEL_Y_OFFSET, pos[2]]} follow>
      <Text
        fontSize={0.28}
        color="#cbd5e1"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.012}
        outlineColor="#000000"
        outlineOpacity={0.7}
      >
        {config.stageLabel}
      </Text>
      <Text
        position={[0, -0.05, 0]}
        fontSize={0.42}
        color={view.color}
        anchorX="center"
        anchorY="top"
        outlineWidth={0.018}
        outlineColor="#000000"
        outlineOpacity={0.8}
        fontWeight={700}
      >
        {view.text}
      </Text>
    </Billboard>
  );
};

const MachineSensorLabels: React.FC<{ visible?: boolean }> = ({ visible = true }) => {
  if (!visible) return null;
  return (
    <group>
      {STAGE_PRIMARY.map((cfg) => (
        <MachineSensorLabel key={cfg.stageId} config={cfg} />
      ))}
    </group>
  );
};

export default MachineSensorLabels;
