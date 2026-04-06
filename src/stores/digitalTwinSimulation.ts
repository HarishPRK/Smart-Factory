/**
 * Digital Twin Simulation Engine — Performance-Optimized
 *
 * Mutates store arrays IN PLACE and calls commitTick() once per tick.
 * No object spreading, no new array references.
 * 3D components read via getState() in useFrame — zero React overhead.
 */
import { useDigitalTwinStore, pushSensorHistory, commitTick } from "./digitalTwinStore";
import { STAGE_CONFIGS } from "../components/factory3d/digitalTwinLayout";
import type {
  ManufacturingStage,
  ProductOnBelt,
  SensorReading,
  OutputDeviceState,
  StageStatus,
  StageId,
  ThresholdEffect,
} from "../types/digitalTwin";

/* ── Value generators ─────────────────────────────────── */

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function drift(current: number, nominal: number, min: number, max: number, volatility: number, dt: number) {
  const pull = (nominal - current) * 0.02 * dt;
  const noise = (Math.random() - 0.5) * volatility * dt;
  return clamp(current + pull + noise, min, max);
}

function sensorStatus(value: number, config: { warningThreshold: number; criticalThreshold: number; nominal: number }): "normal" | "warning" | "critical" {
  const { warningThreshold, criticalThreshold, nominal } = config;
  if (criticalThreshold > nominal) {
    if (value >= criticalThreshold) return "critical";
    if (value >= warningThreshold) return "warning";
  } else {
    if (value <= criticalThreshold) return "critical";
    if (value <= warningThreshold) return "warning";
  }
  return "normal";
}

function qualityColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

/* ── Simulation state (module-level, not in store) ───── */

let sensorValues: Record<string, number> = {};
let productIdCounter = 0;
let lastSpawnTime = 0;
let producedCount = 0;
let rejectedCount = 0;
const recentProducedTimestamps: number[] = [];
let activeScenario: string | null = null;
let scenarioStartTime = 0;

/* ── Initialize stages from config ────────────────────── */

function initializeStages(): ManufacturingStage[] {
  return STAGE_CONFIGS.map((config) => {
    const sensors: SensorReading[] = config.sensorConfigs.map((sc) => {
      sensorValues[sc.sensorId] = sc.nominal;
      return {
        sensorId: sc.sensorId,
        type: sc.type,
        label: sc.label,
        value: sc.nominal,
        unit: sc.unit,
        min: sc.min,
        max: sc.max,
        nominal: sc.nominal,
        warningThreshold: sc.warningThreshold,
        criticalThreshold: sc.criticalThreshold,
        status: "normal" as const,
        timestamp: Date.now(),
      };
    });

    const outputDevices: OutputDeviceState[] = config.outputDeviceConfigs.map((dc) => ({
      deviceId: dc.deviceId,
      type: dc.type,
      label: dc.label,
      active: dc.defaultActive,
      endpoints: dc.type === "switch_4ep" ? [true, true, true, true] : undefined,
      rpm: dc.defaultRpm,
      powerW: dc.defaultPowerW,
      direction: dc.type === "motor" ? "forward" as const : undefined,
    }));

    return {
      id: config.id,
      label: config.label,
      description: config.description,
      position: config.position,
      sensors,
      outputDevices,
      status: "running" as StageStatus,
      throughput: 20,
      qualityScore: 100,
      dwellTimeSec: config.dwellTimeSec,
      thresholdEffects: config.thresholdEffects,
    };
  });
}

/* ── Sensor drift — mutates sensor objects in place ───── */

let historyTickCounter = 0;
const HISTORY_EVERY_N_TICKS = 15; // Write history every ~500ms (15 × 33ms)

function tickSensors(stages: ManufacturingStage[], dt: number) {
  const now = Date.now();
  historyTickCounter++;
  const writeHistory = historyTickCounter % HISTORY_EVERY_N_TICKS === 0;

  for (let si = 0; si < stages.length; si++) {
    const stage = stages[si];
    const config = STAGE_CONFIGS[si];

    for (let i = 0; i < stage.sensors.length; i++) {
      const sensor = stage.sensors[i];
      const sc = config.sensorConfigs[i];

      const newValue = drift(sensorValues[sc.sensorId], sc.nominal, sc.min, sc.max, sc.volatility, dt);
      sensorValues[sc.sensorId] = newValue;

      // Mutate in place
      sensor.value = newValue;
      sensor.status = sensorStatus(newValue, sc);
      sensor.timestamp = now;

      // Only push to ring buffer at ~2 Hz (keeps 100 entries = ~50 seconds)
      if (writeHistory) pushSensorHistory(sc.sensorId, newValue);
    }
  }
}

/* ── Threshold evaluation — mutates stages in place ───── */

function evaluateThresholds(stages: ManufacturingStage[]): number {
  let minSpeed = 1.0;

  for (let si = 0; si < stages.length; si++) {
    const stage = stages[si];
    let stageStatus: StageStatus = "running";
    let stageQuality = 100;

    for (const effect of stage.thresholdEffects) {
      const sensor = stage.sensors.find((s) => s.sensorId === effect.sensorId);
      if (!sensor) continue;

      const sc = STAGE_CONFIGS[si].sensorConfigs.find((c) => c.sensorId === effect.sensorId);
      if (!sc) continue;

      if (!isEffectTriggered(sensor.value, sc.nominal, effect)) continue;

      switch (effect.effect) {
        case "emergency_stop":
          stageStatus = "faulted";
          minSpeed = 0;
          for (const d of stage.outputDevices) {
            if (d.type === "emergency_light") d.active = true;
            if (d.type === "motor") { d.active = false; d.rpm = 0; d.direction = "stopped"; }
          }
          break;
        case "stop":
          if (stageStatus !== "faulted") stageStatus = "faulted";
          minSpeed = 0;
          for (const d of stage.outputDevices) {
            if (d.type === "motor" && d.deviceId === effect.targetDeviceId) {
              d.active = false; d.rpm = 0; d.direction = "stopped";
            }
          }
          break;
        case "slowdown":
          if (stageStatus === "running") stageStatus = "warning";
          minSpeed = Math.min(minSpeed, 0.5);
          break;
        case "quality_degrade":
          if (stageStatus === "running") stageStatus = "warning";
          stageQuality -= effect.qualityPenalty ?? 10;
          break;
      }
    }

    stage.status = stageStatus;
    stage.qualityScore = Math.max(0, stageQuality);

    if (stageStatus === "running") {
      for (const d of stage.outputDevices) {
        if (d.type === "emergency_light") d.active = false;
        if (d.type === "motor") {
          d.active = true;
          const dc = STAGE_CONFIGS[si].outputDeviceConfigs.find((c) => c.deviceId === d.deviceId);
          d.rpm = dc?.defaultRpm ?? 60;
          d.direction = "forward";
        }
      }
    }
  }

  return minSpeed;
}

function isEffectTriggered(value: number, nominal: number, effect: ThresholdEffect): boolean {
  for (const stageConfig of STAGE_CONFIGS) {
    const sc = stageConfig.sensorConfigs.find((s) => s.sensorId === effect.sensorId);
    if (!sc) continue;
    switch (effect.condition) {
      case "above_critical": return value >= sc.criticalThreshold && sc.criticalThreshold > nominal;
      case "above_warning":  return value >= sc.warningThreshold && value < sc.criticalThreshold && sc.warningThreshold > nominal;
      case "below_critical": return value <= sc.criticalThreshold && sc.criticalThreshold < nominal;
      case "below_warning":  return value <= sc.warningThreshold && value > sc.criticalThreshold && sc.warningThreshold < nominal;
    }
  }
  return false;
}

/* ── Product flow — mutates product array in place ────── */

const SPAWN_INTERVAL_SEC = 3;
const CONVEYOR_FULL_DURATION_SEC = 15;

function tickProducts(stages: ManufacturingStage[], products: ProductOnBelt[], dt: number, conveyorSpeed: number): number {
  const now = Date.now();

  // Spawn
  if (conveyorSpeed > 0 && (now - lastSpawnTime) / 1000 >= SPAWN_INTERVAL_SEC / conveyorSpeed) {
    productIdCounter++;
    products.push({
      id: `p${productIdCounter}`,
      progress: 0,
      currentStageId: null,
      qualityScore: 100,
      defects: [],
      enteredAt: now,
      color: "#10b981",
    });
    lastSpawnTime = now;
  }

  const speed = (dt * conveyorSpeed) / CONVEYOR_FULL_DURATION_SEC;
  let writeIdx = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    product.progress += speed;

    // Determine current stage
    let currentStage: StageId | null = null;
    for (const stage of stages) {
      const config = STAGE_CONFIGS.find((c) => c.id === stage.id)!;
      if (Math.abs(product.progress - config.conveyorT) < 0.08) {
        currentStage = stage.id;
        if (product.currentStageId !== stage.id) {
          product.currentStageId = stage.id;
          if (stage.qualityScore < 100) {
            const penalty = Math.round((100 - stage.qualityScore) * 0.3);
            product.qualityScore = Math.max(0, product.qualityScore - penalty);
            if (penalty > 15) product.defects.push(`${stage.id}`);
          }
        }
        break;
      }
    }
    if (!currentStage) product.currentStageId = null;
    product.color = qualityColor(product.qualityScore);

    // Dispatched
    if (product.progress >= 1.0) {
      if (product.qualityScore < 30) rejectedCount++;
      else { producedCount++; recentProducedTimestamps.push(now); }
      continue;
    }
    // Rejected at QC
    if (product.currentStageId === "quality" && product.qualityScore < 30) {
      rejectedCount++;
      continue;
    }

    // Keep — swap to write position (in-place filter)
    products[writeIdx++] = product;
  }
  products.length = writeIdx;

  // Throughput
  const oneMinAgo = now - 60_000;
  while (recentProducedTimestamps.length > 0 && recentProducedTimestamps[0] <= oneMinAgo) {
    recentProducedTimestamps.shift();
  }
  return recentProducedTimestamps.length;
}

/* ── Scenarios ────────────────────────────────────────── */

type ScenarioFn = (elapsed: number, dt: number) => boolean;

const scenarioFns: Record<string, ScenarioFn> = {
  normal_production: (elapsed) => elapsed >= 30,

  chemical_spill: (elapsed, dt) => {
    if (elapsed > 3 && elapsed < 15) {
      sensorValues["mixing_ph"] = drift(sensorValues["mixing_ph"], 11.0, 8, 14, 1.5, dt);
      sensorValues["mixing_orp"] = drift(sensorValues["mixing_orp"], 450, 300, 500, 15, dt);
    }
    if (elapsed > 15 && elapsed < 25) {
      sensorValues["mixing_ph"] = drift(sensorValues["mixing_ph"], 7.0, 5, 10, 1.0, dt);
      sensorValues["mixing_orp"] = drift(sensorValues["mixing_orp"], 200, 100, 350, 10, dt);
    }
    return elapsed >= 25;
  },

  gas_leak: (elapsed, dt) => {
    if (elapsed > 2 && elapsed < 10) {
      sensorValues["curing_mq"] = drift(sensorValues["curing_mq"], 700, 200, 1000, 30, dt);
      sensorValues["curing_o2"] = drift(sensorValues["curing_o2"], 14, 10, 18, 1.5, dt);
    }
    if (elapsed > 10 && elapsed < 20) {
      sensorValues["curing_mq"] = drift(sensorValues["curing_mq"], 30, 0, 200, 15, dt);
      sensorValues["curing_o2"] = drift(sensorValues["curing_o2"], 20.9, 16, 25, 0.8, dt);
    }
    return elapsed >= 20;
  },

  quality_failure: (elapsed, dt) => {
    if (elapsed > 2 && elapsed < 18) {
      sensorValues["quality_lidar"] = drift(sensorValues["quality_lidar"], 3.0, 0.5, 10, 0.8, dt);
      sensorValues["quality_turbidity"] = drift(sensorValues["quality_turbidity"], 60, 10, 100, 5, dt);
    }
    if (elapsed > 18 && elapsed < 28) {
      sensorValues["quality_lidar"] = drift(sensorValues["quality_lidar"], 0.5, 0, 5, 0.5, dt);
      sensorValues["quality_turbidity"] = drift(sensorValues["quality_turbidity"], 5, 0, 30, 3, dt);
    }
    return elapsed >= 28;
  },
};

/* ── Main simulation loop ─────────────────────────────── */

let intervalId: ReturnType<typeof setInterval> | null = null;
let lastTime = Date.now();

function tick() {
  const now = Date.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  const store = useDigitalTwinStore.getState();
  const stages = store.stages;
  const products = store.products;

  // Scenario overrides
  if (activeScenario && scenarioFns[activeScenario]) {
    const elapsed = (now - scenarioStartTime) / 1000;
    if (scenarioFns[activeScenario](elapsed, dt)) {
      activeScenario = null;
      useDigitalTwinStore.setState({ activeScenario: null });
    }
  }

  tickSensors(stages, dt);
  const conveyorSpeed = evaluateThresholds(stages);
  const throughput = tickProducts(stages, products, dt, conveyorSpeed);

  // Single setState call per tick — only scalar values change identity
  commitTick(conveyorSpeed, throughput, producedCount, rejectedCount);
}

/* ── Public API ───────────────────────────────────────── */

export function startDigitalTwinSim() {
  if (intervalId) return;

  sensorValues = {};
  productIdCounter = 0;
  lastSpawnTime = Date.now();
  producedCount = 0;
  rejectedCount = 0;
  recentProducedTimestamps.length = 0;
  activeScenario = null;
  scenarioStartTime = 0;

  const stages = initializeStages();
  const products: ProductOnBelt[] = [];

  useDigitalTwinStore.setState({
    stages,
    products,
    simulationActive: true,
    activeScenario: null,
    tick: 0,
  });

  lastTime = Date.now();
  intervalId = setInterval(tick, 33); // ~30 Hz — smooth sensor drift & product movement
}

export function stopDigitalTwinSim() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  useDigitalTwinStore.setState({ simulationActive: false });
}

export function runDigitalTwinScenario(name: string) {
  activeScenario = name;
  scenarioStartTime = Date.now();
  useDigitalTwinStore.setState({ activeScenario: name });
}

export function isDigitalTwinRunning() {
  return intervalId !== null;
}

export const DT_SCENARIOS = [
  { id: "normal_production", label: "Normal Production",  duration: "30s", color: "#22c55e", description: "Steady manufacturing — all sensors nominal" },
  { id: "chemical_spill",    label: "Chemical Spill",     duration: "25s", color: "#f59e0b", description: "pH & ORP spike at mixing stage" },
  { id: "gas_leak",          label: "Gas Leak",           duration: "20s", color: "#ef4444", description: "MQ gas rises at curing stage" },
  { id: "quality_failure",   label: "Quality Failure",    duration: "28s", color: "#8b5cf6", description: "LiDAR & turbidity drift at QC" },
];
