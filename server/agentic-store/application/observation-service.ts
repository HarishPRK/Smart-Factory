import { createHash } from "node:crypto";
import type {
  IngestResponse,
  NormalizedObservation,
  ObservationBatch,
  SensorBinding,
  StoreEventEnvelope,
  TwinPatch,
} from "../../../packages/agentic-store-contracts/src/index.js";
import { SqliteAgenticStore } from "../infrastructure/sqlite-store.js";
import { StoreEventBus } from "../infrastructure/store-event-bus.js";

export type ObservationSource = "SIMULATOR" | "PLC";

const MAX_FUTURE_CLOCK_SKEW_MS = 60_000;
const DEFAULT_MAX_SAMPLE_AGE_MS = 5 * 60_000;

export interface ObservationIngestResult extends IngestResponse {
  event?: StoreEventEnvelope<TwinPatch>;
}

type Clock = () => Date;

export class ObservationService {
  private readonly bindings = new Map<string, SensorBinding>();

  constructor(
    private readonly store: SqliteAgenticStore,
    private readonly bus: StoreEventBus,
    bindings: SensorBinding[],
    private readonly clock: Clock = () => new Date(),
  ) {
    for (const binding of bindings) {
      this.bindings.set(this.bindingKey(binding.sourceId, binding.tag), binding);
    }
  }

  ingest(batch: ObservationBatch, source: ObservationSource): ObservationIngestResult {
    const received = this.clock();
    const receivedAt = received.toISOString();
    const sampledAtMs = Date.parse(batch.sampledAt);
    if (!Number.isFinite(sampledAtMs)) {
      throw new RangeError("Observation sampledAt must be an ISO-8601 timestamp.");
    }
    if (source === "PLC" && sampledAtMs > received.getTime() + MAX_FUTURE_CLOCK_SKEW_MS) {
      throw new RangeError("Observation sampledAt is too far in the future.");
    }
    const unknownTags: string[] = [];
    const invalidTags: string[] = [];
    const candidates: NormalizedObservation[] = [];

    for (const reading of batch.readings) {
      const binding = this.bindings.get(this.bindingKey(batch.sourceId, reading.tag));
      if (!binding || binding.storeId !== batch.storeId) {
        unknownTags.push(reading.tag);
        continue;
      }
      if (
        source === "PLC" &&
        received.getTime() - sampledAtMs > (binding.maxSampleAgeMs ?? DEFAULT_MAX_SAMPLE_AGE_MS)
      ) {
        invalidTags.push(reading.tag);
        continue;
      }
      const normalizedValue = this.normalizeValue(binding, reading.value);
      if (normalizedValue === undefined) {
        invalidTags.push(reading.tag);
        continue;
      }
      const withinRange =
        typeof normalizedValue !== "number" ||
        ((binding.min == null || normalizedValue >= binding.min) &&
          (binding.max == null || normalizedValue <= binding.max));
      candidates.push({
        observationId: this.observationId(batch, reading.tag),
        storeId: batch.storeId,
        sourceId: batch.sourceId,
        sourceSessionId: batch.sourceSessionId,
        sourceSequence: batch.sequence,
        bindingId: binding.id,
        entityId: binding.entityId,
        property: binding.property,
        value: normalizedValue,
        unit: binding.unit,
        quality: withinRange ? (reading.quality ?? "GOOD") : "BAD",
        sampledAt: batch.sampledAt,
        receivedAt,
      });
    }

    let event: StoreEventEnvelope<TwinPatch> | undefined;
    let staleObservationIds: string[] = [];
    let acceptedCount = 0;
    this.store.transaction(() => {
      const fresh = this.store.selectFreshObservations(candidates);
      staleObservationIds = fresh.staleObservationIds;
      if (fresh.accepted.length === 0) return;
      event = this.store.appendEvent<TwinPatch>({
        storeId: batch.storeId,
        type: "twin.patch",
        occurredAt: batch.sampledAt,
        recordedAt: receivedAt,
        source,
        data: {
          changes: fresh.accepted.map((observation) => ({
            entityId: observation.entityId,
            property: observation.property,
            value: observation.value,
            unit: observation.unit,
            quality: observation.quality,
            sampledAt: observation.sampledAt,
            receivedAt: observation.receivedAt,
            sourceId: observation.sourceId,
          })),
        },
      });
      acceptedCount = this.store.saveObservations(fresh.accepted, event.sequence);
    });

    if (event) this.bus.publish(event);
    const staleSet = new Set(staleObservationIds);
    const staleTags = candidates
      .filter((candidate) => staleSet.has(candidate.observationId))
      .map((candidate) => {
        const binding = [...this.bindings.values()].find((item) => item.id === candidate.bindingId);
        return binding?.tag ?? candidate.property;
      });

    return {
      accepted: acceptedCount,
      rejected: unknownTags.length + invalidTags.length + staleObservationIds.length,
      unknownTags: [...new Set([...unknownTags, ...invalidTags])],
      staleTags: [...new Set(staleTags)],
      snapshotVersion: event?.sequence ?? this.store.getSnapshot(batch.storeId).version,
      event,
    };
  }

  private normalizeValue(
    binding: SensorBinding,
    value: string | number | boolean | null,
  ): string | number | boolean | null | undefined {
    if (value === null) return undefined;
    if (binding.valueType === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
      return value * (binding.scale ?? 1) + (binding.offset ?? 0);
    }
    if (binding.valueType === "boolean") {
      return typeof value === "boolean" ? value : undefined;
    }
    return typeof value === "string" ? value : undefined;
  }

  private observationId(batch: ObservationBatch, tag: string): string {
    return createHash("sha256")
      .update(`${batch.storeId}\u0000${batch.sourceId}\u0000${batch.sourceSessionId}\u0000${batch.sequence}\u0000${tag}`)
      .digest("hex");
  }

  private bindingKey(sourceId: string, tag: string): string {
    return `${sourceId}\u0000${tag}`;
  }
}
