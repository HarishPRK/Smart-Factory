# Agentic Store local development

## Prerequisites

- Node.js 22 or newer
- npm
- No AWS account, credentials, broker, or cloud database

Install dependencies from the repository root:

```powershell
npm install
```

## Start the backend

The Agentic Store runs as a backend-only local service and defaults to a SQLite database under `.local-data` with the simulator enabled.

```powershell
npm run dev:agentic-store
```

The API is mounted under `http://127.0.0.1:3001/api/agentic-store`. Confirm startup with:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/agentic-store/health
```

The frontend should load the bootstrap resource under that prefix, use the stream URL returned by bootstrap, and treat the shared TypeScript contracts as authoritative. Endpoint suffixes for commands and reviews should be taken from the implemented HTTP routes rather than duplicated in client constants.

## Configuration

All settings are optional for local development.

| Variable | Default | Meaning |
| --- | --- | --- |
| `AGENTIC_STORE_ID` | `store-001` | Store identity used across manifest, events, and observations |
| `AGENTIC_STORE_DB_PATH` | `.local-data/agentic-store.sqlite` | Local SQLite file relative to the repository root |
| `AGENTIC_STORE_SIMULATION` | `true` | Enables the built-in store simulator |
| `AGENTIC_STORE_SIMULATION_TICK_MS` | `250` | Shopper-presence cadence; semantic observations remain at 1 Hz |
| `AGENTIC_STORE_HISTORY_RETENTION_HOURS` | `72` | Retention window for high-volume property history |
| `AGENTIC_STORE_EVENT_RETENTION_HOURS` | `24` | Ordered SSE replay window; expired cursors must reload bootstrap |
| `AGENTIC_STORE_PRESENCE_RETENTION_MINUTES` | `5` | Short replay window for larger shopper-presence frames |
| `AGENTIC_STORE_BINDINGS_PATH` | unset | Optional validated JSON file mapping PLC/gateway tags to semantic twin properties |
| `LOCAL_AI_BASE_URL` | unset | Optional OpenAI-compatible local endpoint |
| `LOCAL_AI_MODEL` | unset | Model name sent to that endpoint |
| `LOCAL_AI_API_KEY` | unset | Optional key for a protected local endpoint |
| `LOCAL_AI_ALLOW_REMOTE` | `false` | Allows a non-loopback model URL only when explicitly set to `true` |
| `AGENTIC_STORE_API_TOKEN` | unset | Optional bearer token required by every mutating endpoint |
| `AGENTIC_STORE_ALLOWED_ORIGINS` | loopback origins | Comma-separated exact browser origins allowed by CORS |

Example local-model configuration for an OpenAI-compatible server:

```powershell
$env:LOCAL_AI_BASE_URL = "http://127.0.0.1:11434/v1"
$env:LOCAL_AI_MODEL = "your-local-model"
npm run dev:agentic-store
```

The model is optional. Without it, deterministic evidence-based decisions and summaries remain available. If a configured local model is unavailable or produces invalid output, the backend falls back rather than interrupting store operations.

## Live data flow

The local simulator emits the same `ObservationBatch` contract expected from a future PLC adapter. Its source identity is `simulator:<storeId>`, and its tags are mapped through the store catalog's `SensorBinding` records.

Accelerated scenarios advance simulator sample time faster than wall time.
History defaults are therefore anchored to the property's latest sample, while
retention and freshness use server receipt time. Incident hysteresis follows
virtual sample time for simulator-only evidence, while PLC and mixed-source
rules follow server receipt time.

For a real data source, implement a transport adapter that:

1. Reads PLC, OPC UA, MQTT, IoT-rule, or gateway messages.
2. Converts them into a validated `ObservationBatch`.
3. Uses a stable `sourceId`, a new `sourceSessionId` after reconnect/restart, and increasing `sequence` values within that session.
4. Supplies source-specific sensor bindings to semantic entity properties.
5. Sends the batch through the same ingestion service used by simulation.

The runtime gives an external mapping authority over its semantic property and
removes the simulator mapping for that property. Duplicate owners fail startup
validation. This prevents lively simulated values from overwriting real PLC
measurements while allowing both sources to populate different parts of one
store twin.

Do not add PLC tags to frontend code. The UI reads semantic properties from the manifest and applies normalized twin patches.

To inspect the near-real-time stream during development, first obtain its URL from bootstrap. The SSE response contains ordered event IDs and periodic heartbeats; closing and reconnecting with the last event ID should replay anything missed.

## Checks

Run the backend-only checks while iterating:

```powershell
npm run typecheck:agentic-store
npm run lint:agentic-store
npm run test:agentic-store
```

Before handing a change off, also run the repository build to make sure shared contract changes did not break the existing application:

```powershell
npm run build
```

Tests use deterministic behavior or a fully mocked local-model response plus
local/in-memory persistence. They must not contact AWS or a model endpoint.

## Useful implementation locations

- `packages/agentic-store-contracts/src/index.ts`: shared data and event types
- `packages/agentic-store-contracts/src/schemas.ts`: request validation schemas
- `server/agentic-store/domain/store-catalog.ts`: manifest and sensor bindings
- `server/agentic-store/application/observation-service.ts`: normalization and twin updates
- `server/agentic-store/application/incident-service.ts`: incident lifecycle
- `server/agentic-store/application/agent-orchestrator.ts`: decisions, approvals, actions, verification
- `server/agentic-store/simulation/store-simulator.ts`: realistic local observations and scenarios
- `server/agentic-store/infrastructure/sqlite-store.ts`: events, projections, history, and workflow persistence

## Local safety boundary

The local server is intended for development and demonstrations. Before exposing it outside a trusted development machine, add authentication, store-scoped authorization, rate limits, TLS, secrets management, ingestion identity, request size limits, and audit retention. Never route a simulator action port directly to physical equipment.

The standalone server refuses non-loopback binds and browser CORS is limited
to loopback origins. When `AGENTIC_STORE_API_TOKEN` is configured, clients send
it as `Authorization: Bearer ...` for mutations. Remote exposure is deliberately
unsupported until a real identity/TLS gateway exists. Graceful shutdown closes
active SSE responses before disposing the runtime, so an attached UI does not
delay normal local termination.

When a real command adapter is introduced, require an explicit per-action allowlist, idempotency keys, device acknowledgements, timeouts, interlocks, and operator approval for consequential actions.
