import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PLCParameter } from "../types";
import { usePLCStore } from "../stores/plcStore";
import PLCParametersWidget from "./PLCParametersWidget";

vi.mock("../context/PLCContext", () => ({
  usePLCContext: () => ({
    isConnected: true,
    error: null,
    sendCommand: vi.fn(),
  }),
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
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  usePLCStore.setState({
    params: [voltageParam(1.1)],
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
});
