import {
  AGENTIC_STORE_SCHEMA_VERSION,
  type ActionIntent,
  type JsonPrimitive,
  type ObservationBatch,
  type PresenceFrame,
  type RawReading,
  type SensorBinding,
  type ShopperTrack,
  type SimulatorControlRequest,
  type SimulatorState,
  type StoreManifest,
} from "../../../packages/agentic-store-contracts/src/index.js";
import {
  createSensorBindings,
  createStoreManifest,
} from "../domain/store-catalog.js";

export const STORE_SCENARIO_IDS = [
  "normal-rush",
  "cold-chain",
  "shelf-gap",
  "queue-surge",
  "accessibility-blocked",
  "energy-anomaly",
] as const;

export type StoreScenarioId = (typeof STORE_SCENARIO_IDS)[number];
export type SimulatorSeed = number | string;

export interface StoreSimulatorOptions {
  storeId?: string;
  seed?: SimulatorSeed;
  /** Wall-clock cadence for movement frames. Defaults to 100 ms. */
  tickIntervalMs?: number;
  /** Simulated-time multiplier. Defaults to 1. */
  speed?: number;
  /** Virtual timestamp assigned to simulation time zero. */
  startTime?: string | number | Date;
  onObservationBatch?: (batch: ObservationBatch) => void;
  onPresenceFrame?: (frame: PresenceFrame) => void;
  onStateChange?: (state: SimulatorState) => void;
}

export interface SimulationActionResult {
  actionId: string;
  accepted: boolean;
  appliedAt: string;
  message: string;
  state: SimulatorState;
}

type Listener<T> = (value: T) => void;

interface ShelfState {
  capacity: number;
  units: number;
  backroomUnits: number;
}

interface RefrigerationState {
  temperatureC: number;
  powerKw: number;
  doorOpenUntilMs: number;
  mode: "NORMAL" | "DEGRADED" | "RECOVERING";
}

interface CheckoutState {
  lanesOpen: number;
  serviceCredit: number;
}

interface ScenarioFaults {
  coldChain: boolean;
  shelfGap: boolean;
  queueSurge: boolean;
  aisleBlocked: boolean;
  energyAnomaly: boolean;
}

interface ActiveScenario {
  id: StoreScenarioId;
  startedAtMs: number;
  endsAtMs: number;
}

interface BusyAssociate {
  availableAtMs: number;
}

type WaypointKind = "TRANSIT" | "SHOP_PRODUCE" | "SHOP_BEVERAGE" | "SHOP_CHILLED" | "CHECKOUT" | "EXIT";

interface ShopperWaypoint {
  x: number;
  z: number;
  zoneId: string;
  kind: WaypointKind;
}

interface SimulatedShopper {
  track: ShopperTrack;
  route: ShopperWaypoint[];
  waypointIndex: number;
  dwellRemainingMs: number;
  queuedAtMs?: number;
}

interface StoreWorld {
  shoppers: Map<string, SimulatedShopper>;
  produce: ShelfState;
  beverage: ShelfState;
  dairy: RefrigerationState;
  freezer: RefrigerationState;
  checkout: CheckoutState;
  aisleClearanceM: number;
  energyBaselineKw: number;
  energyTotalKw: number;
  dairyDigitalAvailable: boolean;
  energyMode: "NORMAL" | "ECONOMY";
  associatesTotal: number;
  busyAssociates: BusyAssociate[];
  openOperationsTasks: number;
  faults: ScenarioFaults;
  arrivalCredit: number;
  entryTimesMs: number[];
  exitTimesMs: number[];
  transactionTimesMs: number[];
}

const DEFAULT_SCENARIO_DURATION_SECONDS: Record<StoreScenarioId, number> = {
  "normal-rush": 180,
  "cold-chain": 150,
  "shelf-gap": 120,
  "queue-surge": 150,
  "accessibility-blocked": 120,
  "energy-anomaly": 150,
};

const MAX_INTERNAL_STEP_MS = 100;
const OBSERVATION_INTERVAL_MS = 1_000;
const MAX_SHOPPERS = 120;
const CHECKOUT_SECONDS_PER_CUSTOMER_PER_LANE = 14;

const ENTRY_POINT = { x: 0, z: 10.8 };
const ENTRY_INSIDE = { x: 0, z: 8.6 };
const CHECKOUT_POINT = { x: -3.8, z: -6.3 };

const DESTINATIONS: Record<"produce" | "beverage" | "chilled", ShopperWaypoint> = {
  produce: { x: -6, z: 4.5, zoneId: "zone-produce", kind: "SHOP_PRODUCE" },
  beverage: { x: -1, z: 1.8, zoneId: "zone-grocery", kind: "SHOP_BEVERAGE" },
  chilled: { x: 6, z: 2, zoneId: "zone-chilled", kind: "SHOP_CHILLED" },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function hashSeed(seed: SimulatorSeed): number {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) throw new RangeError("Simulator seed must be finite.");
    return Math.trunc(seed) >>> 0;
  }

  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function parseStartTime(value: StoreSimulatorOptions["startTime"]): number {
  if (value == null) return Date.now();
  const parsed = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : value;
  if (!Number.isFinite(parsed)) throw new RangeError("Simulator startTime must be a valid date.");
  return parsed;
}

function isScenarioId(value: string): value is StoreScenarioId {
  return (STORE_SCENARIO_IDS as readonly string[]).includes(value);
}

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed || 0x6d2b79f5;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  between(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  integer(min: number, maxInclusive: number): number {
    return Math.floor(this.between(min, maxInclusive + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

/**
 * Deterministic local store world. It deliberately emits the same raw tags as
 * createSensorBindings so simulated and live PLC observations use one ingest
 * path. Shopper motion stays ephemeral; operational state is emitted at 1 Hz.
 */
export class StoreSimulator {
  readonly manifest: StoreManifest;
  readonly bindings: readonly SensorBinding[];

  private readonly storeId: string;
  readonly sourceId: string;
  private readonly tickIntervalMs: number;
  private readonly configuredStartTime?: StoreSimulatorOptions["startTime"];
  private readonly observationListeners = new Set<Listener<ObservationBatch>>();
  private readonly presenceListeners = new Set<Listener<PresenceFrame>>();
  private readonly stateListeners = new Set<Listener<SimulatorState>>();

  private seed: SimulatorSeed;
  private seedValue: number;
  private random: SeededRandom;
  private world: StoreWorld;
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private disposed = false;
  private speed: number;
  private epochMs: number;
  private elapsedMs = 0;
  private nextObservationAtMs = OBSERVATION_INTERVAL_MS;
  private observationSequence = 0;
  private tick = 0;
  private shopperCounter = 0;
  private sourceSessionCounter = 1;
  private sourceSessionId: string;
  private activeScenario?: ActiveScenario;

  constructor(options: StoreSimulatorOptions = {}) {
    this.storeId = options.storeId?.trim() || "store-001";
    this.sourceId = `simulator:${this.storeId}`;
    this.tickIntervalMs = clamp(Math.round(options.tickIntervalMs ?? 100), 25, 5_000);
    this.speed = this.validateSpeed(options.speed ?? 1);
    this.seed = options.seed ?? `${this.storeId}:agentic-store`;
    this.seedValue = hashSeed(this.seed);
    this.random = new SeededRandom(this.seedValue);
    this.configuredStartTime = options.startTime;
    this.epochMs = parseStartTime(options.startTime);
    this.sourceSessionId = this.makeSourceSessionId();
    this.manifest = createStoreManifest(this.storeId);
    this.bindings = createSensorBindings(this.storeId).filter((binding) => binding.sourceId === this.sourceId);
    this.world = this.createInitialWorld();

    if (options.onObservationBatch) this.observationListeners.add(options.onObservationBatch);
    if (options.onPresenceFrame) this.presenceListeners.add(options.onPresenceFrame);
    if (options.onStateChange) this.stateListeners.add(options.onStateChange);
  }

  getState(): SimulatorState {
    return {
      running: this.running,
      speed: this.speed,
      tick: this.tick,
      sourceSessionId: this.sourceSessionId,
      activeScenario: this.activeScenario?.id,
      scenarioEndsAt: this.activeScenario
        ? this.isoAt(this.activeScenario.endsAtMs)
        : undefined,
    };
  }

  getPresenceFrame(): PresenceFrame {
    return {
      storeId: this.storeId,
      sampledAt: this.isoAt(this.elapsedMs),
      shoppers: [...this.world.shoppers.values()].map((shopper) => ({ ...shopper.track })),
    };
  }

  onObservationBatch(listener: Listener<ObservationBatch>): () => void {
    this.observationListeners.add(listener);
    return () => this.observationListeners.delete(listener);
  }

  onPresenceFrame(listener: Listener<PresenceFrame>): () => void {
    this.presenceListeners.add(listener);
    return () => this.presenceListeners.delete(listener);
  }

  onStateChange(listener: Listener<SimulatorState>): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  start(speed?: number): SimulatorState {
    this.assertUsable();
    const previousSpeed = this.speed;
    if (speed != null) this.speed = this.validateSpeed(speed);
    if (!this.running) {
      this.running = true;
      this.timer = setInterval(() => {
        this.advanceBy(this.tickIntervalMs * this.speed);
      }, this.tickIntervalMs);
      this.emitPresenceFrame();
      this.emitState();
    } else if (this.speed !== previousSpeed) {
      this.emitState();
    }
    return this.getState();
  }

  pause(): SimulatorState {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    const changed = this.running;
    this.running = false;
    if (changed) this.emitState();
    return this.getState();
  }

  reset(seed: SimulatorSeed = this.seed): SimulatorState {
    this.assertUsable();
    const openOperationsTasks = this.world.openOperationsTasks;
    this.pause();
    this.seed = seed;
    this.seedValue = hashSeed(seed);
    this.random = new SeededRandom(this.seedValue);
    this.epochMs = parseStartTime(this.configuredStartTime);
    this.elapsedMs = 0;
    this.nextObservationAtMs = OBSERVATION_INTERVAL_MS;
    this.observationSequence = 0;
    this.tick = 0;
    this.shopperCounter = 0;
    this.sourceSessionCounter += 1;
    this.sourceSessionId = this.makeSourceSessionId();
    this.activeScenario = undefined;
    this.world = this.createInitialWorld();
    this.world.openOperationsTasks = openOperationsTasks;
    this.emitObservationBatch(0);
    this.emitPresenceFrame();
    this.emitState();
    return this.getState();
  }

  setSpeed(speed: number): SimulatorState {
    this.assertUsable();
    this.speed = this.validateSpeed(speed);
    this.emitState();
    return this.getState();
  }

  setOpenOperationsTasks(count: number): void {
    this.assertUsable();
    if (!Number.isFinite(count) || count < 0) {
      throw new RangeError("Open operations task count must be a non-negative number.");
    }
    this.world.openOperationsTasks = Math.trunc(count);
  }

  control(request: SimulatorControlRequest): SimulatorState {
    switch (request.action) {
      case "START":
        return this.start(request.speed);
      case "PAUSE":
        if (request.speed != null) this.setSpeed(request.speed);
        return this.pause();
      case "RESET": {
        const state = this.reset();
        if (request.speed != null) return this.setSpeed(request.speed);
        return state;
      }
    }
  }

  startScenario(id: StoreScenarioId, durationSeconds?: number): SimulatorState {
    this.assertUsable();
    if (!isScenarioId(id)) throw new RangeError(`Unknown store scenario: ${String(id)}`);
    const duration = clamp(
      durationSeconds ?? DEFAULT_SCENARIO_DURATION_SECONDS[id],
      5,
      3_600,
    );

    this.prepareScenario(id);
    this.activeScenario = {
      id,
      startedAtMs: this.elapsedMs,
      endsAtMs: this.elapsedMs + duration * 1_000,
    };
    this.emitState();
    return this.getState();
  }

  stopScenario(): SimulatorState {
    this.recoverScenarioState(this.activeScenario?.id);
    this.activeScenario = undefined;
    this.emitObservationBatch(this.elapsedMs);
    this.emitState();
    return this.getState();
  }

  /**
   * Advance virtual time without a wall-clock timer. This makes scenarios and
   * emitted observation batches exactly reproducible in integration tests.
   */
  advanceBy(simulationMs: number): SimulatorState {
    this.assertUsable();
    if (!Number.isFinite(simulationMs) || simulationMs < 0) {
      throw new RangeError("simulationMs must be a finite non-negative number.");
    }
    if (simulationMs === 0) return this.getState();

    let remainingMs = simulationMs;
    while (remainingMs > 0) {
      const untilObservationMs = Math.max(0, this.nextObservationAtMs - this.elapsedMs);
      const stepMs = Math.min(
        remainingMs,
        MAX_INTERNAL_STEP_MS,
        untilObservationMs > 0 ? untilObservationMs : MAX_INTERNAL_STEP_MS,
      );
      const actualStepMs = stepMs > 0 ? stepMs : Math.min(remainingMs, MAX_INTERNAL_STEP_MS);
      const nextElapsedMs = this.elapsedMs + actualStepMs;
      this.advanceWorld(actualStepMs / 1_000, nextElapsedMs);
      this.elapsedMs = nextElapsedMs;
      remainingMs -= actualStepMs;

      if (this.elapsedMs + Number.EPSILON >= this.nextObservationAtMs) {
        this.emitObservationBatch(this.nextObservationAtMs);
        this.nextObservationAtMs += OBSERVATION_INTERVAL_MS;
      }

      if (this.activeScenario && this.elapsedMs >= this.activeScenario.endsAtMs) {
        this.recoverScenarioState(this.activeScenario.id);
        this.activeScenario = undefined;
        this.emitObservationBatch(this.elapsedMs);
        this.emitState();
      }
    }

    this.tick += 1;
    this.emitPresenceFrame();
    return this.getState();
  }

  applyAction(action: ActionIntent): SimulationActionResult {
    this.assertUsable();
    const appliedAt = this.isoAt(this.elapsedMs);
    let accepted = false;
    let message = `Simulator does not implement ${action.kind}.`;

    switch (action.kind) {
      case "DISPATCH_RESTOCK": {
        const shelf = this.shelfForEntity(action.targetEntityId);
        if (!shelf) {
          message = `Unknown restock target ${action.targetEntityId}.`;
          break;
        }
        const requested = this.numberParameter(action, "quantity")
          ?? this.numberParameter(action, "units")
          ?? Math.max(0, Math.ceil(shelf.capacity * 0.8 - shelf.units));
        const quantity = Math.max(0, Math.min(requested, shelf.backroomUnits, shelf.capacity - shelf.units));
        shelf.units += quantity;
        shelf.backroomUnits -= quantity;
        if (quantity > 0) {
          this.world.faults.shelfGap = false;
        }
        this.occupyAssociate(8_000);
        accepted = quantity > 0;
        message = accepted
          ? `Restocked ${round(quantity, 0)} units at ${action.targetEntityId}.`
          : `No stock movement was possible at ${action.targetEntityId}.`;
        break;
      }

      case "REQUEST_MAINTENANCE": {
        if (action.targetEntityId !== "cooler-dairy-01" && action.targetEntityId !== "freezer-frozen-01") {
          message = `Unknown maintenance target ${action.targetEntityId}.`;
          break;
        }
        if (action.targetEntityId === "cooler-dairy-01") {
          this.world.faults.coldChain = false;
          this.world.dairy.mode = "RECOVERING";
        } else {
          this.world.freezer.mode = "RECOVERING";
        }
        this.occupyAssociate(20_000);
        accepted = true;
        message = `Maintenance recovery started for ${action.targetEntityId}.`;
        break;
      }

      case "OPEN_CHECKOUT_LANE": {
        if (action.targetEntityId !== "checkout-cluster-01") {
          message = `Unknown checkout target ${action.targetEntityId}.`;
          break;
        }
        const requestedTotal = this.numberParameter(action, "lanesOpen");
        const additional = this.numberParameter(action, "additionalLanes") ?? 1;
        const nextLanes = requestedTotal == null
          ? this.world.checkout.lanesOpen + additional
          : requestedTotal;
        const previous = this.world.checkout.lanesOpen;
        this.world.checkout.lanesOpen = clamp(Math.round(nextLanes), 1, 6);
        this.world.faults.queueSurge = false;
        this.occupyAssociate(5_000);
        accepted = this.world.checkout.lanesOpen > previous;
        message = accepted
          ? `Checkout capacity increased to ${this.world.checkout.lanesOpen} lanes.`
          : `Checkout already has ${this.world.checkout.lanesOpen} lanes open.`;
        break;
      }

      case "CLEAR_AISLE": {
        if (action.targetEntityId !== "aisle-03") {
          message = `Unknown aisle target ${action.targetEntityId}.`;
          break;
        }
        this.world.aisleClearanceM = clamp(
          this.numberParameter(action, "clearanceM") ?? 1.6,
          1.2,
          2,
        );
        this.world.faults.aisleBlocked = false;
        this.occupyAssociate(6_000);
        accepted = true;
        message = `Accessible route restored with ${round(this.world.aisleClearanceM)} m clearance.`;
        break;
      }

      case "SET_DIGITAL_AVAILABILITY": {
        if (action.targetEntityId !== "cooler-dairy-01") {
          message = `Unknown digital availability target ${action.targetEntityId}.`;
          break;
        }
        const requested = action.parameters.available;
        if (typeof requested !== "boolean") {
          message = "Digital availability action requires a boolean available parameter.";
          break;
        }
        this.world.dairyDigitalAvailable = requested;
        accepted = true;
        message = `Digital availability for ${action.targetEntityId} set to ${String(requested)}.`;
        break;
      }

      case "SET_EQUIPMENT_MODE": {
        if (action.targetEntityId !== "energy-panel-01") {
          message = `Unknown equipment mode target ${action.targetEntityId}.`;
          break;
        }
        const mode = action.parameters.mode;
        if (mode !== "NORMAL" && mode !== "ECONOMY") {
          message = "Equipment mode must be NORMAL or ECONOMY.";
          break;
        }
        this.world.energyMode = mode;
        if (mode === "ECONOMY") this.world.faults.energyAnomaly = false;
        accepted = true;
        message = `Store equipment mode set to ${mode}.`;
        break;
      }

      case "CREATE_TASK":
        accepted = true;
        message = "Operations task accepted by the local workflow adapter.";
        break;

      default:
        break;
    }

    return {
      actionId: action.id,
      accepted,
      appliedAt,
      message,
      state: this.getState(),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.pause();
    this.disposed = true;
    this.observationListeners.clear();
    this.presenceListeners.clear();
    this.stateListeners.clear();
  }

  private createInitialWorld(): StoreWorld {
    return {
      shoppers: new Map(),
      produce: { capacity: 48, units: 38, backroomUnits: 110 },
      beverage: { capacity: 72, units: 58, backroomUnits: 180 },
      dairy: { temperatureC: 3.2, powerKw: 0.92, doorOpenUntilMs: 0, mode: "NORMAL" },
      freezer: { temperatureC: -18.2, powerKw: 1.18, doorOpenUntilMs: 0, mode: "NORMAL" },
      checkout: { lanesOpen: 2, serviceCredit: 0 },
      aisleClearanceM: 1.65,
      energyBaselineKw: 18.4,
      energyTotalKw: 21.2,
      dairyDigitalAvailable: true,
      energyMode: "NORMAL",
      associatesTotal: 5,
      busyAssociates: [],
      openOperationsTasks: 0,
      faults: {
        coldChain: false,
        shelfGap: false,
        queueSurge: false,
        aisleBlocked: false,
        energyAnomaly: false,
      },
      arrivalCredit: this.random.next(),
      entryTimesMs: [],
      exitTimesMs: [],
      transactionTimesMs: [],
    };
  }

  private prepareScenario(id: StoreScenarioId): void {
    this.world.faults = {
      coldChain: false,
      shelfGap: false,
      queueSurge: false,
      aisleBlocked: false,
      energyAnomaly: false,
    };
    this.world.aisleClearanceM = 1.65;
    this.world.checkout.lanesOpen = Math.max(2, this.world.checkout.lanesOpen);
    this.world.dairy.mode = this.world.dairy.temperatureC > 5 ? "RECOVERING" : "NORMAL";
    this.world.freezer.mode = "NORMAL";
    this.world.energyMode = "NORMAL";
    this.world.produce.units = Math.max(this.world.produce.units, this.world.produce.capacity * 0.65);
    this.world.beverage.units = Math.max(this.world.beverage.units, this.world.beverage.capacity * 0.65);

    switch (id) {
      case "normal-rush":
        break;
      case "cold-chain":
        this.world.faults.coldChain = true;
        this.world.dairy.mode = "DEGRADED";
        break;
      case "shelf-gap":
        this.world.faults.shelfGap = true;
        this.world.produce.units = Math.min(this.world.produce.units, 7);
        break;
      case "queue-surge":
        this.world.faults.queueSurge = true;
        this.world.checkout.lanesOpen = 1;
        break;
      case "accessibility-blocked":
        this.world.faults.aisleBlocked = true;
        this.world.aisleClearanceM = 0.55;
        break;
      case "energy-anomaly":
        this.world.faults.energyAnomaly = true;
        this.world.energyMode = "NORMAL";
        break;
    }
  }

  private advanceWorld(deltaSeconds: number, nextElapsedMs: number): void {
    this.pruneTimedData(nextElapsedMs);
    this.spawnArrivals(deltaSeconds, nextElapsedMs);
    this.moveShoppers(deltaSeconds, nextElapsedMs);
    this.serviceCheckout(deltaSeconds, nextElapsedMs);
    this.updateInventory(deltaSeconds);
    this.updateRefrigeration(deltaSeconds, nextElapsedMs);
    this.updateEnergy(deltaSeconds);
  }

  private recoverScenarioState(id: StoreScenarioId | undefined): void {
    if (!id) return;
    switch (id) {
      case "normal-rush":
        break;
      case "cold-chain":
        this.world.faults.coldChain = false;
        this.world.dairy.mode = "RECOVERING";
        break;
      case "shelf-gap":
        this.world.faults.shelfGap = false;
        this.world.produce.units = Math.max(
          this.world.produce.units,
          this.world.produce.capacity * 0.65,
        );
        break;
      case "queue-surge":
        this.world.faults.queueSurge = false;
        this.world.checkout.lanesOpen = Math.max(2, this.world.checkout.lanesOpen);
        break;
      case "accessibility-blocked":
        this.world.faults.aisleBlocked = false;
        this.world.aisleClearanceM = 1.65;
        break;
      case "energy-anomaly":
        this.world.faults.energyAnomaly = false;
        this.world.energyMode = "NORMAL";
        break;
    }
  }

  private spawnArrivals(deltaSeconds: number, nowMs: number): void {
    const ratePerMinute = this.arrivalRatePerMinute();
    this.world.arrivalCredit += ratePerMinute * deltaSeconds / 60;
    while (this.world.arrivalCredit >= 1 && this.world.shoppers.size < MAX_SHOPPERS) {
      this.world.arrivalCredit -= 1;
      this.spawnShopper(nowMs);
    }
  }

  private spawnShopper(nowMs: number): void {
    this.shopperCounter += 1;
    const id = `shopper-${this.sourceSessionCounter}-${String(this.shopperCounter).padStart(4, "0")}`;
    const choices = ["produce", "beverage", "chilled"] as const;
    const shuffled = [...choices].sort(() => this.random.next() - 0.5);
    const visitCount = this.random.integer(1, 3);
    const route: ShopperWaypoint[] = [
      { ...ENTRY_INSIDE, zoneId: "zone-entrance", kind: "TRANSIT" },
      ...shuffled.slice(0, visitCount).map((choice) => ({ ...DESTINATIONS[choice] })),
      { ...CHECKOUT_POINT, zoneId: "zone-checkout", kind: "CHECKOUT" },
      { ...ENTRY_POINT, zoneId: "zone-entrance", kind: "EXIT" },
    ];
    const first = route[0];
    const heading = Math.atan2(first.x - ENTRY_POINT.x, first.z - ENTRY_POINT.z);
    this.world.shoppers.set(id, {
      track: {
        id,
        x: ENTRY_POINT.x + this.random.between(-0.35, 0.35),
        z: ENTRY_POINT.z,
        heading,
        speed: this.random.between(0.9, 1.35),
        state: "ENTERING",
        destinationZoneId: first.zoneId,
        basketItems: 0,
      },
      route,
      waypointIndex: 0,
      dwellRemainingMs: 0,
    });
    this.world.entryTimesMs.push(nowMs);
  }

  private moveShoppers(deltaSeconds: number, nowMs: number): void {
    const toRemove: string[] = [];
    for (const shopper of this.world.shoppers.values()) {
      if (shopper.queuedAtMs != null) continue;

      const waypoint = shopper.route[shopper.waypointIndex];
      if (!waypoint) {
        toRemove.push(shopper.track.id);
        continue;
      }

      if (shopper.dwellRemainingMs > 0) {
        shopper.dwellRemainingMs -= deltaSeconds * 1_000;
        if (shopper.dwellRemainingMs <= 0) {
          this.completeShoppingStop(shopper, waypoint, nowMs);
          shopper.waypointIndex += 1;
          this.updateDestination(shopper);
        }
        continue;
      }

      const dx = waypoint.x - shopper.track.x;
      const dz = waypoint.z - shopper.track.z;
      const distance = Math.hypot(dx, dz);
      const blockageMultiplier = this.world.faults.aisleBlocked && waypoint.zoneId === "zone-grocery" ? 0.58 : 1;
      const step = shopper.track.speed * blockageMultiplier * deltaSeconds;
      if (distance > Math.max(0.01, step)) {
        shopper.track.x += dx / distance * step;
        shopper.track.z += dz / distance * step;
        shopper.track.heading = Math.atan2(dx, dz);
        continue;
      }

      shopper.track.x = waypoint.x;
      shopper.track.z = waypoint.z;
      switch (waypoint.kind) {
        case "TRANSIT":
          shopper.track.state = "BROWSING";
          shopper.waypointIndex += 1;
          this.updateDestination(shopper);
          break;
        case "SHOP_PRODUCE":
        case "SHOP_BEVERAGE":
        case "SHOP_CHILLED":
          shopper.track.state = "BROWSING";
          shopper.dwellRemainingMs = this.random.between(4_000, 12_000);
          break;
        case "CHECKOUT":
          shopper.track.state = "QUEUING";
          shopper.queuedAtMs = nowMs;
          this.positionCheckoutQueue();
          break;
        case "EXIT":
          this.world.exitTimesMs.push(nowMs);
          toRemove.push(shopper.track.id);
          break;
      }
    }

    for (const id of toRemove) this.world.shoppers.delete(id);
  }

  private completeShoppingStop(shopper: SimulatedShopper, waypoint: ShopperWaypoint, nowMs: number): void {
    let purchased = 0;
    if (waypoint.kind === "SHOP_PRODUCE") {
      purchased = this.takeFromShelf(this.world.produce, this.random.integer(1, 3));
    } else if (waypoint.kind === "SHOP_BEVERAGE") {
      purchased = this.takeFromShelf(this.world.beverage, this.random.integer(1, 4));
    } else if (waypoint.kind === "SHOP_CHILLED" && this.dairyAvailable()) {
      purchased = this.random.integer(1, 3);
      this.world.dairy.doorOpenUntilMs = Math.max(this.world.dairy.doorOpenUntilMs, nowMs + 2_500);
    }
    shopper.track.basketItems += purchased;
  }

  private serviceCheckout(deltaSeconds: number, nowMs: number): void {
    const queued = this.queuedShoppers();
    if (queued.length === 0) {
      this.world.checkout.serviceCredit = Math.min(this.world.checkout.serviceCredit, 0.95);
      return;
    }

    this.world.checkout.serviceCredit +=
      this.world.checkout.lanesOpen * deltaSeconds / CHECKOUT_SECONDS_PER_CUSTOMER_PER_LANE;
    while (this.world.checkout.serviceCredit >= 1) {
      const next = this.queuedShoppers()[0];
      if (!next) break;
      this.world.checkout.serviceCredit -= 1;
      next.queuedAtMs = undefined;
      next.waypointIndex += 1;
      next.track.state = "EXITING";
      this.updateDestination(next);
      this.world.transactionTimesMs.push(nowMs);
    }
    this.positionCheckoutQueue();
  }

  private positionCheckoutQueue(): void {
    const queue = this.queuedShoppers();
    queue.forEach((shopper, index) => {
      shopper.track.x = CHECKOUT_POINT.x + (index % 2) * 0.65;
      shopper.track.z = CHECKOUT_POINT.z + Math.floor(index / 2) * 0.55;
      shopper.track.heading = Math.PI;
    });
  }

  private queuedShoppers(): SimulatedShopper[] {
    return [...this.world.shoppers.values()]
      .filter((shopper) => shopper.queuedAtMs != null)
      .sort((left, right) => (left.queuedAtMs ?? 0) - (right.queuedAtMs ?? 0));
  }

  private updateDestination(shopper: SimulatedShopper): void {
    const waypoint = shopper.route[shopper.waypointIndex];
    shopper.track.destinationZoneId = waypoint?.zoneId;
  }

  private updateInventory(deltaSeconds: number): void {
    if (this.world.faults.shelfGap) {
      this.world.produce.units = Math.max(1, this.world.produce.units - 0.32 * deltaSeconds);
    } else if (this.fillRatio(this.world.beverage) < 0.34 && this.world.beverage.backroomUnits > 0) {
      const routineRestock = Math.min(0.08 * deltaSeconds, this.world.beverage.backroomUnits);
      this.world.beverage.units = Math.min(this.world.beverage.capacity, this.world.beverage.units + routineRestock);
      this.world.beverage.backroomUnits -= routineRestock;
    }

    if (this.fillRatio(this.world.produce) < 0.38 && this.world.produce.backroomUnits > 0) {
      const routineRestock = Math.min(0.06 * deltaSeconds, this.world.produce.backroomUnits);
      this.world.produce.units = Math.min(this.world.produce.capacity, this.world.produce.units + routineRestock);
      this.world.produce.backroomUnits -= routineRestock;
    }
  }

  private updateRefrigeration(deltaSeconds: number, nowMs: number): void {
    const dairyDoorOpen = nowMs < this.world.dairy.doorOpenUntilMs;
    const freezerDoorOpen = nowMs < this.world.freezer.doorOpenUntilMs;
    const dairyTarget = this.world.faults.coldChain ? 11.2 : dairyDoorOpen ? 5.1 : 3.2;
    const freezerTarget = freezerDoorOpen ? -15.8 : -18.2;

    this.world.dairy.temperatureC +=
      (dairyTarget - this.world.dairy.temperatureC) * (this.world.faults.coldChain ? 0.018 : 0.07) * deltaSeconds
      + this.random.between(-0.012, 0.012) * Math.sqrt(deltaSeconds);
    this.world.freezer.temperatureC +=
      (freezerTarget - this.world.freezer.temperatureC) * 0.055 * deltaSeconds
      + this.random.between(-0.01, 0.01) * Math.sqrt(deltaSeconds);

    if (this.world.faults.coldChain) {
      this.world.dairy.mode = "DEGRADED";
      this.world.dairy.powerKw = 0.28;
    } else if (this.world.dairy.temperatureC > 4.5) {
      this.world.dairy.mode = "RECOVERING";
      this.world.dairy.powerKw = 1.48;
    } else {
      this.world.dairy.mode = "NORMAL";
      this.world.dairy.powerKw = dairyDoorOpen ? 1.15 : 0.92;
    }

    this.world.freezer.mode = this.world.freezer.temperatureC > -16.5 ? "RECOVERING" : "NORMAL";
    this.world.freezer.powerKw = this.world.freezer.mode === "RECOVERING" ? 1.55 : 1.18;
  }

  private updateEnergy(deltaSeconds: number): void {
    const operatingFactor = this.world.energyMode === "ECONOMY" ? 0.82 : 1;
    const target = this.world.energyBaselineKw * operatingFactor
      + this.world.dairy.powerKw
      + this.world.freezer.powerKw
      + this.world.shoppers.size * 0.045
      + this.world.checkout.lanesOpen * 0.18
      + (this.world.faults.energyAnomaly ? 14 : 0);
    const noise = this.random.between(-0.05, 0.05);
    this.world.energyTotalKw += (target - this.world.energyTotalKw) * 0.2 * deltaSeconds + noise * deltaSeconds;
  }

  private emitObservationBatch(sampleElapsedMs: number): void {
    this.observationSequence += 1;
    const sampledAt = this.isoAt(sampleElapsedMs);
    const values = this.readingValues();
    const readings: RawReading[] = this.bindings.map((binding) => {
      const value = values[binding.tag];
      if (value === undefined) {
        throw new Error(`Store simulator has no value for sensor binding tag ${binding.tag}.`);
      }
      return { tag: binding.tag, value, quality: "GOOD" };
    });
    const batch: ObservationBatch = {
      schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
      storeId: this.storeId,
      sourceId: this.sourceId,
      sourceSessionId: this.sourceSessionId,
      sequence: this.observationSequence,
      sampledAt,
      readings,
    };
    for (const listener of this.observationListeners) listener(batch);
  }

  private readingValues(): Record<string, JsonPrimitive> {
    const queueLength = this.queuedShoppers().length;
    const entryRate = this.rollingRate(this.world.entryTimesMs);
    const exitRate = this.rollingRate(this.world.exitTimesMs);
    const transactionsPerMinute = this.rollingRate(this.world.transactionTimesMs);
    const activeTasks = this.world.busyAssociates.length;
    const availableAssociates = Math.max(0, this.world.associatesTotal - activeTasks);

    return {
      "store.occupancy": this.world.shoppers.size,
      "store.entriesPerMinute": entryRate,
      "store.energyKw": round(this.world.energyTotalKw),
      "store.mode": this.storeMode(),
      "entry.entriesPerMinute": entryRate,
      "entry.exitsPerMinute": exitRate,
      "produce.fillRatio": round(this.fillRatio(this.world.produce), 3),
      "produce.unitsOnShelf": Math.max(0, Math.round(this.world.produce.units)),
      "produce.backroomUnits": Math.max(0, Math.round(this.world.produce.backroomUnits)),
      "produce.available": this.world.produce.units >= 1,
      "beverage.fillRatio": round(this.fillRatio(this.world.beverage), 3),
      "beverage.unitsOnShelf": Math.max(0, Math.round(this.world.beverage.units)),
      "beverage.backroomUnits": Math.max(0, Math.round(this.world.beverage.backroomUnits)),
      "beverage.available": this.world.beverage.units >= 1,
      "dairy.temperatureC": round(this.world.dairy.temperatureC),
      "dairy.doorOpen": this.elapsedMs < this.world.dairy.doorOpenUntilMs,
      "dairy.powerKw": round(this.world.dairy.powerKw),
      "dairy.mode": this.world.dairy.mode,
      "dairy.available": this.world.dairyDigitalAvailable && this.dairyAvailable(),
      "freezer.temperatureC": round(this.world.freezer.temperatureC),
      "freezer.doorOpen": this.elapsedMs < this.world.freezer.doorOpenUntilMs,
      "freezer.powerKw": round(this.world.freezer.powerKw),
      "freezer.mode": this.world.freezer.mode,
      "checkout.queueLength": queueLength,
      "checkout.waitSeconds": round(queueLength * CHECKOUT_SECONDS_PER_CUSTOMER_PER_LANE / this.world.checkout.lanesOpen, 0),
      "checkout.lanesOpen": this.world.checkout.lanesOpen,
      "checkout.transactionsPerMinute": transactionsPerMinute,
      "aisle03.clearanceM": round(this.world.aisleClearanceM),
      "aisle03.routeAvailable": !this.world.faults.aisleBlocked && this.world.aisleClearanceM >= 1.2,
      "energy.totalKw": round(this.world.energyTotalKw),
      "energy.baselineKw": round(this.world.energyBaselineKw),
      "workforce.available": availableAssociates,
      "workforce.openTasks": this.world.openOperationsTasks,
    };
  }

  private emitPresenceFrame(): void {
    const frame = this.getPresenceFrame();
    for (const listener of this.presenceListeners) listener(frame);
  }

  private emitState(): void {
    const state = this.getState();
    for (const listener of this.stateListeners) listener(state);
  }

  private arrivalRatePerMinute(): number {
    switch (this.activeScenario?.id) {
      case "normal-rush":
        return 22;
      case "queue-surge":
        return 34;
      case "shelf-gap":
        return 15;
      case "cold-chain":
        return 12;
      case "accessibility-blocked":
        return 13;
      case "energy-anomaly":
        return 10;
      default:
        return 8;
    }
  }

  private rollingRate(timestamps: readonly number[]): number {
    const visibleWindowMs = clamp(this.elapsedMs, 10_000, 60_000);
    return round(timestamps.length * 60_000 / visibleWindowMs, 1);
  }

  private pruneTimedData(nowMs: number): void {
    const cutoff = nowMs - 60_000;
    const prune = (timestamps: number[]) => {
      while (timestamps.length > 0 && timestamps[0] < cutoff) timestamps.shift();
    };
    prune(this.world.entryTimesMs);
    prune(this.world.exitTimesMs);
    prune(this.world.transactionTimesMs);
    this.world.busyAssociates = this.world.busyAssociates.filter((associate) => associate.availableAtMs > nowMs);
  }

  private occupyAssociate(durationMs: number): void {
    this.world.busyAssociates.push({ availableAtMs: this.elapsedMs + durationMs });
  }

  private takeFromShelf(shelf: ShelfState, requested: number): number {
    const purchased = Math.min(Math.max(0, requested), Math.floor(shelf.units));
    shelf.units -= purchased;
    return purchased;
  }

  private fillRatio(shelf: ShelfState): number {
    return clamp(shelf.units / shelf.capacity, 0, 1);
  }

  private dairyAvailable(): boolean {
    return this.world.dairy.temperatureC <= 8 && this.world.dairy.mode !== "DEGRADED";
  }

  private storeMode(): string {
    if (
      this.world.faults.coldChain ||
      this.world.faults.shelfGap ||
      this.world.faults.aisleBlocked ||
      this.world.faults.energyAnomaly
    ) return "INCIDENT";
    if (this.activeScenario?.id === "normal-rush" || this.activeScenario?.id === "queue-surge") return "RUSH";
    if (this.world.shoppers.size >= 30) return "BUSY";
    return "NORMAL";
  }

  private shelfForEntity(entityId: string): ShelfState | undefined {
    if (entityId === "shelf-produce-01") return this.world.produce;
    if (entityId === "shelf-beverage-01") return this.world.beverage;
    return undefined;
  }

  private numberParameter(action: ActionIntent, key: string): number | undefined {
    const value = action.parameters[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private validateSpeed(speed: number): number {
    if (!Number.isFinite(speed) || speed <= 0) throw new RangeError("Simulator speed must be greater than zero.");
    return clamp(speed, 0.1, 20);
  }

  private makeSourceSessionId(): string {
    return `${this.sourceId}:session-${this.epochMs}-${this.sourceSessionCounter}-${this.seedValue.toString(16).padStart(8, "0")}`;
  }

  private isoAt(elapsedMs: number): string {
    return new Date(this.epochMs + elapsedMs).toISOString();
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error("StoreSimulator has been disposed.");
  }
}

export function createStoreSimulator(options: StoreSimulatorOptions = {}): StoreSimulator {
  return new StoreSimulator(options);
}
