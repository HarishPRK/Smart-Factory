# Aituzero Form 2S meter twin

The Digital Manufacturing dashboard launches this same-origin widget from the meter button in its header. It is also available at `/widgets/aituzero-meter/`. The widget has its own Vite root so its meter UI styles do not affect the factory dashboard. `npm run build` builds the widget into `public/widgets/aituzero-meter/` before building the host application; `npm run build:meter` rebuilds only the widget.

The initial deployment runs a **simulation**. Voltage, current, power factor, import/export energy, pulse rate, temperature and fault alarms are computed in the browser. Its readings are illustrative and are not connected to a physical meter. Use `npm run test:meter` for the meter physics and transport checks.

## Connecting a real gateway

Set these variables **at build time** for the widget build:

```env
VITE_METER_TRANSPORT=websocket
VITE_METER_URL=wss://your-gateway.example.com/meters/aituzero-2s
```

For an MQTT-over-WebSocket broker, use `VITE_METER_TRANSPORT=mqtt` and set `VITE_METER_TOPIC=meters/aituzero-2s/telemetry`. The browser cannot speak raw MQTT/TCP. If the gateway uses DLMS/COSEM, Modbus or another field protocol, translate it at the trusted edge into the canonical JSON packet below; the browser should never receive meter or broker secrets. Prefer a same-origin authenticated gateway endpoint or short-lived credentials. A page served over HTTPS requires `wss://`.

```json
{
  "timestamp": 1780000000000,
  "voltage": 240.1,
  "current": 41.9,
  "powerFactor": 0.96,
  "activePower": 9657,
  "reactivePower": 2817,
  "frequency": 60.0,
  "importKwh": 12847.386,
  "exportKwh": 0,
  "temperature": 32.4,
  "pulseCount": 386,
  "reverseEnergy": false,
  "alarms": []
}
```

`activePower` and `reactivePower` are signed W and VAR respectively (negative means export). Energy registers are nonnegative and monotonic kWh. The packet timestamp is Unix epoch **milliseconds**. `pulseCount` is a monotonic impulse counter; `alarms` may contain `sag`, `surge`, `overcurrent`, `reversePolarity`, and `tamper`. `src/meter/physics.ts` validates bounds, freshness and consistency before a packet reaches the store; `src/meter/transport.ts` owns reconnection and stale-data detection. A gateway should publish at a regular interval under ten seconds. In live mode, the virtual fault and load controls are simulation-only and should not be wired to physical controls.

To preview locally, run `npm run build:meter` and `npm run dev` from the repository root. Open the factory dashboard and use its meter button, or visit `/widgets/aituzero-meter/` directly.
