# Backend Structure

## Backend goals

- Expose narrow authenticated APIs rather than MQTT to the Quest.
- Use AWS for identity, command dispatch, status, audit, and telemetry access.
- Translate logical equipment commands to the existing `plc/control` contract
  only inside the factory edge agent.
- Make local simulation and AWS staging behave like production.
- Treat loss, duplication, delay, replay, and ambiguous acknowledgement as
  normal failure modes that must be tested.

## Target folders

```text
packages/
  control-contracts/
    openapi/
      control-api.yaml
    schemas/
      client-command-request.schema.json
      trusted-command-envelope.schema.json
      command-result.schema.json
      equipment-state.schema.json
      telemetry.schema.json
    fixtures/
      normal/
      rejected/
      faulted/
    generated/
      typescript/
      csharp/

  control-domain/
    src/
      command-state-machine.ts
      equipment-policy.ts
      reason-codes.ts
      validation.ts
      time.ts

lambda/
  command-create/
    index.ts
  command-dispatch/
    index.ts
  command-result/
    index.ts
  command-get/
    index.ts
  equipment-state/
    index.ts
  telemetry-query/
    index.ts

edge/
  command-agent/
    src/
      app.ts
      config.ts
      cloud/
        command-transport.ts
        aws-iot-commands.ts
      local/
        mqtt-client.ts
        plc-control-adapter.ts
        plc-state-source.ts
      domain/
        equipment-registry.ts
        safety-validator.ts
        command-executor.ts
        plc-confirmation.ts
      persistence/
        command-journal.ts
        sqlite-command-journal.ts
      observability/
        logger.ts
        metrics.ts

  motor-simulator/
    src/
      app.ts
      motor-model.ts
      local-mqtt.ts
      scenario-runner.ts
      fault-injection.ts
    scenarios/
      normal-start-stop.json
      guard-open.json
      estop-active.json
      stale-telemetry.json
      vfd-fault.json
      lost-ack.json
      duplicate-command.json
      reconnect.json

infra/
  cdk/
    bin/
      smart-factory-control.ts
    lib/
      auth-stack.ts
      control-plane-stack.ts
      telemetry-stack.ts
      observability-stack.ts
    config/
      dev.ts
      staging.ts
      production.ts
```

## Public API

```text
POST /v1/equipment/{equipmentId}/commands
GET  /v1/commands/{commandId}
GET  /v1/equipment/{equipmentId}/state
GET  /v1/equipment/{equipmentId}/telemetry
GET  /v1/equipment/{equipmentId}/telemetry/history
```

The Quest request is deliberately small:

```json
{
  "action": "START",
  "idempotencyKey": "client-generated-uuid",
  "expectedState": "STOPPED"
}
```

The Quest cannot supply:

- MQTT topics
- raw payload fields
- actor identity
- issued or expiry timestamps
- AWS thing ID
- command execution status

The backend creates the trusted envelope:

```json
{
  "schemaVersion": "1.0",
  "commandId": "server-generated-uuid",
  "equipmentId": "MOTOR-01",
  "siteId": "MCKINNEY",
  "action": "START",
  "actorSub": "cognito-sub",
  "issuedAt": "2026-07-28T20:15:00Z",
  "expiresAt": "2026-07-28T20:15:05Z",
  "expectedState": "STOPPED"
}
```

The edge repeats all validation that matters locally. Cloud validation is not
a substitute for PLC interlocks.

## Command lifecycle

```text
REQUESTED
   |
   v
DISPATCHED
   |
   +----> REJECTED
   v
ACCEPTED
   |
   v
EXECUTING
   |
   +----> FAILED
   +----> TIMED_OUT
   v
SUCCEEDED
```

Rules:

- State transitions are append-only events.
- A publish acknowledgement can advance to `DISPATCHED`, never `SUCCEEDED`.
- `SUCCEEDED` requires fresh PLC telemetry or a firmware acknowledgement.
- `TIMED_OUT` means unconfirmed; it does not prove that physical state did not
  change.
- Duplicate commands return the existing command instead of executing again.

## AWS control plane

### Identity and API

- Cognito User Pool with authorization-code flow and PKCE.
- API Gateway HTTP API with JWT authorizer.
- Route scopes:
  - `telemetry:read`
  - `motor:stop`
  - `motor:start`
  - `equipment:configure`
  - `audit:read`
- Lambda also checks site and equipment assignment.
- Quest receives access tokens, never AWS IoT publish credentials.

### Command transport

Use an interface:

```ts
interface CommandTransport {
  dispatch(command: TrustedCommandEnvelope): Promise<DispatchReceipt>;
  getStatus(commandId: string): Promise<CommandExecutionStatus>;
}
```

Implementations:

- `SimulatorCommandTransport` for local and automated tests.
- `VersionedMqttCommandTransport` for an early AWS staging spike if needed.
- `AwsIotCommandsTransport` for production.

AWS IoT Device Management Commands supplies execution IDs, timeouts, and device
reported status. The payload still carries `expiresAt`, and the edge rejects an
expired command even if AWS delivers it after reconnect.

### Storage and audit

Use DynamoDB tables for:

- Command current state and idempotency.
- Append-only command events.
- Equipment registry: site, edge thing, capability, and `controlEnabled`.

Use conditional writes to create commands. Stream state transitions to an audit
archive. Never log access tokens, secrets, certificates, or raw authorization
headers.

### Observability

Structured fields:

```text
commandId equipmentId siteId actorSub traceId state reasonCode latencyMs
```

Metrics and alarms:

- edge offline
- telemetry stale
- command rejected
- command failed
- command timed out
- acknowledgement latency
- dispatcher DLQ depth
- unexpected local topic or payload rejection

## Factory edge agent

The edge agent is the only component that knows this mapping:

```json
{
  "MOTOR-01": {
    "localTopic": "plc/control",
    "startPayload": { "boardA_relay_motor": 1 },
    "stopPayload": { "boardA_relay_motor": 0 },
    "reportedStateField": "boardA_relay_motor"
  }
}
```

This registry is administrator-controlled configuration, not client input.

Execution sequence:

1. Receive one trusted AWS command for the registered edge thing.
2. Validate schema, equipment, action, expiry, deduplication, and current state.
3. Check remote enable, telemetry freshness, E-stop/guard state, and PLC/VFD
   faults.
4. Persist the command before local publication.
5. Publish the allowlisted payload to local `plc/control`.
6. Wait for PLC confirmation.
7. Publish `SUCCEEDED`, `REJECTED`, `FAILED`, or `TIMED_OUT`.
8. Retain the result in the local journal for deduplication and recovery.

Use an X.509 IoT Thing certificate with least-privilege subscribe/receive and
publish policies. Do not use developer IAM access keys on the production edge.

QoS 1 may duplicate delivery, so idempotency is mandatory. Do not retain
commands. Do not configure an offline session that can replay `START`.

## Telemetry path

Keep live telemetry and actuation separate:

- Explicitly allowlist the board telemetry topics mirrored to AWS.
- Remove broad production mirroring of `plc/#`.
- Never mirror local `plc/control` as telemetry.
- Continue using SiteWise for historical telemetry.
- Expose live state through an authenticated API/WebSocket instead of the
  current arbitrary browser MQTT bridge.

For phase one, the edge can correlate a command with the next fresh
`boardA_relay_motor` value. The production goal should be a PLC acknowledgement
that includes `commandId`; until firmware supports that, allow only one in-flight
command per equipment item and record that confirmation is state-correlated.

## Simulator contract

The simulator must:

- subscribe to `plc/control`
- publish the same board-specific telemetry shape as the PLC
- model stopped, starting, running, stopping, and faulted states
- simulate E-stop, open guard, VFD fault, stale telemetry, delay, duplication,
  lost acknowledgement, and reconnect
- work with local Mosquitto
- optionally register as a staging AWS IoT Thing

The simulator is not a visual mock. It is the first reference implementation of
the command contract and must participate in automated end-to-end tests.

## Existing code disposition

Reuse or refactor:

- `scripts/edge-republish.mjs` for temporary telemetry uplink only.
- `scripts/sitewise-ingest.mjs` for telemetry-to-property mapping.
- `lambda/sitewise-query/index.mjs` for SiteWise query logic after adding auth,
  pagination, and equipment scoping.
- `src/services/plcService.ts` parsing and fixtures, not its generic command API.
- `server/pathControlSource.ts` as a reference for correlation and acknowledgement.
- `server/` for local development and simulator APIs.

Replace or retire for production control:

- persistent shadow toggle in `lambda/plc-command/index.mjs`
- browser-to-MQTT publication in `scripts/cloud-bridge.mjs`
- browser-to-MQTT publication in `scripts/mqtt-bridge.mjs`
- direct `plc/cmd`, `_topic`, and `_rawPayload` client paths
- optimistic state changes in `MotorFanWidget`
- control use of dynamically attached browser IoT policies
- manually managed Lambda ZIP artifacts

## Backend implementation order

1. Contracts, state machine, reason codes, and fixtures.
2. Motor simulator and local MQTT integration tests.
3. Cognito plus authenticated read-only staging APIs.
4. Command API, idempotency, audit, and simulator transport.
5. AWS IoT Commands transport against the staging simulator.
6. Factory edge agent with dry-run publication disabled.
7. Read local interlocks and confirm reported state.
8. Supervised operational `STOP`.
9. Supervised `START` after controls/safety sign-off.
10. Failure testing and production feature enablement.
