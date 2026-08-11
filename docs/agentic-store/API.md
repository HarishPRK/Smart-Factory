# Agentic Store local API

Base URL: `http://127.0.0.1:3001/api/agentic-store`

The API is local-development only in this iteration. All payloads use the
shared types and Zod schemas in `packages/agentic-store-contracts`.

Loopback browser origins are allowed by default. Remote binds are refused.
When
`AGENTIC_STORE_API_TOKEN` is configured, every non-read request requires
`Authorization: Bearer <token>`.

## Read and stream

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/health` | Runtime, simulator, sequence, projection, incident, and AI-provider health |
| `GET` | `/bootstrap` | Manifest, snapshot, workflows, capabilities, simulator state, and stream cursor |
| `GET` | `/snapshot` | Current semantic twin projection |
| `GET` | `/stream?after=<sequence>` | Ordered SSE catch-up followed by live events |
| `GET` | `/events?after=&limit=&types=&entityId=&from=&to=` | Paged event replay |
| `GET` | `/history?entityId=&property=&from=&to=&limit=` | Property history; defaults to the hour ending at that property's latest sample |
| `GET` | `/incidents` | Incident records, newest first |
| `GET` | `/decisions?limit=` | Agent decisions, newest first |
| `GET` | `/tasks` | Current operations tasks |
| `GET` | `/activities?limit=` | Recent public agent activity phases for hydration |
| `GET` | `/simulator` | Simulator status |
| `GET` | `/scenarios` | Scenarios actually supported by this runtime |

The SSE event name is `store.event`; `data` is a JSON `StoreEventEnvelope`.
Each message has a monotonically increasing `id`. Reconnect with the browser's
`Last-Event-ID` header or `?after=<lastSequence>`. Heartbeats are SSE comments
and do not change state.

Catch-up is capped at 5,000 events and 32 concurrent streams. An older/larger
cursor, or one ahead of the current local log, receives `409` and must reload
bootstrap. Slow clients are disconnected and resume from the last event ID
rather than growing server buffers.

Bootstrap also contains recent public agent activities, telemetry-source
statuses, supported scenarios, `mutationAuthRequired`, and the exact stream URL
already positioned at its consistency cursor.

## Sensor ingestion

`POST /ingest` accepts a validated `ObservationBatch` and returns HTTP `202`
with accepted/rejected counts, unknown or stale tags, and the projection
version. This endpoint never accepts raw commands or arbitrary MQTT topics.

```json
{
  "schemaVersion": "1.0",
  "storeId": "store-001",
  "sourceId": "plc:store-001",
  "sourceSessionId": "gateway-boot-2026-08-10T16:00:00Z",
  "sequence": 42,
  "sampledAt": "2026-08-10T16:01:20.000Z",
  "readings": [
    { "tag": "DB_RETAIL.DAIRY_TEMP_DECI_C", "value": 37, "quality": "GOOD" }
  ]
}
```

The source/tag must exist in the configured binding file. See
`docs/agentic-store/plc-bindings.example.json`. Within a source session,
sequences must increase and retries are idempotent.

## Simulation and scenarios

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/simulator/control` | `{ "action": "START" | "PAUSE" | "RESET", "speed"?: 0.25..20 }` |
| `POST` | `/scenarios/:scenarioId/start` | `{ "durationSeconds"?: 5..3600 }` |
| `POST` | `/scenarios/stop` | none |

Clients must use bootstrap capabilities or `GET /scenarios`; they must not
assume simulation is enabled or hard-code outcomes.

`RESET` pauses the simulator, starts a new simulator source session, and emits
an immediate clean baseline and presence frame. Active incidents whose causal
trigger measurements came from the simulator are re-evaluated against that
baseline; when the triggering condition no longer holds, they are closed
without verification, unfinished decisions become `SUPERSEDED`, and open tasks
are cancelled.
PLC-triggered incidents are not cleared merely because they also contain a
simulator-owned contextual measurement.

## Incidents, approvals, and the store agent

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/incidents/:incidentId/acknowledge` | `{ "actorId": "...", "note"?: "..." }` |
| `POST` | `/decisions/:decisionId/approve` | `{ "actorId": "...", "note"?: "..." }` |
| `POST` | `/decisions/:decisionId/reject` | `{ "actorId": "...", "note"?: "..." }` |
| `POST` | `/agent/question` | `{ "question": "...", "entityIds"?: ["..."] }` |

Approval is guarded by decision state. Re-reviewing a decision that no longer
waits for approval returns HTTP `409`. Unknown workflow IDs return `404`.
Validation failures return `400` with stable `error`, `message`, and `issues`
fields. The question API returns evidence references and a provider identity;
it never returns hidden reasoning or chain-of-thought.
