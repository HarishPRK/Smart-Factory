import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MosquittoPLCService, parsePLCPayload, PLC_DATA_TOPIC, subscribeRawPLCPayload, type PLCState, type RawPLCReceipt } from "./plcService";

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.OPEN;
  sent: string[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string | URL) {
    this.url = String(url);
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  receive(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => "command-request-id"),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("parsePLCPayload operator precision", () => {
  it("preserves voltage and current precision for immediate live display", () => {
    const state = parsePLCPayload({
      boardA_voltage_pot_1: 4.31,
      boardA_current_pot: 4.114,
    });

    const voltage = state.params.find((param) => param.id === "voltage");
    const current = state.params.find((param) => param.id === "current");

    expect(voltage?.value).toBe(4.31);
    expect(voltage?.decimals).toBe(2);
    expect(current?.value).toBe(4.114);
    expect(current?.decimals).toBe(2);
  });
});

describe("parsePLCPayload fire and authentication semantics", () => {
  it.each([
    [0, "critical"], [49.9, "critical"], [50, "critical"],
    [50.1, "warning"], [59.9, "warning"], [60, "warning"],
    [60.1, "normal"], [65, "normal"], [100, "normal"],
  ] as const)("classifies scaled fire input %s as %s", (value, status) => {
    const state = parsePLCPayload({ boardB_analog_8ch_b_fire_sensor: value });
    expect(state.params.find((param) => param.id === "fire")).toMatchObject({ value, status, placeholder: false });
  });

  it.each([
    [2047.5, 50, "critical"], [2457, 60, "warning"], [2661.75, 65, "normal"],
  ] as const)("normalizes raw fire ADC %s before applying thresholds", (adc, value, status) => {
    const state = parsePLCPayload({ boardB_analog_8ch_b_fire_sensor: adc });
    expect(state.params.find((param) => param.id === "fire")).toMatchObject({ value, status, placeholder: false });
  });

  it.each([0, 1])("keeps fingerprint %s informational without setting an emergency or granting access", (value) => {
    const state = parsePLCPayload({ boardB_esp32_finger_match: value });
    for (const id of ["intake_fingerprint", "dispatch_fingerprint"]) {
      expect(state.params.find((param) => param.id === id)).toMatchObject({ value, status: "normal", placeholder: false });
    }
    expect(state.params.find((param) => param.id === "system_emergency_stop")).toMatchObject({ active: false, placeholder: true });
    expect(state.outputs.rfidAuthorized).toBe(false);
  });

  it("keeps a missing fire input unavailable instead of treating the fallback zero as a hazard", () => {
    const state = parsePLCPayload({ boardB_esp32_finger_match: 0 });
    expect(state.params.find((param) => param.id === "fire")).toMatchObject({ status: "normal", placeholder: true });
  });
});

describe("parsePLCPayload relay availability", () => {
  it("does not treat analog-only frames as relay feedback, including subsequent frames", () => {
    const first = parsePLCPayload({ boardA_voltage_pot_1: 4.31 });
    const second = parsePLCPayload({ boardA_current_pot: 4.01 }, first);
    for (const state of [first, second]) {
      expect(state.params.find((param) => param.id === "relay")?.placeholder).toBe(true);
    }
  });

  it("recognizes real OFF feedback and retains it across unrelated payloads", () => {
    const first = parsePLCPayload({ boardA_relay_motor: 0 });
    const second = parsePLCPayload({ boardA_voltage_pot_1: 4.31 }, first);
    for (const state of [first, second]) {
      expect(state.params.find((param) => param.id === "relay")?.placeholder).toBe(false);
      expect(state.outputs.motorFanOn).toBe(false);
    }
  });

  it("leaves unset relay sentinels unavailable", () => {
    const state = parsePLCPayload({ boardA_relay_motor: -1, boardA_alert_relays_green: -1 });
    expect(state.params.find((param) => param.id === "relay")?.placeholder).toBe(true);
  });
});

describe("MosquittoPLCService command publishing", () => {
  function connectedService() {
    const service = new MosquittoPLCService("ws://bridge.test/ws");
    service.subscribe(() => {});

    const socket = MockWebSocket.instances.at(-1);
    if (!socket) throw new Error("Mosquitto service did not create a WebSocket");

    return { service, socket };
  }

  it("sends the exact motor frame and resolves only for its matching positive ack", async () => {
    const { service, socket } = connectedService();
    let settled = false;

    const commandPromise = service
      .sendCommand("motor_fan", {
        _topic: "plc/control",
        _rawPayload: { boardA_relay_motor: 1 },
      })
      .then(() => {
        settled = true;
      });

    expect(socket.sent).toEqual([
      JSON.stringify({
        type: "publish",
        requestId: "command-request-id",
        topic: "plc/control",
        payload: { boardA_relay_motor: 1 },
      }),
    ]);

    await Promise.resolve();
    expect(settled).toBe(false);

    socket.receive({
      type: "publish-ack",
      requestId: "some-other-request",
      ok: true,
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    socket.receive({
      type: "publish-ack",
      requestId: "command-request-id",
      ok: true,
    });

    await expect(commandPromise).resolves.toBeUndefined();
    expect(settled).toBe(true);
  });

  it("rejects the command when the matching publish ack is negative", async () => {
    const { service, socket } = connectedService();
    const commandPromise = service.sendCommand("motor_fan", {
      _topic: "plc/control",
      _rawPayload: { boardA_relay_motor: 0 },
    });
    const rejection = expect(commandPromise).rejects.toThrow(
      "AWS IoT rejected plc/control",
    );

    socket.receive({
      type: "publish-ack",
      requestId: "command-request-id",
      ok: false,
      error: "AWS IoT rejected plc/control",
    });

    await rejection;
  });

  it("marks real transport receipts explicitly and preserves old channel time across board slices", () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const states: PLCState[] = [];
    const service = new MosquittoPLCService("ws://bridge.test/ws");
    const unsubscribe = service.subscribe((state) => states.push(state));
    const socket = MockWebSocket.instances.at(-1)!;
    socket.receive({ topic: `${PLC_DATA_TOPIC}/boardA`, payload: { boardA_voltage_pot_1: 4.31 } });
    vi.advanceTimersByTime(20);
    expect(states[0]).toMatchObject({ source: "plc", receivedAt: 100_020 });
    expect(states[0].params.find((param) => param.id === "voltage")?.receivedAt).toBe(100_000);
    vi.advanceTimersByTime(16_000);
    socket.receive({ topic: `${PLC_DATA_TOPIC}/boardB`, payload: { boardA_current_pot: 4.01 } });
    vi.advanceTimersByTime(20);
    expect(states[1].params.find((param) => param.id === "voltage")).toMatchObject({ value: 4.31, receivedAt: 100_000 });
    expect(states[1].params.find((param) => param.id === "current")).toMatchObject({ value: 4.01, receivedAt: 116_020 });
    unsubscribe();
    vi.advanceTimersByTime(1000);
  });

  it("publishes underlying raw meter receipt times without refreshing them on unrelated merged slices", () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const receipts: RawPLCReceipt[] = [];
    const rawUnsubscribe = subscribeRawPLCPayload((_payload, receipt) => { if (receipt) receipts.push(receipt); });
    const service = new MosquittoPLCService("ws://bridge.test/ws");
    const unsubscribe = service.subscribe(() => {});
    const socket = MockWebSocket.instances.at(-1)!;
    const meterKey = "boardB_shellypro3em_data_c_voltage";
    socket.receive({ topic: `${PLC_DATA_TOPIC}/boardB`, payload: { [meterKey]: 230.2 } });
    vi.advanceTimersByTime(20);
    expect(receipts[0]).toMatchObject({ source: "plc", receivedAt: 100_000, keyReceivedAt: { [meterKey]: 100_000 } });
    vi.advanceTimersByTime(16_000);
    socket.receive({ topic: `${PLC_DATA_TOPIC}/boardA`, payload: { boardA_voltage_pot_1: 4.31 } });
    vi.advanceTimersByTime(20);
    expect(receipts[1]).toMatchObject({ receivedAt: 116_020, keyReceivedAt: { [meterKey]: 100_000, boardA_voltage_pot_1: 116_020 } });
    // Listeners can keep the old metadata snapshot safely; subsequent receipts
    // cannot mutate it into an invented newer measurement.
    expect(receipts[0].keyReceivedAt.boardA_voltage_pot_1).toBeUndefined();
    socket.receive({ topic: `${PLC_DATA_TOPIC}/boardB`, payload: { [meterKey]: 231.1 } });
    expect(receipts[2].keyReceivedAt[meterKey]).toBe(116_040);
    expect(receipts[1].keyReceivedAt[meterKey]).toBe(100_000);
    rawUnsubscribe();
    unsubscribe();
    vi.advanceTimersByTime(1000);
  });
});
