import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePLCStore } from "../stores/plcStore";
import EmergencyLightWidget from "./EmergencyLightWidget";
import MotorFanWidget from "./MotorFanWidget";

const { sendCommand } = vi.hoisted(() => ({
  sendCommand: vi.fn(),
}));

vi.mock("../context/PLCContext", () => ({
  usePLCContext: () => ({
    isConnected: true,
    error: null,
    sendCommand,
  }),
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

class MockAudioContext {
  currentTime = 0;
  destination = {};

  createOscillator() {
    return {
      type: "sine",
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  createGain() {
    return {
      gain: { value: 0, setTargetAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }

  createWaveShaper() {
    return {
      curve: null,
      oversample: "none",
      connect: vi.fn(),
    };
  }

  close = vi.fn();
}

const gradient = { addColorStop: vi.fn() };
const canvasContext = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  stroke: vi.fn(),
  createRadialGradient: vi.fn(() => gradient),
  fillRect: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  quadraticCurveTo: vi.fn(),
  save: vi.fn(),
  clip: vi.fn(),
  createLinearGradient: vi.fn(() => gradient),
  restore: vi.fn(),
  ellipse: vi.fn(),
  strokeStyle: "",
  fillStyle: "",
  lineWidth: 0,
};

beforeEach(() => {
  vi.useFakeTimers();
  sendCommand.mockReset();
  vi.stubGlobal("AudioContext", MockAudioContext);
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    canvasContext as never,
  );
  usePLCStore.setState({
    motorFanOn: false,
    emergencyLightOn: false,
    rfidAuthorized: false,
    relays: [false, false, false, false, false, false, false, false],
  });
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("dashboard PLC control widgets", () => {
  it("allows motor start and emergency activation without an RFID badge", () => {
    sendCommand.mockReturnValue(new Promise<void>(() => undefined));
    render(
      <>
        <MotorFanWidget />
        <EmergencyLightWidget />
      </>,
    );

    const motor = screen.getByRole("button", { name: "Start motor fan" });
    const emergency = screen.getByRole("button", {
      name: "Activate emergency beacon",
    });
    expect((motor as HTMLButtonElement).disabled).toBe(false);
    expect((emergency as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(motor);
    fireEvent.click(emergency);

    expect(sendCommand).toHaveBeenCalledWith("motor_fan", {
      _topic: "plc/control",
      _rawPayload: { boardA_relay_motor: 1 },
    });
    expect(sendCommand).toHaveBeenCalledWith("emergency_light", {
      _topic: "plc/control",
      _rawPayload: { boardA_relay_alarm: 1 },
    });
  });

  it("always permits fail-safe motor stop and alarm clear after badge expiry", () => {
    sendCommand.mockReturnValue(new Promise<void>(() => undefined));
    usePLCStore.setState({
      motorFanOn: true,
      emergencyLightOn: true,
      rfidAuthorized: false,
      relays: [true, true, false, false, false, false, false, false],
    });
    render(
      <>
        <MotorFanWidget />
        <EmergencyLightWidget />
      </>,
    );

    const motor = screen.getByRole("button", { name: "Stop motor fan" });
    const emergency = screen.getByRole("button", {
      name: "Clear emergency beacon",
    });
    expect((motor as HTMLButtonElement).disabled).toBe(false);
    expect((emergency as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(motor);
    fireEvent.click(emergency);

    expect(sendCommand).toHaveBeenCalledWith("motor_fan", {
      _topic: "plc/control",
      _rawPayload: { boardA_relay_motor: 0 },
    });
    expect(sendCommand).toHaveBeenCalledWith("emergency_light", {
      _topic: "plc/control",
      _rawPayload: { boardA_relay_alarm: 0 },
    });
  });

  it("exposes motor state, sends the exact command, disables while pending, and restores on error", async () => {
    const command = deferred<void>();
    sendCommand.mockReturnValueOnce(command.promise);
    render(<MotorFanWidget />);

    const control = screen.getByRole("button", { name: "Start motor fan" });
    expect(control.tagName).toBe("BUTTON");
    expect(control.getAttribute("type")).toBe("button");
    expect(control.getAttribute("aria-pressed")).toBe("false");
    expect(control.getAttribute("aria-busy")).toBe("false");
    expect((control as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(control);

    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(sendCommand).toHaveBeenCalledWith("motor_fan", {
      _topic: "plc/control",
      _rawPayload: { boardA_relay_motor: 1 },
    });
    expect(control.getAttribute("aria-label")).toBe(
      "Waiting for motor fan confirmation",
    );
    expect(control.getAttribute("aria-pressed")).toBe("true");
    expect(control.getAttribute("aria-busy")).toBe("true");
    expect((control as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      command.reject(new Error("PLC publish denied"));
      await Promise.resolve();
    });

    expect(control.getAttribute("aria-label")).toBe("Start motor fan");
    expect(control.getAttribute("aria-pressed")).toBe("false");
    expect(control.getAttribute("aria-busy")).toBe("false");
    expect((control as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("status").textContent).toContain("Retry");
    expect(screen.getByRole("alert").textContent).toContain(
      "Motor command failed: PLC publish denied",
    );
    expect(control.getAttribute("title")).toContain("Press again to retry");
  });

  it("keeps motor state pending until matching PLC telemetry confirms it", async () => {
    sendCommand.mockResolvedValueOnce(undefined);
    render(<MotorFanWidget />);

    const control = screen.getByRole("button", { name: "Start motor fan" });
    fireEvent.click(control);
    await act(async () => {
      await Promise.resolve();
    });

    expect(control.getAttribute("aria-label")).toBe(
      "Waiting for motor fan confirmation",
    );
    expect(control.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("Starting");

    act(() => {
      usePLCStore.setState({ motorFanOn: true });
    });
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(control.getAttribute("aria-label")).toBe("Stop motor fan");
    expect(control.getAttribute("aria-busy")).toBe("false");
    expect(screen.getByRole("status").textContent).toContain("Running");
  });

  it("recovers from a confirmation timeout when late motor telemetry arrives", async () => {
    sendCommand.mockResolvedValueOnce(undefined);
    render(<MotorFanWidget />);

    const control = screen.getByRole("button", { name: "Start motor fan" });
    fireEvent.click(control);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(control.getAttribute("aria-busy")).toBe("false");
    expect(screen.getByRole("status").textContent).toContain(
      "Standby · Retry start",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "PLC confirmation was not received",
    );

    act(() => {
      usePLCStore.setState({ motorFanOn: true });
    });
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(control.getAttribute("aria-label")).toBe("Stop motor fan");
    expect(screen.getByRole("status").textContent).toContain("Running");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("exposes emergency state, sends the exact command, disables while pending, and restores on error", async () => {
    const command = deferred<void>();
    sendCommand.mockReturnValueOnce(command.promise);
    render(<EmergencyLightWidget />);

    const control = screen.getByRole("button", {
      name: "Activate emergency beacon",
    });
    expect(control.tagName).toBe("BUTTON");
    expect(control.getAttribute("type")).toBe("button");
    expect(control.getAttribute("aria-pressed")).toBe("false");
    expect(control.getAttribute("aria-busy")).toBe("false");
    expect((control as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(control);

    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(sendCommand).toHaveBeenCalledWith("emergency_light", {
      _topic: "plc/control",
      _rawPayload: { boardA_relay_alarm: 1 },
    });
    expect(control.getAttribute("aria-label")).toBe(
      "Waiting for emergency beacon confirmation",
    );
    expect(control.getAttribute("aria-pressed")).toBe("true");
    expect(control.getAttribute("aria-busy")).toBe("true");
    expect((control as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      command.reject(new Error("PLC publish denied"));
      await Promise.resolve();
    });

    expect(control.getAttribute("aria-label")).toBe(
      "Activate emergency beacon",
    );
    expect(control.getAttribute("aria-pressed")).toBe("false");
    expect(control.getAttribute("aria-busy")).toBe("false");
    expect((control as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("status").textContent).toContain("Retry");
    expect(screen.getByRole("alert").textContent).toContain(
      "Emergency command failed: PLC publish denied",
    );
    expect(control.getAttribute("title")).toContain("Press again to retry");
  });

  it("keeps emergency state pending until matching PLC telemetry confirms it", async () => {
    sendCommand.mockResolvedValueOnce(undefined);
    render(<EmergencyLightWidget />);

    const control = screen.getByRole("button", {
      name: "Activate emergency beacon",
    });
    fireEvent.click(control);
    await act(async () => {
      await Promise.resolve();
    });

    expect(control.getAttribute("aria-label")).toBe(
      "Waiting for emergency beacon confirmation",
    );
    expect(control.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("Activating");

    act(() => {
      usePLCStore.setState({ emergencyLightOn: true });
    });
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(control.getAttribute("aria-label")).toBe(
      "Waiting for emergency beacon confirmation",
    );
    expect(control.getAttribute("aria-busy")).toBe("true");

    act(() => {
      usePLCStore.setState({
        relays: [false, true, false, false, false, false, false, false],
      });
    });
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(control.getAttribute("aria-label")).toBe(
      "Clear emergency beacon",
    );
    expect(control.getAttribute("aria-busy")).toBe("false");
    expect(screen.getByRole("status").textContent).toContain("Active");
  });
});
