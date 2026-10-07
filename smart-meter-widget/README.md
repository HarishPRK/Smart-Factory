# Aituzero Form 2S meter twin

The dashboard embeds this widget at `/widgets/aituzero-meter/`. It now defaults to live `meter/data` readings through the existing Smart Factory WebSocket bridge. Simulation is an explicit development option and never a fallback for missing or disconnected hardware.

## Data path

`AWS IoT Core → scripts/cloud-bridge.mjs → same-origin /ws → meter widget`

Endpoint: `alht1i2bx8tzt-ats.iot.us-east-1.amazonaws.com`, region `us-east-1`.
The server uses its existing AWS credential provider/instance role. The widget sends no MQTT publications or device commands and contains no AWS credentials. The bridge appends the exact `meter/data` subscription even when `CLOUD_TOPICS` is already configured. A rejected meter subscription is reported separately from existing PLC subscription readiness.

The publisher sends binary protobuf using [`proto/meter.proto`](../proto/meter.proto):

```proto
syntax = "proto3";
package metering;
message MeterData {
  double voltage = 1;
  double frequency = 2;
  double power_factor = 3;
  double current = 4;
}
```

`scripts/meter-wire.mjs` preserves the bytes in a JSON WebSocket envelope: `{ "topic": "meter/data", "encoding": "protobuf", "payload": "<base64>", "publishedAt": <epoch-ms>, "retained": false }`. The widget decodes the four little-endian double fields and maps voltage (V), frequency (Hz), power factor and current (A). Dedicated WebSocket/MQTT transports can also send raw protobuf bytes. Deploy both the bridge/helper and the widget; the previous bridge's UTF-8 conversion cannot preserve binary protobuf.

The main 3D register displays **accumulated import energy in Wh** (switching to kWh for large totals). The telemetry card and default trend display **active power in watts (W)**. This feed uses matching single-phase RMS voltage/current and power factor, so power is calculated automatically as `voltage × current × power_factor` W. Both JSON and protobuf packets use this calculation without an extra model flag. No extra protobuf field is required. A test fixture of 124.5 V, 10 A and 0.901 PF produces 1,121.745 W, displayed as **1,121.75 W**. These are test values, not a claim about current hardware readings. Voltage is never doubled or labeled as L1–L2. For a whole split-phase service, publish total measured watts or per-leg measurements through a separately agreed schema; one leg's power is not automatically the whole-service total.

Proto3 scalar fields default to zero when omitted, including a zero-byte all-default message; this schema cannot distinguish an omitted value from a measured zero. This follows the [protobuf wire format](https://protobuf.dev/programming-guides/encoding/) and [proto3 defaults](https://protobuf.dev/programming-guides/proto3/#default). If presence is needed in future, update the publisher and schema to use `optional` fields. Malformed/truncated payloads and non-finite or out-of-range measurements are rejected.

Legacy JSON bridge envelopes and raw JSON remain supported. Missing JSON fields stay `null`; a three-field JSON packet without current still cannot produce power. Energy, pulse count, temperature and alarm state remain unavailable unless explicitly reported. No values are filled from a previous packet or simulation. Thermal simulation and load/fault controls are disabled in live mode.

Other bridge topics are ignored. The current protobuf schema has no measurement timestamp, so the UI uses the bridge receive time. Untimestamped retained messages are rejected because their measurement age is unknown. For timestamped JSON, the payload timestamp takes precedence over the bridge receive time.

## Optional measurements and calculations

Camel-case and snake-case keys are accepted: `powerFactor`/`power_factor`, `activePower`/`active_power` (signed W), `reactivePower`/`reactive_power` (VAR), `importKwh`/`import_kwh`, `exportKwh`/`export_kwh`, `pulseCount`/`pulse_count`, `reverseEnergy`/`reverse_energy`. Other optional fields: `current` (RMS A), `temperature` (°C), `alarms` (array of `sag`, `surge`, `overcurrent`, `reversePolarity`, `tamper`), `timestamp` (epoch milliseconds). Values must be finite JSON numbers, not numeric strings. Power factor is a magnitude from 0 to 1 and does not establish leading/lagging phase.

For legacy JSON, reported active power always wins. Matching RMS voltage/current and power factor in the agreed meter feed calculate `V × A × PF` in watts. No `power_model` flag is required for JSON or protobuf. An explicitly different `power_model` prevents the single-phase calculation. JSON `reverse_energy: true` makes power negative for export; the four-field protobuf schema has no direction flag. No power score formula exists in this widget. Power is replaced by the latest calculated value on every valid packet and can rise or fall; watts are not added together. Accumulated usage is energy (Wh or kWh). Reported device energy registers remain separate from the calculated counter. Reactive power, pulse rates and temperatures are not inferred in live mode.

The stream reconnects with bounded exponential backoff. A socket is not labeled live until a valid meter reading arrives. After 15 seconds without a valid reading the last data is marked stale; unrelated factory packets do not keep the meter alive. Timestamped packets older than 15 seconds, more than 5 seconds in the future, duplicates and out-of-order data are rejected. The publisher should send at least once every 10 seconds. History retains up to two minutes, at most one point per second, with gaps for missing metrics and interrupted streams.

## Persistent accumulated energy and derived readings

`scripts/meter-energy.mjs` runs in the existing cloud bridge, independently of browser connections. It saves totals after each valid reading to `/opt/smart-factory/.local-data/meter-energy.json` using an atomic rename. Override with `METER_ENERGY_STATE_PATH` if needed; the service user must be able to write its parent directory. The state is tied to the configured topic. Restarts restore saved totals, but deliberately discard the previous integration anchor so downtime is never backfilled.

Energy is estimated with trapezoidal integration: `ΔWh = (previous W + current W) / 2 × Δmilliseconds / 3,600,000`. Sign-crossing intervals are split into import and export triangles. Only fresh, consecutive readings no more than 15 seconds apart contribute. Disconnects, invalid/missing power, longer gaps, retained packets and stale/replayed timestamps never invent energy. Tracking starts with the first valid packet after deployment; existing history cannot be reconstructed from this four-field feed. No extrapolation is performed between packets. Average import draw uses accumulated import Wh divided by observed hours; peak draw is the largest observed importing power.

Every accepted packet includes an `energy` summary alongside its original payload and an optional `energyError`. The UI displays the shared saved totals; it never integrates them again. Corrupt saved state is preserved and disables tracking until repaired; write failures freeze the last saved total and are shown in the UI. Upgrades and rollback leave the data file intact. Keep this file when backing up or replacing the server. These estimates are not the physical meter's lifetime or billing-certified register.

The calculated readings panel also shows apparent power `V × I` (VA), non-active power `sqrt(S² − P²)` (VA), AC cycle period `1000 / frequency` (ms), deviation from 60 Hz, observed duration and excluded gaps. Non-active power can include both reactive and distortion components, so it is not labeled reactive VAR or used to infer leading/lagging phase. See [Fluke's power definitions](https://assets.fluke.com/manuals/1735____umeng0100.pdf) and [EIA's energy units](https://www.eia.gov/energyexplained/electricity/measuring-electricity.php). Costs and emissions require additional tariff/intensity data and are not invented.

## Build and verify

```sh
npm run test:meter
npm run build:meter
```

The widget reads the repository-root environment files. Production defaults are checked into `.env.production`:

```env
VITE_METER_TRANSPORT=websocket
VITE_METER_URL=
VITE_METER_TOPIC=meter/data
```

A blank URL uses `/ws` on the page origin (automatically `wss` on HTTPS); HTTP localhost uses port 9001. Override the URL for a dedicated bridge. `IOT_METER_TOPIC` controls the server subscription; if changed, also set `VITE_METER_TOPIC` and its exact IAM resources. For a separately authenticated MQTT-over-WebSocket broker, set transport `mqtt` and its WebSocket URL. A bare AWS endpoint is not an authenticated browser MQTT connection.

Explicit simulation for local development: set `VITE_METER_TRANSPORT=simulation` in the process environment before starting Vite or building. `npm run build` builds both widget and host dashboard. Built widget assets are under `public/widgets/aituzero-meter/`.

See [AWS setup and rollout](../docs/SMART-METER-TELEMETRY.md). AWS permissions and production deployment are user-run steps for this request.
