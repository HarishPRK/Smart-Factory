/**
 * Digital Twin Simulation Engine — Performance-Optimized
 *
 * Mutates store arrays IN PLACE and calls commitTick() once per tick.
 * No object spreading, no new array references.
 * 3D components read via getState() in useFrame — zero React overhead.
 */
import { useDigitalTwinStore, pushSensorHistory, commitTick } from "./digitalTwinStore";
import { STAGE_CONFIGS } from "../components/factory3d/digitalTwinLayout";
import type { PLCParameter } from "../types";
import type { PLCOutputs } from "../services/plcService";
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

type DigitalTwinPLCFeed = {
  active: boolean;
  paramValues: Record<string, number>;
  outputs: PLCOutputs | null;
};

let plcFeed: DigitalTwinPLCFeed = {
  active: false,
  paramValues: {},
  outputs: null,
};
const DT_PLC_DEBUG = import.meta.env.DEV || import.meta.env.VITE_PLC_DEBUG === "true";
let lastPLCOperationSnapshot = "";

function digitalTwinDebug(message: string, details?: unknown) {
  if (!DT_PLC_DEBUG) return;
  if (details === undefined) console.debug(`[DigitalTwin][PLC] ${message}`);
  else console.debug(`[DigitalTwin][PLC] ${message}`, details);
}

const CORE_PLC_IDS = new Set(["voltage", "current", "relay", "ph", "photoE", "metal"]);

// Each key is a stage sensorId; the array lists paramIds (in order of
// preference) that can feed it from the live MQTT payload. This lets multiple
// stages re-use a single board-A sensor — e.g. the one pressure transducer
// feeds BOTH forming_pressure and pkg_pressure, one ORP probe feeds mixing
// ORP + anything downstream that wants it, etc.
const SENSOR_FALLBACKS: Record<string, string[]> = {
  intake_gps:          ["intake_gps"],
  intake_fingerprint:  ["intake_fingerprint"],
  intake_lidar:        ["intake_lidar"],
  mixing_ph:           ["mixing_ph", "ph"],
  mixing_orp:          ["mixing_orp"],
  mixing_turbidity:    ["mixing_turbidity"],
  mixing_mq:           ["mixing_mq"],
  forming_pressure:    ["forming_pressure"],
  forming_light:       ["forming_light"],
  curing_o2:           ["curing_o2"],
  curing_mq:           ["curing_mq", "mixing_mq"],          // shared metaloxide sensor
  curing_motion:       ["curing_motion"],
  quality_lidar:       ["quality_lidar"],
  quality_light:       ["quality_light", "forming_light"],  // shared light sensor
  quality_turbidity:   ["quality_turbidity", "mixing_turbidity"], // shared turbidity sensor
  pkg_motion:          ["pkg_motion", "curing_motion"],     // shared microwave motion sensor
  pkg_pressure:        ["pkg_pressure", "forming_pressure"], // shared pressure transducer
  pkg_water:           ["pkg_water"],
  dispatch_gps:        ["dispatch_gps", "intake_gps"],      // shared aux voltage pot
  dispatch_fingerprint:["dispatch_fingerprint", "intake_fingerprint"],
  // V2 sensor fallbacks — route to existing PLC param IDs where the hardware
  // signal already exists. Sensors without a listed fallback remain purely
  // simulated until a PLC payload key is added.
  // The user's physical board has one photoelectric beam-break sensor wired as
  // the proximity input, so all proximity + optical stage sensors track it.
  intake_optical:      ["photoelectric"],
  quality_optical:     ["photoelectric"],
  forming_proximity:   ["photoelectric"],
  pkg_proximity:       ["photoelectric"],
  curing_fire:         ["fire"],
  pkg_fire:            ["fire"],
  // All three stage-level E-stop sensors are driven by the single PLC-level
  // `system_emergency_stop` bit (latched `system_was_in_emergency_stop_state`
  // in the payload). When it goes high, every stage's emergency_stop sensor
  // crosses its critical threshold, and evaluateThresholds' sensorEstopActive
  // guard freezes the whole line + clears RFID client-side.
  forming_estop:       ["system_emergency_stop"],
  mixing_estop:        ["system_emergency_stop"],
  pkg_estop:           ["system_emergency_stop"],
};

function getPLCOverride(sensorId: string): number | undefined {
  if (!plcFeed.active) return undefined;
  const keys = SENSOR_FALLBACKS[sensorId] ?? [sensorId];
  for (const key of keys) {
    const value = plcFeed.paramValues[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * Public helper — lets UI components (e.g. SensorHUD) show a LIVE vs SIM
 * badge per sensor row based on whether the current payload actually supplies
 * a value for that sensor.
 */
export function isSensorLive(sensorId: string): boolean {
  if (!plcFeed.active) return false;
  const keys = SENSOR_FALLBACKS[sensorId] ?? [sensorId];
  for (const key of keys) {
    if (plcFeed.paramValues[key] !== undefined) return true;
  }
  return false;
}

/* ── Fast lookup maps (built once at module load) ────────
 *
 * The simulation tick runs ~30 Hz and inside each tick we used to do hundreds
 * of `Array.find(...)` calls walking STAGE_CONFIGS, sensorConfigs, and
 * outputDeviceConfigs. Each `find` is O(n) and allocates a closure for its
 * predicate. At ~500+ finds per tick × 30 Hz, this is the kind of GC/CPU
 * pressure that stalls the main thread; when a tick exceeds 33 ms the
 * setInterval callbacks queue and every new MQTT message waits behind them,
 * matching the 3–4 s observed latency.
 *
 * These maps replace every hot-path find with O(1) lookups. They are built
 * once from the static STAGE_CONFIGS layout and never mutated.
 */
const STAGE_CONFIG_BY_ID: Record<string, typeof STAGE_CONFIGS[number]> = {};
const SENSOR_CONFIG_BY_KEY: Record<
  string,
  typeof STAGE_CONFIGS[number]["sensorConfigs"][number]
> = {};
const DEVICE_CONFIG_BY_KEY: Record<
  string,
  typeof STAGE_CONFIGS[number]["outputDeviceConfigs"][number]
> = {};

for (const cfg of STAGE_CONFIGS) {
  STAGE_CONFIG_BY_ID[cfg.id] = cfg;
  for (const sc of cfg.sensorConfigs) {
    // Global-unique sensorId keys (e.g. "forming_pressure") — every sensor in
    // layout is uniquely named so we don't need to namespace by stage here.
    SENSOR_CONFIG_BY_KEY[sc.sensorId] = sc;
  }
  for (const dc of cfg.outputDeviceConfigs) {
    DEVICE_CONFIG_BY_KEY[`${cfg.id}::${dc.deviceId}`] = dc;
  }
}

function defaultMotorRpm(stageId: StageId, deviceId: string): number {
  return DEVICE_CONFIG_BY_KEY[`${stageId}::${deviceId}`]?.defaultRpm ?? 60;
}

/** Thresholds applied to analog board-A readings. Tuned to the live payload
 *  ranges so routine fluctuations don't trip them. */
const OP_LIMITS = {
  voltageLow:     3.5,  // V  — under-voltage trip
  voltageHigh:   11.0,  // V  — over-voltage trip
  currentHigh:    9.0,  // A  — over-current trip
  tempWarn:      60.0,  // °C — thermal warning
  tempCrit:      85.0,  // °C — thermal emergency stop
} as const;

function applyPLCOperationalOverrides(stages: ManufacturingStage[], thresholdSpeed: number): number {
  if (!plcFeed.active || !plcFeed.outputs) return thresholdSpeed;

  const outputs = plcFeed.outputs;
  const vals = plcFeed.paramValues;

  // ── Per-machine PLC condition flags (scoped, not line-wide) ──
  // Each analog reading is owned by one stage; faulting one no longer cascades
  // to the whole line. Only the operator E-stop (red/buzzer/alarm relays) and
  // the RFID gate are truly line-wide.
  const voltage     = vals.voltage    ?? 0;
  const current     = vals.current    ?? 0;
  const temperature = vals.temperature ?? 0;

  // Forming (blow-mold press) — owns voltage + current readings.
  const formingFault =
    (voltage > 0 && voltage < OP_LIMITS.voltageLow) ||
    voltage > OP_LIMITS.voltageHigh ||
    current > OP_LIMITS.currentHigh;

  // Curing (oven) — owns the temperature probe.
  const curingFault = temperature > OP_LIMITS.tempCrit;
  const curingWarn  = temperature > OP_LIMITS.tempWarn && !curingFault;

  // Operator E-stop was previously derived from the red / buzzer / alarm
  // annunciator outputs — but those lamps are often on during normal state
  // indication in real firmware (e.g. amber "awaiting", red "RFID locked"
  // indicators), which made them unreliable as an E-stop signal. The real
  // operator E-stop path now flows through dedicated `emergency_stop` sensor
  // inputs handled by `evaluateThresholds` → `sensorEstopActive`, which
  // explicitly freezes every stage + the conveyor when any E-stop button is
  // pressed. We keep `operatorEstop = false` here so the annunciator lamps
  // can't stop the line on their own.
  const operatorEstop = false;

  // Line speed gate: RFID badge alone decides whether the conveyor moves.
  // Stage-level faults (pressure, voltage, temp, etc.) stop their own motor
  // but the belt itself keeps moving so upstream production isn't blocked.
  let effectiveSpeed = thresholdSpeed;
  if (!outputs.rfidAuthorized) {
    effectiveSpeed = 0;
  }

  // Snapshot/diff-log for operator visibility — only built when debug logging
  // is enabled. Running JSON.stringify every 33 ms was pure overhead in prod
  // since the output is only ever consumed by digitalTwinDebug().
  if (DT_PLC_DEBUG) {
    const operationSnapshot = JSON.stringify({
      photoESensor: outputs.photoESensor,
      metalSensor: outputs.metalSensor,
      rfidAuthorized: outputs.rfidAuthorized,
      motorRelay: outputs.motorFanOn,
      cobotButton: outputs.pushButton, // for traceability only — wired elsewhere
      voltage, current, temperature,
      formingFault, curingFault, curingWarn, operatorEstop,
      thresholdSpeed,
      effectiveSpeed,
    });

    if (operationSnapshot !== lastPLCOperationSnapshot) {
      lastPLCOperationSnapshot = operationSnapshot;
      digitalTwinDebug("Factory operation override updated", {
        rfidAuthorized: outputs.rfidAuthorized,
        motorRelay: outputs.motorFanOn,
        cobotButton: outputs.pushButton,
        voltage, current, temperature,
        formingFault, curingFault, curingWarn, operatorEstop,
        thresholdSpeed,
        effectiveSpeed,
      });
    }
  }

  for (const stage of stages) {
    let stageFaulted = stage.status === "faulted";
    // Treat "warning" as running — a warning stage is still producing, just degraded.
    // Only "idle" and "faulted" are non-running states.
    let stageRunning = stage.status === "running" || stage.status === "warning";

    // ── True line-wide gates ──
    // Operator E-stop (red light, buzzer, or alarm relay) faults every stage.
    if (operatorEstop) {
      stageFaulted = true;
      stageRunning = false;
    }
    // RFID badge — line is idle (not faulted) when no authorized operator
    // is present. Each machine drops to idle, motors stop.
    if (!outputs.rfidAuthorized && !stageFaulted) {
      stageRunning = false;
    }

    // ── Per-machine PLC gates — only the owning stage is affected ──
    if (stage.id === "forming") {
      // Voltage / current excursion → fault the blow-mold press only.
      if (formingFault) {
        stageFaulted = true;
        stageRunning = false;
      }
    }
    if (stage.id === "curing") {
      // Temperature critical → fault the curing oven only.
      if (curingFault) {
        stageFaulted = true;
        stageRunning = false;
      } else if (curingWarn && !stageFaulted && stage.status === "running") {
        // Soft thermal warning: keep running but flag warning.
        stage.status = "warning";
      }
    }
    if (stage.id === "intake" && !outputs.photoESensor && stageRunning) {
      // photoE === 0 is the resting state (no product under beam) — normal.
    }
    if (stage.id === "quality") {
      if (outputs.metalSensor) {
        stageFaulted = true;
        stageRunning = false;
      }
    }

    if (stageFaulted) {
      stage.status = "faulted";
    } else if (!stageRunning) {
      if (stage.status !== "faulted") {
        stage.status = "idle";
      }
    } else if (stageRunning && stage.status !== "faulted") {
      // Preserve "warning" status if that's what threshold evaluation set
      if (stage.status !== "warning") stage.status = "running";
    }

    // Apply motor states for THIS stage based on its updated status.
    // Motors keep running for both "running" and "warning" stages — warning means
    // degraded quality, not a production halt.
    for (const device of stage.outputDevices) {
      if (device.type === "emergency_light") {
        device.active = stage.status === "faulted";
      }
      if (device.type === "motor") {
        if (stage.status === "running" || stage.status === "warning") {
          device.active = true;
          device.rpm = defaultMotorRpm(stage.id, device.deviceId);
          device.direction = "forward";
        } else {
          device.active = false;
          device.rpm = 0;
          device.direction = "stopped";
        }
      }
    }
  }

  return effectiveSpeed;
}

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

      const externalValue = getPLCOverride(sc.sensorId);
      const newValue = externalValue !== undefined
        ? clamp(externalValue, sc.min, sc.max)
        : drift(sensorValues[sc.sensorId], sc.nominal, sc.min, sc.max, sc.volatility, dt);
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
  // ── Line-wide sensor-driven E-Stop gate ──
  // Any operator-panel emergency-stop input reading above its critical threshold
  // freezes every stage and drops conveyor speed to zero — mirrors the behaviour
  // of the PLC alarm-relay E-stop but sourced from the sim/hardware sensor.
  const sensorEstopActive = stages.some((stage) =>
    stage.sensors.some(
      (s) => s.type === "emergency_stop" && s.status === "critical",
    ),
  );
  if (sensorEstopActive) {
    for (const stage of stages) {
      stage.status = "faulted";
      for (const d of stage.outputDevices) {
        if (d.type === "emergency_light") d.active = true;
        if (d.type === "motor") {
          d.active = false;
          d.rpm = 0;
          d.direction = "stopped";
        }
      }
    }
    return 0;
  }

  let minSpeed = 1.0;

  for (let si = 0; si < stages.length; si++) {
    const stage = stages[si];
    let stageStatus: StageStatus = "running";
    let stageQuality = 100;

    for (const effect of stage.thresholdEffects) {
      const sensor = stage.sensors.find((s) => s.sensorId === effect.sensorId);
      if (!sensor) continue;

      const sc = SENSOR_CONFIG_BY_KEY[effect.sensorId];
      if (!sc) continue;

      if (!isEffectTriggered(sensor.value, sc, effect)) continue;

      // When live PLC feed is active we still honour `stop` effects (operator-set
      // safety thresholds such as forming_pressure below 50 bar must halt the
      // machine on the factory floor). Only `emergency_stop` is downgraded to a
      // quality warning so an uncalibrated sensor can't shut down the whole line.
      const effectiveEffect =
        plcFeed.active && effect.effect === "emergency_stop"
          ? "quality_degrade"
          : effect.effect;

      switch (effectiveEffect) {
        case "emergency_stop":
          stageStatus = "faulted";
          for (const d of stage.outputDevices) {
            if (d.type === "emergency_light") d.active = true;
            if (d.type === "motor") { d.active = false; d.rpm = 0; d.direction = "stopped"; }
          }
          break;
        case "stop":
          stageStatus = "faulted";
          for (const d of stage.outputDevices) {
            // Fire the emergency light for visibility on the factory floor
            if (d.type === "emergency_light") d.active = true;
            // Halt the specific motor named by the effect; if none named, halt all motors on this stage
            if (d.type === "motor" && (!effect.targetDeviceId || d.deviceId === effect.targetDeviceId)) {
              d.active = false; d.rpm = 0; d.direction = "stopped";
            }
          }
          break;
        case "slowdown":
          if (stageStatus === "running") stageStatus = "warning";
          minSpeed = Math.min(minSpeed, 0.8);
          break;
        case "quality_degrade":
          if (stageStatus === "running") stageStatus = "warning";
          stageQuality -= effect.qualityPenalty ?? 10;
          break;
      }
    }

    stage.status = stageStatus;
    stage.qualityScore = Math.max(0, stageQuality);

    // Restore healthy state whenever the stage is not faulted.
    //
    // Previously we only restored motors + emergency_lights when the final
    // status was "running" — a stage that ticked over to "warning" (via a
    // slowdown/quality_degrade) kept whatever emergency_light state a prior
    // "stop" effect had left behind. That's why the lights appeared to stay
    // ON during normal operation even after the triggering sensor recovered:
    // ambient warning-level fluctuations (e.g. proximity beam-break) held the
    // stage in "warning" and the previous tick's light state stuck around.
    //
    // A warning-level stage is still producing — motors run, emergency lights
    // are off — it's just degraded quality / throughput.
    if (stageStatus === "running" || stageStatus === "warning") {
      const stageCfg = STAGE_CONFIG_BY_ID[stage.id];
      for (const d of stage.outputDevices) {
        if (d.type === "emergency_light") d.active = false;
        if (d.type === "motor") {
          d.active = true;
          // Map lookup keyed by stageId+deviceId (built once at module load).
          const dc =
            DEVICE_CONFIG_BY_KEY[`${stage.id}::${d.deviceId}`] ??
            stageCfg?.outputDeviceConfigs[0];
          d.rpm = dc?.defaultRpm ?? 60;
          d.direction = "forward";
        }
      }
    }
  }

  return minSpeed;
}

function isEffectTriggered(
  value: number,
  sc: typeof STAGE_CONFIGS[number]["sensorConfigs"][number],
  effect: ThresholdEffect,
): boolean {
  // Single-config evaluation — caller passes the already-looked-up sensor
  // config. Previously walked all of STAGE_CONFIGS per call which was
  // ~64 redundant iterations per tick on the hot path.
  const nominal = sc.nominal;
  switch (effect.condition) {
    case "above_critical": return value >= sc.criticalThreshold && sc.criticalThreshold > nominal;
    case "above_warning":  return value >= sc.warningThreshold && value < sc.criticalThreshold && sc.warningThreshold > nominal;
    case "below_critical": return value <= sc.criticalThreshold && sc.criticalThreshold < nominal;
    case "below_warning":  return value <= sc.warningThreshold && value > sc.criticalThreshold && sc.warningThreshold < nominal;
    default:               return false;
  }
}

/* ── Product flow — mutates product array in place ────── */

// 0.5s spawn × 22s traverse → ~44 products on the belt at any time. Combined
// with the larger product geometry in ProductFlow3D, this fills the belt with
// a continuous stream of pellets → preforms → bottles → cartons.
const SPAWN_INTERVAL_SEC = 0.5;
const CONVEYOR_FULL_DURATION_SEC = 22;

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

    // Determine current stage — map lookup per stage (O(1)) instead of the
    // previous O(n) Array.find walk that ran per product per stage per tick.
    let currentStage: StageId | null = null;
    for (const stage of stages) {
      const config = STAGE_CONFIG_BY_ID[stage.id];
      if (!config) continue;
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

/**
 * Aggressive lerp — moves 20% of remaining distance per tick.
 * Reaches ~95% of target in about 3 seconds at 30Hz.
 */
function forceTo(key: string, target: number, min: number, max: number, speed: number, dt: number) {
  const current = sensorValues[key] ?? target;
  const pull = (target - current) * speed * dt;
  const noise = (Math.random() - 0.5) * 0.5 * dt;
  sensorValues[key] = clamp(current + pull + noise, min, max);
}

const scenarioFns: Record<string, ScenarioFn> = {
  normal_production: (elapsed, dt) => {
    // Aggressively force ALL sensors back to nominal values
    forceTo("mixing_ph", 7.0, 0, 14, 3.0, dt);
    forceTo("mixing_orp", 200, -500, 500, 3.0, dt);
    forceTo("mixing_turbidity", 15, 0, 100, 3.0, dt);
    forceTo("mixing_mq", 50, 0, 1000, 3.0, dt);
    forceTo("curing_mq", 30, 0, 1000, 3.0, dt);
    forceTo("curing_o2", 20.9, 0, 25, 3.0, dt);
    forceTo("curing_motion", 0, 0, 1, 3.0, dt);
    forceTo("quality_lidar", 0.5, 0, 50, 3.0, dt);
    forceTo("quality_turbidity", 5, 0, 100, 3.0, dt);
    forceTo("quality_light", 600, 0, 1000, 3.0, dt);
    forceTo("forming_pressure", 80, 0, 200, 3.0, dt);
    forceTo("pkg_pressure", 30, 0, 100, 3.0, dt);
    forceTo("pkg_water", 0, 0, 1, 3.0, dt);

    // Also re-enable any stopped motors/devices
    if (elapsed > 1) {
      const stages = useDigitalTwinStore.getState().stages;
      for (const stage of stages) {
        if (stage.status === "faulted") stage.status = "running";
        for (const d of stage.outputDevices) {
          if (d.type === "motor" && !d.active) {
            d.active = true;
            const cfg = DEVICE_CONFIG_BY_KEY[`${stage.id}::${d.deviceId}`];
            d.rpm = cfg?.defaultRpm ?? 60;
            d.direction = "forward";
          }
          if (d.type === "emergency_light") d.active = false;
        }
      }
    }

    return elapsed >= 10;
  },

  chemical_spill: (elapsed, dt) => {
    if (elapsed > 1 && elapsed < 12) {
      // Aggressively push pH to 12 and ORP to 460 — well above critical thresholds
      forceTo("mixing_ph", 12.0, 8, 14, 3.0, dt);
      forceTo("mixing_orp", 460, 300, 500, 3.0, dt);
      forceTo("mixing_mq", 400, 100, 800, 2.0, dt);
    }
    if (elapsed >= 12 && elapsed < 22) {
      // Recovery — pull back to nominal + restart motors
      forceTo("mixing_ph", 7.0, 4, 10, 3.0, dt);
      forceTo("mixing_orp", 200, 50, 350, 3.0, dt);
      forceTo("mixing_mq", 50, 0, 200, 3.0, dt);
      // Re-enable mixing equipment
      const stages = useDigitalTwinStore.getState().stages;
      const mixing = stages.find(s => s.id === "mixing");
      if (mixing && mixing.status === "faulted") mixing.status = "running";
      if (mixing) for (const d of mixing.outputDevices) {
        if (d.type === "motor" && !d.active) { d.active = true; d.rpm = 120; d.direction = "forward"; }
        if (d.type === "emergency_light") d.active = false;
      }
    }
    return elapsed >= 22;
  },

  gas_leak: (elapsed, dt) => {
    if (elapsed > 1 && elapsed < 10) {
      // Force MQ gas way above critical (500ppm) and O2 below critical (16%)
      forceTo("curing_mq", 800, 200, 1000, 3.0, dt);
      forceTo("curing_o2", 13, 10, 18, 3.0, dt);
    }
    if (elapsed >= 10 && elapsed < 18) {
      // Recovery + restart
      forceTo("curing_mq", 30, 0, 200, 3.0, dt);
      forceTo("curing_o2", 20.9, 16, 25, 3.0, dt);
      const stages = useDigitalTwinStore.getState().stages;
      const curing = stages.find(s => s.id === "curing");
      if (curing && curing.status === "faulted") curing.status = "running";
      if (curing) for (const d of curing.outputDevices) {
        if (d.type === "motor" && !d.active) { d.active = true; d.rpm = 200; d.direction = "forward"; }
        if (d.type === "emergency_light") d.active = false;
      }
    }
    return elapsed >= 18;
  },

  quality_failure: (elapsed, dt) => {
    if (elapsed > 1 && elapsed < 14) {
      // Push LiDAR above critical (2.0mm) and turbidity above critical (50 NTU)
      forceTo("quality_lidar", 4.0, 0.5, 10, 3.0, dt);
      forceTo("quality_turbidity", 70, 10, 100, 3.0, dt);
    }
    if (elapsed >= 14 && elapsed < 22) {
      // Recovery + restart
      forceTo("quality_lidar", 0.5, 0, 5, 3.0, dt);
      forceTo("quality_turbidity", 5, 0, 30, 3.0, dt);
      const stages = useDigitalTwinStore.getState().stages;
      const quality = stages.find(s => s.id === "quality");
      if (quality && quality.status === "faulted") quality.status = "running";
      if (quality) for (const d of quality.outputDevices) {
        if (d.type === "emergency_light") d.active = false;
      }
    }
    return elapsed >= 22;
  },
};

/* ── Main simulation loop ─────────────────────────────── */

// Self-scheduling tick — we use setTimeout recursion rather than setInterval.
// setInterval queues callbacks when a tick takes longer than the interval;
// under load that queue never drains, so every fresh MQTT message ends up
// waiting behind a growing backlog of stale ticks (the "3–4 s" latency the
// user was observing). setTimeout schedules the NEXT tick only after the
// current one finishes, so worst case we just tick slower under load
// instead of compounding lag indefinitely.
const TICK_INTERVAL_MS = 33; // ~30 Hz when the main thread is idle
// Holds either a setTimeout handle or a requestIdleCallback id, depending on
// which scheduler the current environment uses. Only checked for null-ness
// and passed to the matching cancel function, so the union is fine.
let tickTimerId: ReturnType<typeof setTimeout> | number | null = null;
// Track which scheduler was used so we call the matching cancel on stop.
let tickUsedIdle = false;
let lastTime = Date.now();

function tick() {
  const now = Date.now();

  // Pause the sim entirely while the tab is hidden. setInterval is throttled
  // to ~1 Hz by the browser in background tabs, but the wall-clock-based
  // spawn check keeps firing — that combination used to clump a long
  // backlog of near-identical products at intake. Skipping the whole tick
  // keeps the belt state frozen until the user returns, and the next
  // visible tick resumes cleanly.
  if (typeof document !== "undefined" && document.hidden) {
    lastTime = now;
    lastSpawnTime = now;
    return;
  }

  let dt = (now - lastTime) / 1000;
  if (dt > 0.1) dt = 0.1; // clamp dt to prevent massive jumps when tab is inactive
  lastTime = now;

  const store = useDigitalTwinStore.getState();
  const stages = store.stages;
  const products = store.products;

  // Normal sensor drift first
  tickSensors(stages, dt);

  // Scenario overrides AFTER normal drift — so scenario values stick
  // When live PLC feed is active, it takes precedence over manual scenarios.
  if (!plcFeed.active && activeScenario && scenarioFns[activeScenario]) {
    const elapsed = (now - scenarioStartTime) / 1000;
    if (scenarioFns[activeScenario](elapsed, dt)) {
      activeScenario = null;
      useDigitalTwinStore.setState({ activeScenario: null });
    }
    // Re-apply scenario sensor values to stage objects (drift may have overwritten)
    for (const stage of stages) {
      for (const sensor of stage.sensors) {
        if (sensorValues[sensor.sensorId] !== undefined) {
          sensor.value = sensorValues[sensor.sensorId];
          const sc = SENSOR_CONFIG_BY_KEY[sensor.sensorId];
          if (sc) sensor.status = sensorStatus(sensor.value, sc);
        }
      }
    }
  }

  const thresholdSpeed = applyPLCOperationalOverrides(
    stages,
    evaluateThresholds(stages),
  );
  const userSpeed = useDigitalTwinStore.getState().userSpeedMultiplier;
  const combinedSpeed = thresholdSpeed * userSpeed;
  const throughput = tickProducts(stages, products, dt, combinedSpeed);

  // Single setState call per tick — only scalar values change identity
  commitTick(thresholdSpeed, throughput, producedCount, rejectedCount);
}

/* ── Public API ───────────────────────────────────────── */

/**
 * Self-scheduling loop: run a tick, then request the next one.
 *
 * Uses `requestIdleCallback` when available so the tick only runs in the
 * gaps between paint frames — this is the difference between "frame missed
 * because the sim was mid-run" stutter and butter-smooth animation. A
 * timeout ceiling (2× the nominal interval) guarantees the tick still
 * progresses even if the browser is perpetually busy. Falls back to
 * setTimeout for environments without rIC (Safari).
 */
let nextTickDelay = TICK_INTERVAL_MS;

type IdleId = number;

interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}
type RIC = (
  cb: (deadline: IdleDeadline) => void,
  opts?: { timeout: number },
) => IdleId;
type CIC = (id: IdleId) => void;

const ric: RIC | null =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (window as unknown as { requestIdleCallback: RIC }).requestIdleCallback
    : null;
const cic: CIC | null =
  typeof window !== "undefined" && "cancelIdleCallback" in window
    ? (window as unknown as { cancelIdleCallback: CIC }).cancelIdleCallback
    : null;

function runTickAndReschedule() {
  const started = performance.now();
  try {
    tick();
  } finally {
    const elapsed = performance.now() - started;
    nextTickDelay = Math.max(0, TICK_INTERVAL_MS - elapsed);
    if (tickTimerId !== null) scheduleTick();
  }
}

function scheduleTick() {
  if (ric) {
    // Idle-scheduled: runs between frames, never interrupting paint. The
    // timeout ceiling ensures we never starve the sim indefinitely.
    tickUsedIdle = true;
    tickTimerId = ric(() => runTickAndReschedule(), {
      timeout: TICK_INTERVAL_MS * 2,
    });
  } else {
    tickUsedIdle = false;
    tickTimerId = setTimeout(runTickAndReschedule, nextTickDelay);
  }
}

export function startDigitalTwinSim() {
  if (tickTimerId) return;

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
  nextTickDelay = TICK_INTERVAL_MS;
  scheduleTick();
}

export function stopDigitalTwinSim() {
  if (tickTimerId !== null) {
    // Dispatch the correct cancel based on which scheduler queued the
    // current pending tick.
    if (tickUsedIdle && cic) {
      cic(tickTimerId as number);
    } else {
      clearTimeout(tickTimerId as ReturnType<typeof setTimeout>);
    }
    tickTimerId = null;
  }
  useDigitalTwinStore.setState({ simulationActive: false });
}

export function runDigitalTwinScenario(name: string) {
  activeScenario = name;
  scenarioStartTime = Date.now();
  useDigitalTwinStore.setState({ activeScenario: name });
}

export function setDigitalTwinPLCFeed(
  params: PLCParameter[],
  outputs: PLCOutputs,
) {
  const isLivePayload =
    params.length > 6 ||
    params.some((param) => param.id === "temperature" || !CORE_PLC_IDS.has(param.id));

  if (!isLivePayload) {
    if (plcFeed.active) {
      digitalTwinDebug("PLC feed disconnected from digital twin; reverting to simulation mode");
    }
    plcFeed = {
      active: false,
      paramValues: {},
      outputs: null,
    };
    return;
  }

  const paramValues: Record<string, number> = {};

  for (const param of params) {
    if (param.placeholder) continue;
    if (param.kind === "analog" && typeof param.value === "number") {
      paramValues[param.id] = param.value;
    } else if (param.kind === "digital" && typeof param.active === "boolean") {
      paramValues[param.id] = param.active ? 1 : 0;
    }
  }

  plcFeed = {
    active: Object.keys(paramValues).length > 0,
    paramValues,
    outputs,
  };

  digitalTwinDebug("PLC feed snapshot applied to digital twin", {
    paramCount: Object.keys(paramValues).length,
    sampleParams: Object.entries(paramValues)
      .slice(0, 8)
      .reduce<Record<string, number>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {}),
    outputs,
  });
}

export function isDigitalTwinRunning() {
  return tickTimerId !== null;
}

export const DT_SCENARIOS = [
  { id: "normal_production", label: "Normal Production",  duration: "30s", color: "#22c55e", description: "Steady manufacturing — all sensors nominal" },
  { id: "chemical_spill",    label: "Chemical Spill",     duration: "25s", color: "#f59e0b", description: "pH & ORP spike at mixing stage" },
  { id: "gas_leak",          label: "Gas Leak",           duration: "20s", color: "#ef4444", description: "MQ gas rises at curing stage" },
  { id: "quality_failure",   label: "Quality Failure",    duration: "28s", color: "#8b5cf6", description: "LiDAR & turbidity drift at QC" },
];
