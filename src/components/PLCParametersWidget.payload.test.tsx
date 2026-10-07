import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MosquittoPLCService, PLC_DATA_TOPIC, type RawPLCPayload } from "../services/plcService";
import { usePLCStore } from "../stores/plcStore";
import PLCParametersWidget from "./PLCParametersWidget";
import ClassicPLCParametersWidget from "../legacy/components/PLCParametersWidget";

const { sendCommand } = vi.hoisted(() => ({ sendCommand: vi.fn() }));
vi.mock("../context/PLCContext", () => ({
  usePLCContext: () => ({ isConnected: true, error: null, sendCommand }),
}));

// The transport boundary is the only data-path mock: messages still go through
// the real service, parser, raw meter subscription, Zustand store and widgets.
class FixtureSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static latest: FixtureSocket;
  readyState = FixtureSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  constructor() { FixtureSocket.latest = this; }
  send(value: string) { this.sent.push(value); }
  close() { this.readyState = FixtureSocket.CLOSED; }
  receive(payload: RawPLCPayload) {
    this.onmessage?.({ data: JSON.stringify({ topic: PLC_DATA_TOPIC, payload }) } as MessageEvent);
  }
}

const referencePayload: RawPLCPayload = {
  boardA_voltage_pot_1: 4.31,
  boardA_current_pot: 4.01,
  boardA_ph_sensor: 9.4,
  boardA_pressure_sensor: 1085, // 12-bit ADC → 53.0 bar
  boardA_metaloxide_sensor: 100,
  boardA_turbidity_sensor: 26.4,
  boardA_light_sensor: 936,
  boardA_orp_sensor: 204,
  boardA_photoelectric_sensor: 0,
  boardA_metal_sensor: 0,
  boardA_relay_motor: 0,
  boardA_relay_alarm: 0,
  boardA_alert_relays_red: 0,
  boardA_alert_relays_yellow: 0,
  boardA_alert_relays_green: 1,
  boardA_alert_relays_buzzer: 0,
  boardA_rfid_authorized_user: 0,
  boardB_shellypro3em_data_a_voltage: 0,
  boardB_shellypro3em_data_b_voltage: 0,
  boardB_shellypro3em_data_c_voltage: 230.2,
  boardB_shellypro3em_data_c_current: 0.08,
  boardB_shellypro3em_data_total_act_power: -0.2,
  boardB_shellypro3em_data_total_current: 0.08,
};

let unsubscribe: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FixtureSocket);
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  sendCommand.mockReset();
  usePLCStore.setState({ params: [], rfidAuthorized: false, rfidOverride: null, motorFanOn: false, emergencyLightOn: false, relays: [], alerts: [] });
  const service = new MosquittoPLCService("ws://fixture.invalid/ws");
  unsubscribe = service.subscribe(({ params, outputs }) => usePLCStore.getState().updateFromPLC(params, outputs));
});

afterEach(() => {
  cleanup();
  unsubscribe?.();
  vi.advanceTimersByTime(1000);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function receive(payload: RawPLCPayload) {
  act(() => {
    FixtureSocket.latest.receive(payload);
    vi.advanceTimersByTime(20);
  });
}

function analogChannel(label: string) {
  const card = within(screen.getByLabelText("Supported analog channels")).getByText(label).closest(".pi-reading");
  if (!(card instanceof HTMLElement)) throw new Error(`Missing analog channel: ${label}`);
  return within(card);
}

describe("PLC telemetry payload parity", () => {
  it("preserves the same parsed readings when moving from New UI to Classic UI without sending commands", () => {
    receive(referencePayload);
    const modern = render(<PLCParametersWidget />);
    expect(analogChannel("Voltage").getByText("4.31")).toBeTruthy();
    expect(analogChannel("Pressure").getByText("53.0")).toBeTruthy();
    const receivedParams = usePLCStore.getState().params;
    modern.unmount();
    render(<ClassicPLCParametersWidget />);
    for (const value of ["4.31", "4.01", "9.4", "53.0", "100.0", "26.4", "936", "204"]) {
      expect(screen.getByText(value)).toBeTruthy();
    }
    expect(usePLCStore.getState().params).toBe(receivedParams);
    expect(sendCommand).not.toHaveBeenCalled();
    expect(FixtureSocket.latest.sent).toEqual([]);
  });

  it("renders the reference analog, relay, digital and three-phase readings from a real-shaped frame", () => {
    render(<PLCParametersWidget />);
    receive(referencePayload);

    for (const [label, value, nominal] of [
      ["Voltage", "4.31", "5 nom"], ["Current", "4.01", "6 nom"],
      ["pH", "9.4", "7 nom"], ["Pressure", "53.0", "65 nom"],
      ["MQ gas", "100.0", "30 nom"], ["Turbidity", "26.4", "15 nom"],
      ["Light", "936", "500 nom"], ["ORP", "204", "200 nom"],
    ]) {
      const card = analogChannel(label);
      expect(card.getByText(value)).toBeTruthy();
      expect(card.getByText(nominal)).toBeTruthy();
      expect(card.getByText("Normal")).toBeTruthy();
    }
    expect(screen.getByText("8 / 8 received")).toBeTruthy();
    expect(screen.getByText("3 / 3 received")).toBeTruthy();
    expect(screen.getByText("Healthy")).toBeTruthy();
    expect(screen.getByText("8-channel relay · RS485")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: "Toggle Photo-E" })).getByText("OFF")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: "Toggle Metal Det." })).getByText("OFF")).toBeTruthy();
    const meter = within(screen.getByRole("button", { name: "View three-phase motor details" }));
    expect(meter.getByText("Running")).toBeTruthy();
    expect(meter.getByText("-0.2")).toBeTruthy();
    expect(meter.getAllByText("0.08")).toHaveLength(2);
    expect(screen.getByText("Locked · Awaiting badge")).toBeTruthy();
    expect(usePLCStore.getState().motorFanOn).toBe(false);
    expect(usePLCStore.getState().emergencyLightOn).toBe(false);
    expect(FixtureSocket.latest.sent).toEqual([]);
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it("keeps missing channels unknown and retains received readings across partial frames", () => {
    render(<PLCParametersWidget />);
    receive({ boardA_voltage_pot_1: 4.31 });
    receive({ boardA_current_pot: 4.01 });
    expect(screen.getByText("2 / 8 received")).toBeTruthy();
    expect(screen.getByText("0 / 3 received")).toBeTruthy();
    expect(screen.getByText("No data")).toBeTruthy();
    expect(screen.queryByText("Healthy")).toBeNull();
    expect(within(screen.getByLabelText("Supported digital channels")).queryByText("OFF")).toBeNull();

    receive(referencePayload);
    receive({ boardA_voltage_pot_1: 4.32 });
    expect(analogChannel("Voltage").getByText("4.32")).toBeTruthy();
    expect(analogChannel("Current").getByText("4.01")).toBeTruthy();
    expect(analogChannel("Pressure").getByText("53.0")).toBeTruthy();
    expect(screen.getByText("8 / 8 received")).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.getByText("Healthy")).toBeTruthy();

    receive({ boardA_relay_motor: 1, boardA_relay_alarm: 1, boardA_rfid_authorized_user: 1 });
    expect(screen.getByText("Alarm")).toBeTruthy();
    expect(screen.getByText("Badge authorized")).toBeTruthy();
    expect(usePLCStore.getState().motorFanOn).toBe(true);
    expect(usePLCStore.getState().emergencyLightOn).toBe(true);
    expect(FixtureSocket.latest.sent).toEqual([]);
  });

  it("does not refresh a silent meter when another board keeps publishing", () => {
    render(<PLCParametersWidget />);
    receive(referencePayload);
    const meter = within(screen.getByRole("button", { name: "View three-phase motor details" }));
    expect(meter.getByText("Running")).toBeTruthy();
    act(() => vi.advanceTimersByTime(16_000));
    receive({ boardA_voltage_pot_1: 4.4 });
    expect(meter.getByText("Last received")).toBeTruthy();
    expect(meter.getByText("-0.2")).toBeTruthy();
    expect(meter.queryByText("Running")).toBeNull();
    receive(referencePayload);
    expect(meter.getByText("Running")).toBeTruthy();
    expect(sendCommand).not.toHaveBeenCalled();
  });
});
