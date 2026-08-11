import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  AGENTIC_STORE_SCHEMA_VERSION,
  type AgentDecision,
  type EventPage,
  type IncidentKind,
  type IncidentRecord,
  type JsonValue,
  type NormalizedObservation,
  type OperationsTask,
  type PropertyHistoryResponse,
  type StoreEventEnvelope,
  type StoreEventType,
  type TwinPropertyState,
  type TwinSnapshot,
} from "../../../packages/agentic-store-contracts/src/index.js";

const DATABASE_SCHEMA_VERSION = 2;
const DEFAULT_EVENT_PAGE_SIZE = 200;
const MAX_EVENT_PAGE_SIZE = 1_000;
const DEFAULT_HISTORY_LIMIT = 2_000;
const MAX_HISTORY_LIMIT = 20_000;

export interface StoreEventInput<T = JsonValue> {
  id?: string;
  storeId: string;
  type: StoreEventType;
  entityId?: string;
  correlationId?: string;
  causationId?: string;
  occurredAt?: string;
  recordedAt?: string;
  source: StoreEventEnvelope["source"];
  data: T;
}

export interface ListStoreEventsOptions {
  storeId: string;
  afterSequence?: number;
  limit?: number;
  types?: readonly StoreEventType[];
  entityId?: string;
  from?: string;
  to?: string;
}

export interface FreshObservationSelection {
  accepted: NormalizedObservation[];
  staleObservationIds: string[];
}

type IncidentStatus = IncidentRecord["status"];
type TaskStatus = OperationsTask["status"];

interface EventRow {
  sequence: number;
  id: string;
  schema_version: string;
  store_id: string;
  type: StoreEventType;
  entity_id: string | null;
  correlation_id: string | null;
  causation_id: string | null;
  occurred_at: string;
  recorded_at: string;
  source: StoreEventEnvelope["source"];
  data_json: string;
}

interface PropertyRow {
  entity_id: string;
  property: string;
  value_json: string;
  unit: string | null;
  quality: TwinPropertyState["quality"];
  sampled_at: string;
  received_at: string;
  source_id: string;
  source_session_id: string;
  source_sequence: number;
  version: number;
}

interface HistoryRow {
  sampled_at: string;
  value_json: string;
  quality: TwinPropertyState["quality"];
}

interface JsonRecordRow {
  payload_json: string;
}

/**
 * Synchronous, local-first persistence for the Agentic Store domain.
 *
 * DatabaseSync is intentional: the backend's domain loop is synchronous and a
 * single process owns this file. WAL still lets HTTP readers coexist with the
 * short write transactions used to project a telemetry batch.
 */
export class SqliteAgenticStore {
  private readonly database: DatabaseSync;
  private transactionDepth = 0;
  private savepointCounter = 0;
  private closed = false;

  constructor(readonly databasePath: string) {
    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    this.database = new DatabaseSync(databasePath);
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec("PRAGMA synchronous = NORMAL");
    if (databasePath !== ":memory:") {
      this.database.exec("PRAGMA journal_mode = WAL");
    }
    this.migrate();
  }

  transaction<T>(fn: () => T): T {
    this.assertOpen();
    const outermost = this.transactionDepth === 0;
    const savepoint = `agentic_store_${++this.savepointCounter}`;
    this.database.exec(outermost ? "BEGIN IMMEDIATE" : `SAVEPOINT ${savepoint}`);
    this.transactionDepth += 1;

    try {
      const result = fn();
      if (isPromiseLike(result)) {
        throw new TypeError("SqliteAgenticStore transactions must be synchronous");
      }
      this.database.exec(outermost ? "COMMIT" : `RELEASE SAVEPOINT ${savepoint}`);
      this.transactionDepth -= 1;
      return result;
    } catch (error) {
      this.transactionDepth -= 1;
      try {
        if (outermost) {
          this.database.exec("ROLLBACK");
        } else {
          this.database.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          this.database.exec(`RELEASE SAVEPOINT ${savepoint}`);
        }
      } catch {
        // Preserve the domain/storage error that caused the rollback.
      }
      throw error;
    }
  }

  close(): void {
    if (this.closed) return;
    if (this.transactionDepth !== 0) {
      throw new Error("Cannot close SqliteAgenticStore during a transaction");
    }
    this.database.close();
    this.closed = true;
  }

  appendEvent<T>(input: StoreEventInput<T>): StoreEventEnvelope<T> {
    this.assertOpen();
    const recordedAt = input.recordedAt ?? new Date().toISOString();
    const envelopeWithoutSequence = {
      schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
      id: input.id ?? randomUUID(),
      storeId: input.storeId,
      type: input.type,
      entityId: input.entityId,
      correlationId: input.correlationId,
      causationId: input.causationId,
      occurredAt: input.occurredAt ?? recordedAt,
      recordedAt,
      source: input.source,
      data: input.data,
    };

    const result = this.database.prepare(`
      INSERT INTO store_events (
        id, schema_version, store_id, type, entity_id, correlation_id,
        causation_id, occurred_at, recorded_at, source, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(
      envelopeWithoutSequence.id,
      envelopeWithoutSequence.schemaVersion,
      envelopeWithoutSequence.storeId,
      envelopeWithoutSequence.type,
      envelopeWithoutSequence.entityId ?? null,
      envelopeWithoutSequence.correlationId ?? null,
      envelopeWithoutSequence.causationId ?? null,
      envelopeWithoutSequence.occurredAt,
      envelopeWithoutSequence.recordedAt,
      envelopeWithoutSequence.source,
      stringifyJson(envelopeWithoutSequence.data),
    );

    if (asNumber(result.changes) === 0) {
      const existing = this.database.prepare(
        "SELECT * FROM store_events WHERE id = ?",
      ).get(envelopeWithoutSequence.id) as unknown as EventRow | undefined;
      if (!existing) {
        throw new Error(`Event ${envelopeWithoutSequence.id} conflicted but could not be loaded`);
      }
      return eventFromRow<T>(existing);
    }

    return {
      ...envelopeWithoutSequence,
      sequence: asNumber(result.lastInsertRowid),
    };
  }

  latestSequence(storeId: string): number {
    this.assertOpen();
    const row = this.database.prepare(
      "SELECT COALESCE(MAX(sequence), 0) AS sequence FROM store_events WHERE store_id = ?",
    ).get(storeId) as unknown as { sequence: number };
    return asNumber(row.sequence);
  }

  earliestSequence(storeId: string): number {
    this.assertOpen();
    const row = this.database.prepare(
      "SELECT MIN(sequence) AS sequence FROM store_events WHERE store_id = ?",
    ).get(storeId) as unknown as { sequence: number | null };
    return row.sequence == null ? 0 : asNumber(row.sequence);
  }

  listEvents(options: ListStoreEventsOptions): EventPage {
    this.assertOpen();
    const afterSequence = Math.max(0, Math.trunc(options.afterSequence ?? 0));
    const limit = boundedLimit(options.limit, DEFAULT_EVENT_PAGE_SIZE, MAX_EVENT_PAGE_SIZE);
    const where = ["store_id = ?", "sequence > ?"];
    const parameters: Array<string | number | null> = [options.storeId, afterSequence];

    if (options.types && options.types.length > 0) {
      where.push(`type IN (${options.types.map(() => "?").join(", ")})`);
      parameters.push(...options.types);
    }
    if (options.entityId) {
      where.push("entity_id = ?");
      parameters.push(options.entityId);
    }
    if (options.from) {
      where.push("occurred_at >= ?");
      parameters.push(options.from);
    }
    if (options.to) {
      where.push("occurred_at <= ?");
      parameters.push(options.to);
    }

    const rows = this.database.prepare(`
      SELECT * FROM store_events
      WHERE ${where.join(" AND ")}
      ORDER BY sequence ASC
      LIMIT ?
    `).all(...parameters, limit + 1) as unknown as EventRow[];

    const hasMore = rows.length > limit;
    const events = rows.slice(0, limit).map((row) => eventFromRow<JsonValue>(row));
    return {
      events,
      earliestSequence: this.earliestSequence(options.storeId),
      nextSequence: events.at(-1)?.sequence ?? afterSequence,
      hasMore,
    };
  }

  listRecentEvents(
    storeId: string,
    types: readonly StoreEventType[],
    limit = 100,
  ): StoreEventEnvelope[] {
    this.assertOpen();
    const bounded = boundedLimit(limit, 100, 1_000);
    const where = ["store_id = ?"];
    const parameters: Array<string | number> = [storeId];
    if (types.length > 0) {
      where.push(`type IN (${types.map(() => "?").join(", ")})`);
      parameters.push(...types);
    }
    const rows = this.database.prepare(`
      SELECT * FROM store_events
      WHERE ${where.join(" AND ")}
      ORDER BY sequence DESC
      LIMIT ?
    `).all(...parameters, bounded) as unknown as EventRow[];
    return rows.reverse().map((row) => eventFromRow<JsonValue>(row));
  }

  selectFreshObservations(observations: readonly NormalizedObservation[]): FreshObservationSelection {
    this.assertOpen();
    const accepted: NormalizedObservation[] = [];
    const staleObservationIds: string[] = [];
    const seenObservationIds = new Set<string>();
    const working = new Map<string, TwinPropertyState | undefined>();
    const findObservation = this.database.prepare(
      "SELECT 1 AS present FROM twin_property_history WHERE observation_id = ?",
    );
    const findCurrent = this.database.prepare(`
      SELECT entity_id, property, value_json, unit, quality, sampled_at,
             received_at, source_id, source_session_id, source_sequence, version
      FROM twin_properties
      WHERE store_id = ? AND entity_id = ? AND property = ?
    `);

    for (const observation of observations) {
      if (
        seenObservationIds.has(observation.observationId) ||
        findObservation.get(observation.observationId)
      ) {
        staleObservationIds.push(observation.observationId);
        continue;
      }
      seenObservationIds.add(observation.observationId);

      const key = propertyKey(observation.storeId, observation.entityId, observation.property);
      let current: TwinPropertyState | undefined;
      if (working.has(key)) {
        current = working.get(key);
      } else {
        const row = findCurrent.get(
          observation.storeId,
          observation.entityId,
          observation.property,
        ) as unknown as PropertyRow | undefined;
        current = row ? propertyFromRow(row) : undefined;
        working.set(key, current);
      }

      if (!isObservationNewer(observation, current)) {
        staleObservationIds.push(observation.observationId);
        continue;
      }

      accepted.push(observation);
      working.set(key, observationToState(observation, (current?.version ?? 0) + 1));
    }

    return { accepted, staleObservationIds };
  }

  saveObservations(observations: readonly NormalizedObservation[], version: number): number {
    this.assertOpen();
    if (!Number.isSafeInteger(version) || version < 0) {
      throw new RangeError("Twin version must be a non-negative safe integer");
    }
    if (observations.length === 0) return 0;

    return this.transaction(() => {
      const fresh = this.selectFreshObservations(observations).accepted;
      if (fresh.length === 0) return 0;

      const insertHistory = this.database.prepare(`
        INSERT INTO twin_property_history (
          observation_id, store_id, binding_id, entity_id, property, value_json,
          unit, quality, sampled_at, received_at, source_id, source_session_id,
          source_sequence, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(observation_id) DO NOTHING
      `);
      const upsertCurrent = this.database.prepare(`
        INSERT INTO twin_properties (
          store_id, entity_id, property, value_json, unit, quality, sampled_at,
          received_at, source_id, source_session_id, source_sequence, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(store_id, entity_id, property) DO UPDATE SET
          value_json = excluded.value_json,
          unit = excluded.unit,
          quality = excluded.quality,
          sampled_at = excluded.sampled_at,
          received_at = excluded.received_at,
          source_id = excluded.source_id,
          source_session_id = excluded.source_session_id,
          source_sequence = excluded.source_sequence,
          version = excluded.version
      `);
      const updateStoreVersion = this.database.prepare(`
        INSERT INTO store_versions (store_id, version)
        VALUES (?, ?)
        ON CONFLICT(store_id) DO UPDATE SET version = MAX(version, excluded.version)
      `);

      const affectedStores = new Set<string>();
      let saved = 0;
      for (const observation of fresh) {
        const inserted = insertHistory.run(
          observation.observationId,
          observation.storeId,
          observation.bindingId,
          observation.entityId,
          observation.property,
          stringifyJson(observation.value),
          observation.unit ?? null,
          observation.quality,
          observation.sampledAt,
          observation.receivedAt,
          observation.sourceId,
          observation.sourceSessionId,
          observation.sourceSequence,
          version,
        );
        if (asNumber(inserted.changes) === 0) continue;

        upsertCurrent.run(
          observation.storeId,
          observation.entityId,
          observation.property,
          stringifyJson(observation.value),
          observation.unit ?? null,
          observation.quality,
          observation.sampledAt,
          observation.receivedAt,
          observation.sourceId,
          observation.sourceSessionId,
          observation.sourceSequence,
          version,
        );
        affectedStores.add(observation.storeId);
        saved += 1;
      }
      for (const storeId of affectedStores) updateStoreVersion.run(storeId, version);
      return saved;
    });
  }

  markPropertiesStale(
    storeId: string,
    properties: readonly { entityId: string; property: string }[],
    version: number,
  ): number {
    this.assertOpen();
    if (properties.length === 0) return 0;
    return this.transaction(() => {
      const update = this.database.prepare(`
        UPDATE twin_properties
        SET quality = 'STALE', version = ?
        WHERE store_id = ? AND entity_id = ? AND property = ? AND quality <> 'STALE'
      `);
      let changed = 0;
      for (const property of properties) {
        changed += asNumber(update.run(
          version,
          storeId,
          property.entityId,
          property.property,
        ).changes);
      }
      if (changed > 0) {
        this.database.prepare(`
          INSERT INTO store_versions (store_id, version)
          VALUES (?, ?)
          ON CONFLICT(store_id) DO UPDATE SET version = MAX(version, excluded.version)
        `).run(storeId, version);
      }
      return changed;
    });
  }

  clearCurrentPropertiesBySource(storeId: string, sourceId: string): number {
    this.assertOpen();
    const result = this.database.prepare(`
      DELETE FROM twin_properties
      WHERE store_id = ? AND source_id = ?
    `).run(storeId, sourceId);
    return asNumber(result.changes);
  }

  getSnapshot(storeId: string): TwinSnapshot {
    this.assertOpen();
    const versionRow = this.database.prepare(
      "SELECT version FROM store_versions WHERE store_id = ?",
    ).get(storeId) as unknown as { version: number } | undefined;
    const rows = this.database.prepare(`
      SELECT entity_id, property, value_json, unit, quality, sampled_at,
             received_at, source_id, source_session_id, source_sequence, version
      FROM twin_properties
      WHERE store_id = ?
      ORDER BY entity_id ASC, property ASC
    `).all(storeId) as unknown as PropertyRow[];

    return {
      schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
      storeId,
      version: versionRow ? asNumber(versionRow.version) : 0,
      generatedAt: new Date().toISOString(),
      properties: rows.map(propertyFromRow),
    };
  }

  getPropertyHistory(
    storeId: string,
    entityId: string,
    property: string,
    from: string,
    to: string,
    limit = DEFAULT_HISTORY_LIMIT,
  ): PropertyHistoryResponse {
    this.assertOpen();
    const bounded = boundedLimit(limit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT);
    const rows = this.database.prepare(`
      SELECT sampled_at, value_json, quality
      FROM twin_property_history
      WHERE store_id = ? AND entity_id = ? AND property = ?
        AND sampled_at >= ? AND sampled_at <= ?
      ORDER BY sampled_at DESC, source_sequence DESC
      LIMIT ?
    `).all(storeId, entityId, property, from, to, bounded) as unknown as HistoryRow[];

    return {
      storeId,
      entityId,
      property,
      from,
      to,
      points: rows.reverse().map((row) => ({
        sampledAt: row.sampled_at,
        value: parseJson(row.value_json),
        quality: row.quality,
      })),
    };
  }

  getActiveIncident(storeId: string, kind: IncidentKind, entityId: string): IncidentRecord | undefined {
    this.assertOpen();
    const row = this.database.prepare(`
      SELECT payload_json FROM incidents
      WHERE store_id = ? AND kind = ? AND entity_id = ? AND status <> 'RESOLVED'
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(storeId, kind, entityId) as unknown as JsonRecordRow | undefined;
    return row ? parseJson<IncidentRecord>(row.payload_json) : undefined;
  }

  getIncident(id: string): IncidentRecord | undefined {
    return this.getJsonRecord<IncidentRecord>("incidents", id);
  }

  listIncidents(
    storeId: string,
    status?: IncidentStatus | readonly IncidentStatus[],
  ): IncidentRecord[] {
    this.assertOpen();
    const statuses = asFilterArray(status);
    const where = ["store_id = ?"];
    const parameters: string[] = [storeId];
    if (statuses.length > 0) {
      where.push(`status IN (${statuses.map(() => "?").join(", ")})`);
      parameters.push(...statuses);
    }
    const rows = this.database.prepare(`
      SELECT payload_json FROM incidents
      WHERE ${where.join(" AND ")}
      ORDER BY updated_at DESC, id ASC
    `).all(...parameters) as unknown as JsonRecordRow[];
    return rows.map((row) => parseJson<IncidentRecord>(row.payload_json));
  }

  upsertIncident(record: IncidentRecord): IncidentRecord {
    this.assertOpen();
    this.database.prepare(`
      INSERT INTO incidents (
        id, store_id, kind, severity, entity_id, status, opened_at, updated_at,
        resolved_at, decision_id, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        store_id = excluded.store_id,
        kind = excluded.kind,
        severity = excluded.severity,
        entity_id = excluded.entity_id,
        status = excluded.status,
        opened_at = excluded.opened_at,
        updated_at = excluded.updated_at,
        resolved_at = excluded.resolved_at,
        decision_id = excluded.decision_id,
        payload_json = excluded.payload_json
    `).run(
      record.id,
      record.storeId,
      record.kind,
      record.severity,
      record.entityId,
      record.status,
      record.openedAt,
      record.updatedAt,
      record.resolvedAt ?? null,
      record.decisionId ?? null,
      stringifyJson(record),
    );
    return record;
  }

  getDecision(id: string): AgentDecision | undefined {
    return this.getJsonRecord<AgentDecision>("decisions", id);
  }

  listDecisions(storeId: string, limit = 100): AgentDecision[] {
    this.assertOpen();
    const bounded = boundedLimit(limit, 100, 1_000);
    const rows = this.database.prepare(`
      SELECT payload_json FROM decisions
      WHERE store_id = ?
      ORDER BY updated_at DESC, id ASC
      LIMIT ?
    `).all(storeId, bounded) as unknown as JsonRecordRow[];
    return rows.map((row) => parseJson<AgentDecision>(row.payload_json));
  }

  upsertDecision(record: AgentDecision): AgentDecision {
    this.assertOpen();
    this.database.prepare(`
      INSERT INTO decisions (
        id, store_id, incident_id, status, created_at, updated_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        store_id = excluded.store_id,
        incident_id = excluded.incident_id,
        status = excluded.status,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        payload_json = excluded.payload_json
    `).run(
      record.id,
      record.storeId,
      record.incidentId,
      record.status,
      record.createdAt,
      record.updatedAt,
      stringifyJson(record),
    );
    return record;
  }

  listTasks(storeId: string, status?: TaskStatus | readonly TaskStatus[]): OperationsTask[] {
    this.assertOpen();
    const statuses = asFilterArray(status);
    const where = ["store_id = ?"];
    const parameters: string[] = [storeId];
    if (statuses.length > 0) {
      where.push(`status IN (${statuses.map(() => "?").join(", ")})`);
      parameters.push(...statuses);
    }
    const rows = this.database.prepare(`
      SELECT payload_json FROM tasks
      WHERE ${where.join(" AND ")}
      ORDER BY updated_at DESC, id ASC
    `).all(...parameters) as unknown as JsonRecordRow[];
    return rows.map((row) => parseJson<OperationsTask>(row.payload_json));
  }

  upsertTask(task: OperationsTask): OperationsTask {
    this.assertOpen();
    this.database.prepare(`
      INSERT INTO tasks (
        id, store_id, incident_id, decision_id, status, priority, target_entity_id,
        created_at, updated_at, completed_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        store_id = excluded.store_id,
        incident_id = excluded.incident_id,
        decision_id = excluded.decision_id,
        status = excluded.status,
        priority = excluded.priority,
        target_entity_id = excluded.target_entity_id,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at,
        payload_json = excluded.payload_json
    `).run(
      task.id,
      task.storeId,
      task.incidentId ?? null,
      task.decisionId ?? null,
      task.status,
      task.priority,
      task.targetEntityId,
      task.createdAt,
      task.updatedAt,
      task.completedAt ?? null,
      stringifyJson(task),
    );
    return task;
  }

  pruneHistory(beforeIso: string): number {
    this.assertOpen();
    const result = this.database.prepare(
      "DELETE FROM twin_property_history WHERE received_at < ?",
    ).run(beforeIso);
    return asNumber(result.changes);
  }

  pruneEvents(storeId: string, beforeIso: string): number {
    this.assertOpen();
    const result = this.database.prepare(
      "DELETE FROM store_events WHERE store_id = ? AND recorded_at < ?",
    ).run(storeId, beforeIso);
    return asNumber(result.changes);
  }

  pruneEventsByType(storeId: string, type: StoreEventType, beforeIso: string): number {
    this.assertOpen();
    const result = this.database.prepare(
      "DELETE FROM store_events WHERE store_id = ? AND type = ? AND recorded_at < ?",
    ).run(storeId, type, beforeIso);
    return asNumber(result.changes);
  }

  private getJsonRecord<T>(table: "incidents" | "decisions", id: string): T | undefined {
    this.assertOpen();
    const row = this.database.prepare(
      `SELECT payload_json FROM ${table} WHERE id = ?`,
    ).get(id) as unknown as JsonRecordRow | undefined;
    return row ? parseJson<T>(row.payload_json) : undefined;
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);

    const row = this.database.prepare(
      "SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations",
    ).get() as unknown as { version: number };
    const currentVersion = asNumber(row.version);
    if (currentVersion > DATABASE_SCHEMA_VERSION) {
      throw new Error(
        `Agentic Store database schema ${currentVersion} is newer than supported ${DATABASE_SCHEMA_VERSION}`,
      );
    }

    if (currentVersion < 1) {
      this.transaction(() => {
        this.database.exec(MIGRATION_001);
        this.database.prepare(
          "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
        ).run(1, new Date().toISOString());
      });
    }
    if (currentVersion < 2) {
      this.transaction(() => {
        this.database.exec(MIGRATION_002);
        this.database.prepare(
          "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
        ).run(2, new Date().toISOString());
      });
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new Error("SqliteAgenticStore is closed");
  }
}

const MIGRATION_001 = `
  CREATE TABLE store_events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    schema_version TEXT NOT NULL,
    store_id TEXT NOT NULL,
    type TEXT NOT NULL,
    entity_id TEXT,
    correlation_id TEXT,
    causation_id TEXT,
    occurred_at TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    source TEXT NOT NULL,
    data_json TEXT NOT NULL
  );
  CREATE INDEX store_events_store_sequence_idx
    ON store_events (store_id, sequence);
  CREATE INDEX store_events_store_type_sequence_idx
    ON store_events (store_id, type, sequence);
  CREATE INDEX store_events_correlation_idx
    ON store_events (correlation_id) WHERE correlation_id IS NOT NULL;

  CREATE TABLE store_versions (
    store_id TEXT PRIMARY KEY,
    version INTEGER NOT NULL
  );

  CREATE TABLE twin_properties (
    store_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    property TEXT NOT NULL,
    value_json TEXT NOT NULL,
    unit TEXT,
    quality TEXT NOT NULL,
    sampled_at TEXT NOT NULL,
    received_at TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_session_id TEXT NOT NULL,
    source_sequence INTEGER NOT NULL,
    version INTEGER NOT NULL,
    PRIMARY KEY (store_id, entity_id, property)
  ) WITHOUT ROWID;

  CREATE TABLE twin_property_history (
    observation_id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    binding_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    property TEXT NOT NULL,
    value_json TEXT NOT NULL,
    unit TEXT,
    quality TEXT NOT NULL,
    sampled_at TEXT NOT NULL,
    received_at TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_session_id TEXT NOT NULL,
    source_sequence INTEGER NOT NULL,
    version INTEGER NOT NULL
  );
  CREATE INDEX twin_history_property_time_idx
    ON twin_property_history (store_id, entity_id, property, sampled_at DESC);
  CREATE INDEX twin_history_received_idx
    ON twin_property_history (received_at);

  CREATE TABLE incidents (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    severity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    status TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT,
    decision_id TEXT,
    payload_json TEXT NOT NULL
  );
  CREATE INDEX incidents_active_idx
    ON incidents (store_id, kind, entity_id, status, updated_at DESC);
  CREATE INDEX incidents_store_updated_idx
    ON incidents (store_id, updated_at DESC);

  CREATE TABLE decisions (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    incident_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE INDEX decisions_store_updated_idx
    ON decisions (store_id, updated_at DESC);
  CREATE INDEX decisions_incident_idx
    ON decisions (incident_id, updated_at DESC);

  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    incident_id TEXT,
    decision_id TEXT,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    target_entity_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    payload_json TEXT NOT NULL
  );
  CREATE INDEX tasks_store_status_updated_idx
    ON tasks (store_id, status, updated_at DESC);
  CREATE INDEX tasks_incident_idx
    ON tasks (incident_id) WHERE incident_id IS NOT NULL;
`;

const MIGRATION_002 = `
  CREATE INDEX IF NOT EXISTS store_events_store_recorded_idx
    ON store_events (store_id, recorded_at);
  CREATE INDEX IF NOT EXISTS store_events_store_type_recorded_idx
    ON store_events (store_id, type, recorded_at);
`;

function eventFromRow<T>(row: EventRow): StoreEventEnvelope<T> {
  return {
    schemaVersion: AGENTIC_STORE_SCHEMA_VERSION,
    id: row.id,
    sequence: asNumber(row.sequence),
    storeId: row.store_id,
    type: row.type,
    ...(row.entity_id ? { entityId: row.entity_id } : {}),
    ...(row.correlation_id ? { correlationId: row.correlation_id } : {}),
    ...(row.causation_id ? { causationId: row.causation_id } : {}),
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
    source: row.source,
    data: parseJson<T>(row.data_json),
  };
}

function propertyFromRow(row: PropertyRow): TwinPropertyState {
  return {
    entityId: row.entity_id,
    property: row.property,
    value: parseJson(row.value_json),
    ...(row.unit ? { unit: row.unit } : {}),
    quality: row.quality,
    sampledAt: row.sampled_at,
    receivedAt: row.received_at,
    sourceId: row.source_id,
    sourceSessionId: row.source_session_id,
    sourceSequence: asNumber(row.source_sequence),
    version: asNumber(row.version),
  };
}

function observationToState(
  observation: NormalizedObservation,
  version: number,
): TwinPropertyState {
  return {
    entityId: observation.entityId,
    property: observation.property,
    value: observation.value,
    ...(observation.unit ? { unit: observation.unit } : {}),
    quality: observation.quality,
    sampledAt: observation.sampledAt,
    receivedAt: observation.receivedAt,
    sourceId: observation.sourceId,
    sourceSessionId: observation.sourceSessionId,
    sourceSequence: observation.sourceSequence,
    version,
  };
}

function isObservationNewer(
  observation: NormalizedObservation,
  current: TwinPropertyState | undefined,
): boolean {
  if (!current) return true;

  // A configuration change can transfer authority from the simulator to a
  // PLC source. Once the old owner's projection is explicitly stale, the new
  // configured source may replace it even if accelerated virtual time put the
  // old sample timestamp ahead of wall time.
  if (current.quality === "STALE" && observation.sourceId !== current.sourceId) {
    return true;
  }

  if (
    observation.sourceId === current.sourceId &&
    observation.sourceSessionId === current.sourceSessionId
  ) {
    return observation.sourceSequence > current.sourceSequence;
  }

  const sampledComparison = compareIso(observation.sampledAt, current.sampledAt);
  if (sampledComparison !== 0) return sampledComparison > 0;
  return compareIso(observation.receivedAt, current.receivedAt) > 0;
}

function compareIso(left: string, right: string): number {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) return leftMs - rightMs;
  return left.localeCompare(right);
}

function propertyKey(storeId: string, entityId: string, property: string): string {
  return `${storeId}\u0000${entityId}\u0000${property}`;
}

function parseJson<T = JsonValue>(raw: string): T {
  return JSON.parse(raw) as T;
}

function stringifyJson(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError("Value is not JSON serializable");
  return serialized;
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(maximum, Math.trunc(value)));
}

function asNumber(value: number | bigint): number {
  const result = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(result)) throw new RangeError("SQLite integer exceeds JavaScript safe range");
  return result;
}

function asFilterArray<T extends string>(value: T | readonly T[] | undefined): readonly T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value as T];
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}
