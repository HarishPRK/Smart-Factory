import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RawPLCPayload } from "../services/plcService";
import ThreePhaseMotorWidget from "./ThreePhaseMotorWidget";

const { rawListeners } = vi.hoisted(() => ({
  rawListeners: new Set<(payload: RawPLCPayload) => void>(),
}));

vi.mock("../services/plcService", () => ({
  subscribeRawPLCPayload: (listener: (payload: RawPLCPayload) => void) => {
    rawListeners.add(listener);
    return () => rawListeners.delete(listener);
  },
}));

function publishMeter(totalPower: number, totalCurrent: number) {
  const payload = {
    boardB_shellypro3em_data_total_act_power: totalPower,
    boardB_shellypro3em_data_total_current: totalCurrent,
  } as RawPLCPayload;
  rawListeners.forEach((listener) => listener(payload));
}

beforeEach(() => {
  rawListeners.clear();
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  rawListeners.clear();
  vi.unstubAllGlobals();
});

describe("ThreePhaseMotorWidget live values", () => {
  it("renders new meter totals immediately without waiting for animation frames", () => {
    render(<ThreePhaseMotorWidget />);

    act(() => publishMeter(100, 2));
    expect(screen.getByText("100.0")).toBeTruthy();
    expect(screen.getByText("2.00")).toBeTruthy();

    act(() => publishMeter(250.5, 3.25));
    expect(screen.getByText("250.5")).toBeTruthy();
    expect(screen.getByText("3.25")).toBeTruthy();
    expect(screen.queryByText("100.0")).toBeNull();
  });
});
