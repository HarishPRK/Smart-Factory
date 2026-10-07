import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MosquittoPLCService, parsePLCPayload } from "./plcService";

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
});
