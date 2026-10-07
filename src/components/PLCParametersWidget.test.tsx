import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PLCParameter } from "../types";
import { usePLCStore } from "../stores/plcStore";
import PLCParametersWidget from "./PLCParametersWidget";

const { context } = vi.hoisted(() => ({
  context: { isConnected: true, error: null, sendCommand: vi.fn() },
}));

vi.mock("../context/PLCContext", () => ({
  usePLCContext: () => context,
}));

vi.mock("./ThreePhaseMotorWidget", () => ({
  default: () => <div data-testid="three-phase-motor" />,
}));

function voltageParam(value: number): PLCParameter {
  return {
    id: "voltage",
    label: "Voltage",
    kind: "analog",
    value,
    unit: "V",
    min: 0,
    max: 10,
    nominal: 5,
    decimals: 1,
    accentHex: "#60a5fa",
    status: "normal",
  };
}

beforeEach(() => {
  context.isConnected = true;
  context.sendCommand.mockReset();
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  usePLCStore.setState({
    params: [voltageParam(1.1)],
    telemetrySource: "plc", lastReceivedAt: Date.now(), receivedHistories: {},
    rfidAuthorized: false,
    rfidOverride: null,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  usePLCStore.setState({ params: [] });
});

describe("PLCParametersWidget live values", () => {
  it("shows supported channels without fabricating samples when disconnected", () => {
    context.isConnected = false;
    usePLCStore.setState({ params: [] });
    render(<PLCParametersWidget />);

    const channels = screen.getByLabelText("Supported analog channels");
    expect(within(channels).getAllByText("—")).toHaveLength(8);
    expect(within(channels).getAllByText("No reading")).toHaveLength(8);
    expect(screen.getByText("0 / 8 received")).toBeTruthy();
    expect(screen.getByText("Waiting for the controller")).toBeTruthy();
    expect(screen.getByText("Received values only · no model data")).toBeTruthy();
    expect(screen.queryByText("Latest PLC readings")).toBeNull();
    const digital = screen.getByLabelText("Supported digital channels");
    expect(within(digital).getByText("Relay")).toBeTruthy();
    expect(within(digital).getByText("Photoelectric")).toBeTruthy();
    expect(within(digital).getByText("Metal detection")).toBeTruthy();
    expect(within(digital).getAllByText("No reading")).toHaveLength(3);
    expect(within(digital).queryByText("OFF")).toBeNull();
    expect(screen.getByText("0 / 3 received")).toBeTruthy();
  });

  it("renders a new sensor sample immediately without waiting for animation frames", () => {
    render(<PLCParametersWidget />);

    const card = screen.getByText("Voltage").closest(".card-inner");
    if (!(card instanceof HTMLElement)) throw new Error("Voltage card not found");
    expect(within(card).getByText("1.1")).toBeTruthy();

    act(() => {
      usePLCStore.setState({ params: [voltageParam(4.3)] });
    });

    expect(within(card).getByText("4.3")).toBeTruthy();
    expect(within(card).queryByText("1.1")).toBeNull();
  });

  it("shows unavailable readings as a dash rather than inventing a zero", () => {
    usePLCStore.setState({ params: [{ ...voltageParam(0), value: undefined }] });
    render(<PLCParametersWidget />);
    const card = screen.getByText("Voltage").closest(".card-inner");
    if (!(card instanceof HTMLElement)) throw new Error("Voltage card not found");
    expect(within(card).getByText("No reading")).toBeTruthy();
    expect(within(card).getByText("—")).toBeTruthy();
    expect(within(card).queryByText("0.0")).toBeNull();
  });

  it("keeps the RFID simulation override out of received telemetry", () => {
    usePLCStore.setState({ params: [{ id: "operator_rfid", label: "RFID authorization", kind: "digital", active: false, placeholder: false, status: "normal", accentHex: "#43d8f1" }], rfidOverride: true });
    render(<PLCParametersWidget />);
    expect(screen.getByText("Locked · Awaiting badge")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Test gate" })).toBeNull();
    expect(screen.queryByText("Badge authorized")).toBeNull();
    expect(usePLCStore.getState().rfidOverride).toBe(true);
  });

  it("keeps absent digital readings unavailable and preserves real toggle commands", () => {
    const digital: PLCParameter = { id: "photoE", label: "Photo-E", kind: "digital", status: "normal", accentHex: "#10b981", placeholder: true };
    usePLCStore.setState({ params: [digital] });
    render(<PLCParametersWidget />);

    const unavailable = screen.getByText("Photoelectric").closest(".pi-digital");
    if (!(unavailable instanceof HTMLElement)) throw new Error("Digital channel not found");
    expect(within(unavailable).getByText("—")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Toggle Photo-E" })).toBeNull();

    act(() => usePLCStore.setState({ params: [{ ...digital, placeholder: false, active: false }] }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle Photo-E" }));
    expect(context.sendCommand).toHaveBeenCalledExactlyOnceWith("photoE", { action: "toggle" });
  });

  it("identifies retained values after the controller disconnects", () => {
    context.isConnected = false;
    render(<PLCParametersWidget />);
    expect(screen.getByText("1.1")).toBeTruthy();
    expect(screen.getByText("Last received PLC readings")).toBeTruthy();
    expect(screen.queryByText("Latest PLC readings")).toBeNull();
  });

  it("rejects simulation parameters even if a service reports connected", () => {
    usePLCStore.setState({ params: [voltageParam(5.5)], telemetrySource: "simulation", lastReceivedAt: null });
    render(<PLCParametersWidget />);
    expect(screen.queryByText("5.5")).toBeNull();
    expect(screen.getByText("0 / 8 received")).toBeTruthy();
    expect(screen.getByText("Offline")).toBeTruthy();
    expect(screen.getByText("Awaiting RFID input")).toBeTruthy();
  });

  it("marks a silent channel stale while other controller inputs stay connected", () => {
    usePLCStore.setState({ params: [{ ...voltageParam(4.3), receivedAt: Date.now() - 20_000 }], lastReceivedAt: Date.now() });
    render(<PLCParametersWidget />);
    const card = screen.getByText("Voltage").closest(".pi-reading");
    if (!(card instanceof HTMLElement)) throw new Error("Voltage card not found");
    expect(within(card).getByText("4.3")).toBeTruthy();
    expect(within(card).getByText("Last received")).toBeTruthy();
    expect(within(card).queryByText("Normal")).toBeNull();
    expect(screen.getByText("Connected")).toBeTruthy();
  });

  it("distinguishes live relay alarms from connection loss", () => {
    usePLCStore.setState({ params: [{ id: "relay", label: "Relay", kind: "relay", active: true, status: "critical", accentHex: "#ef4444", placeholder: false }] });
    render(<PLCParametersWidget />);
    const relay = screen.getByText("Relay").closest(".pi-relay");
    if (!(relay instanceof HTMLElement)) throw new Error("Relay row not found");
    expect(within(relay).getByText("Alarm")).toBeTruthy();
    expect(within(relay).queryByText("Offline")).toBeNull();
    expect(screen.getByText("Connected")).toBeTruthy();
  });
});
