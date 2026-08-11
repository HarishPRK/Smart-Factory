import type {
  EvidenceReference,
  IncidentKind,
  IncidentRecord,
  IncidentSeverity,
  TwinPropertyState,
  TwinSnapshot,
} from "../../../packages/agentic-store-contracts/src/index.js";

export interface IncidentCandidate {
  key: string;
  kind: IncidentKind;
  severity: IncidentSeverity;
  entityId: string;
  title: string;
  summary: string;
  evidence: EvidenceReference[];
  triggerSourceIds: string[];
}

export interface IncidentEvaluation {
  open: IncidentCandidate[];
  resolve: IncidentRecord[];
}

interface RuleResult {
  active: boolean;
  clear: boolean;
  evidence: TwinPropertyState[];
  triggerEvidence: TwinPropertyState[];
  clearEvidence: TwinPropertyState[];
  clockEvidence: TwinPropertyState[];
}

interface IncidentRule {
  kind: IncidentKind;
  severity: IncidentSeverity;
  entityId: string;
  title: string;
  summary: string;
  triggerForMs: number;
  clearForMs: number;
  triggerMode: "ALL" | "ANY";
  evaluate(properties: Map<string, TwinPropertyState>): RuleResult;
}

const propertyKey = (entityId: string, property: string) => `${entityId}\u0000${property}`;

function asNumber(value: TwinPropertyState | undefined): number | undefined {
  return typeof value?.value === "number" ? value.value : undefined;
}

function isGood(value: TwinPropertyState | undefined): value is TwinPropertyState {
  return value?.quality === "GOOD";
}

function evidenceFrom(properties: TwinPropertyState[]): EvidenceReference[] {
  return properties.map((property) => ({
    entityId: property.entityId,
    property: property.property,
    sourceId: property.sourceId,
    value: property.value,
    unit: property.unit,
    sampledAt: property.sampledAt,
    quality: property.quality,
  }));
}

function evaluationTime(
  evidence: readonly TwinPropertyState[],
  fallback: number,
): number {
  if (evidence.length === 0) return fallback;
  const sources = new Set(evidence.map((property) => property.sourceId));
  const simulatorOwned =
    sources.size === 1 && evidence[0]?.sourceId.startsWith("simulator:");
  const times = evidence
    .map((property) => Date.parse(
      simulatorOwned ? property.sampledAt : property.receivedAt,
    ))
    .filter(Number.isFinite);
  return times.length > 0 ? Math.max(...times) : fallback;
}

export class IncidentRuleEngine {
  private readonly triggerSince = new Map<string, number>();
  private readonly clearSince = new Map<string, number>();

  constructor(private readonly rules: IncidentRule[] = defaultRules()) {}

  evaluate(
    snapshot: TwinSnapshot,
    activeIncidents: IncidentRecord[],
    now = Date.now(),
  ): IncidentEvaluation {
    const properties = new Map(
      snapshot.properties.map((property) => [propertyKey(property.entityId, property.property), property]),
    );
    const activeByKey = new Map(
      activeIncidents
        .filter((incident) => incident.status !== "RESOLVED")
        .map((incident) => [`${incident.kind}:${incident.entityId}`, incident]),
    );
    const open: IncidentCandidate[] = [];
    const resolve: IncidentRecord[] = [];

    for (const rule of this.rules) {
      const key = `${rule.kind}:${rule.entityId}`;
      const state = rule.evaluate(properties);
      const activeIncident = activeByKey.get(key);
      // Accelerated simulator observations carry a virtual sample clock, while
      // PLC and mixed-source rules use trusted server receipt time. This keeps
      // hysteresis consistent with scenario time without trusting device clocks
      // for physical-store decisions.
      const evaluatedAt = evaluationTime(state.clockEvidence, now);

      if (state.active) {
        this.clearSince.delete(key);
        const since = this.triggerSince.get(key) ?? evaluatedAt;
        this.triggerSince.set(key, since);
        if (!activeIncident && evaluatedAt - since >= rule.triggerForMs) {
          open.push({
            key,
            kind: rule.kind,
            severity: rule.severity,
            entityId: rule.entityId,
            title: rule.title,
            summary: rule.summary,
            evidence: evidenceFrom(state.evidence),
            triggerSourceIds: uniqueSourceIds(state.triggerEvidence),
          });
          this.triggerSince.delete(key);
        }
        continue;
      }

      this.triggerSince.delete(key);
      if (!activeIncident || !state.clear) {
        this.clearSince.delete(key);
        continue;
      }
      const since = this.clearSince.get(key) ?? evaluatedAt;
      this.clearSince.set(key, since);
      if (evaluatedAt - since >= rule.clearForMs) {
        resolve.push(activeIncident);
        this.clearSince.delete(key);
      }
    }

    const staleProperties = snapshot.properties.filter(
      (property) => property.quality === "STALE",
    );
    const staleKey = `SENSOR_STALE:${snapshot.storeId}`;
    const activeStaleIncident = activeByKey.get(staleKey);
    if (staleProperties.length > 0 && !activeStaleIncident) {
      open.push({
        key: staleKey,
        kind: "SENSOR_STALE",
        severity: "MEDIUM",
        entityId: snapshot.storeId,
        title: "Store telemetry is stale",
        summary:
          "One or more authoritative sensor properties stopped updating within their configured freshness window.",
        evidence: evidenceFrom(staleProperties.slice(0, 20)),
        triggerSourceIds: uniqueSourceIds(staleProperties),
      });
    } else if (staleProperties.length === 0 && activeStaleIncident) {
      resolve.push(activeStaleIncident);
    }

    return { open, resolve };
  }

  reset(): void {
    this.triggerSince.clear();
    this.clearSince.clear();
  }

  resetForSource(snapshot: TwinSnapshot, sourceId: string): void {
    const properties = new Map(
      snapshot.properties.map((property) => [propertyKey(property.entityId, property.property), property]),
    );
    for (const rule of this.rules) {
      const state = rule.evaluate(properties);
      const key = `${rule.kind}:${rule.entityId}`;
      const resetTriggers = state.triggerEvidence.some(
        (property) => property.sourceId === sourceId,
      );
      const otherTriggers = state.triggerEvidence.some(
        (property) => property.sourceId !== sourceId,
      );
      if (resetTriggers && (rule.triggerMode === "ALL" || !otherTriggers)) {
        this.triggerSince.delete(key);
      }
      if (state.clearEvidence.some((property) => property.sourceId === sourceId)) {
        this.clearSince.delete(key);
      }
    }
  }

  isIncidentConditionActive(snapshot: TwinSnapshot, incident: IncidentRecord): boolean {
    if (incident.kind === "SENSOR_STALE") {
      return snapshot.properties.some((property) => property.quality === "STALE");
    }
    const rule = this.rules.find(
      (candidate) =>
        candidate.kind === incident.kind && candidate.entityId === incident.entityId,
    );
    if (!rule) return true;
    const properties = new Map(
      snapshot.properties.map((property) => [propertyKey(property.entityId, property.property), property]),
    );
    return rule.evaluate(properties).active;
  }

  currentTriggerSourceIds(snapshot: TwinSnapshot, incident: IncidentRecord): string[] {
    if (incident.kind === "SENSOR_STALE") {
      return uniqueSourceIds(
        snapshot.properties.filter((property) => property.quality === "STALE"),
      );
    }
    const rule = this.rules.find(
      (candidate) =>
        candidate.kind === incident.kind && candidate.entityId === incident.entityId,
    );
    if (!rule) return [];
    const properties = new Map(
      snapshot.properties.map((property) => [propertyKey(property.entityId, property.property), property]),
    );
    const state = rule.evaluate(properties);
    return state.active ? uniqueSourceIds(state.triggerEvidence) : [];
  }
}

function uniqueSourceIds(properties: readonly TwinPropertyState[]): string[] {
  return [...new Set(properties.map((property) => property.sourceId))];
}

function defaultRules(): IncidentRule[] {
  return [
    {
      kind: "COLD_CHAIN_RISK",
      severity: "HIGH",
      entityId: "cooler-dairy-01",
      title: "Dairy cold-chain exposure",
      summary: "The dairy cooler has remained above its safe operating temperature.",
      triggerForMs: 5_000,
      clearForMs: 6_000,
      triggerMode: "ALL",
      evaluate: (properties) => {
        const temperature = properties.get(propertyKey("cooler-dairy-01", "thermal.airTemperatureC"));
        const door = properties.get(propertyKey("cooler-dairy-01", "access.doorOpen"));
        const value = asNumber(temperature);
        return {
          active: value != null && temperature?.quality === "GOOD" && value > 5,
          clear: value != null && isGood(temperature) && value <= 4,
          evidence: [temperature, door].filter((item): item is TwinPropertyState => Boolean(item)),
          triggerEvidence: [temperature].filter((item): item is TwinPropertyState => Boolean(item)),
          clearEvidence: [temperature].filter((item): item is TwinPropertyState => Boolean(item)),
          clockEvidence: [temperature].filter((item): item is TwinPropertyState => Boolean(item)),
        };
      },
    },
    {
      kind: "SHELF_GAP",
      severity: "MEDIUM",
      entityId: "shelf-produce-01",
      title: "Produce shelf gap",
      summary: "The produce island is below its on-shelf availability target.",
      triggerForMs: 3_000,
      clearForMs: 4_000,
      triggerMode: "ALL",
      evaluate: (properties) => {
        const fill = properties.get(propertyKey("shelf-produce-01", "inventory.fillRatio"));
        const backroom = properties.get(propertyKey("shelf-produce-01", "inventory.backroomUnits"));
        const value = asNumber(fill);
        return {
          active: value != null && fill?.quality === "GOOD" && value < 0.2,
          clear: value != null && isGood(fill) && value >= 0.55,
          evidence: [fill, backroom].filter((item): item is TwinPropertyState => Boolean(item)),
          triggerEvidence: [fill].filter((item): item is TwinPropertyState => Boolean(item)),
          clearEvidence: [fill].filter((item): item is TwinPropertyState => Boolean(item)),
          clockEvidence: [fill].filter((item): item is TwinPropertyState => Boolean(item)),
        };
      },
    },
    {
      kind: "QUEUE_PRESSURE",
      severity: "MEDIUM",
      entityId: "checkout-cluster-01",
      title: "Checkout queue pressure",
      summary: "Checkout demand is exceeding the currently open lane capacity.",
      triggerForMs: 4_000,
      clearForMs: 4_000,
      triggerMode: "ANY",
      evaluate: (properties) => {
        const length = properties.get(propertyKey("checkout-cluster-01", "queue.length"));
        const wait = properties.get(propertyKey("checkout-cluster-01", "queue.waitSeconds"));
        const lanes = properties.get(propertyKey("checkout-cluster-01", "operations.lanesOpen"));
        const queueLength = asNumber(length);
        const waitSeconds = asNumber(wait);
        const lengthBreached = isGood(length) && queueLength != null && queueLength >= 8;
        const waitBreached = isGood(wait) && waitSeconds != null && waitSeconds > 150;
        return {
          active: lengthBreached || waitBreached,
          clear:
            isGood(length) && isGood(wait) &&
            (queueLength ?? Infinity) < 5 && (waitSeconds ?? Infinity) < 90,
          evidence: [length, wait, lanes].filter((item): item is TwinPropertyState => Boolean(item)),
          triggerEvidence: [
            lengthBreached ? length : undefined,
            waitBreached ? wait : undefined,
          ].filter((item): item is TwinPropertyState => Boolean(item)),
          clearEvidence: [length, wait].filter((item): item is TwinPropertyState => Boolean(item)),
          clockEvidence: [length, wait].filter((item): item is TwinPropertyState => Boolean(item)),
        };
      },
    },
    {
      kind: "ACCESSIBILITY_BLOCKED",
      severity: "HIGH",
      entityId: "aisle-03",
      title: "Accessible aisle blocked",
      summary: "The measured clear route through aisle 3 is below the accessibility envelope.",
      triggerForMs: 2_000,
      clearForMs: 3_000,
      triggerMode: "ALL",
      evaluate: (properties) => {
        const clearance = properties.get(propertyKey("aisle-03", "accessibility.clearanceM"));
        const available = properties.get(propertyKey("aisle-03", "accessibility.routeAvailable"));
        const value = asNumber(clearance);
        return {
          active: value != null && isGood(clearance) && value < 0.9,
          clear: value != null && isGood(clearance) && value >= 1.2,
          evidence: [clearance, available].filter((item): item is TwinPropertyState => Boolean(item)),
          triggerEvidence: [clearance].filter((item): item is TwinPropertyState => Boolean(item)),
          clearEvidence: [clearance].filter((item): item is TwinPropertyState => Boolean(item)),
          clockEvidence: [clearance].filter((item): item is TwinPropertyState => Boolean(item)),
        };
      },
    },
    {
      kind: "ENERGY_ANOMALY",
      severity: "LOW",
      entityId: "energy-panel-01",
      title: "Store energy anomaly",
      summary: "Electrical demand is materially above the occupancy-adjusted baseline.",
      triggerForMs: 10_000,
      clearForMs: 8_000,
      triggerMode: "ALL",
      evaluate: (properties) => {
        const total = properties.get(propertyKey("energy-panel-01", "electrical.totalKw"));
        const baseline = properties.get(propertyKey("energy-panel-01", "electrical.baselineKw"));
        const totalKw = asNumber(total);
        const baselineKw = asNumber(baseline);
        return {
          active:
            totalKw != null && baselineKw != null &&
            isGood(total) && isGood(baseline) &&
            totalKw > baselineKw * 1.35,
          clear:
            totalKw != null && baselineKw != null &&
            isGood(total) && isGood(baseline) &&
            totalKw <= baselineKw * 1.15,
          evidence: [total, baseline].filter((item): item is TwinPropertyState => Boolean(item)),
          triggerEvidence: [total, baseline].filter((item): item is TwinPropertyState => Boolean(item)),
          clearEvidence: [total, baseline].filter((item): item is TwinPropertyState => Boolean(item)),
          clockEvidence: [total, baseline].filter((item): item is TwinPropertyState => Boolean(item)),
        };
      },
    },
  ];
}
