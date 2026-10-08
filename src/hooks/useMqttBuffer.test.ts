import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMqttBuffer } from "./useMqttBuffer";
import { DEFAULT_OUTPUTS, parsePLCPayload } from "../services/plcService";

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("MQTT history availability", () => {
  it("does not turn placeholders, nonfinite values or default outputs into samples", () => {
    const { result } = renderHook(() => useMqttBuffer());
    act(() => result.current.push([
      { id: "voltage", label: "Voltage", kind: "analog", value: 0, placeholder: true, status: "normal", accentHex: "#43d8f1" },
      { id: "current", label: "Current", kind: "analog", value: Number.NaN, status: "normal", accentHex: "#43d8f1" },
      { id: "photoE", label: "Photo-E", kind: "digital", active: false, placeholder: true, status: "normal", accentHex: "#43d8f1" },
    ], { ...DEFAULT_OUTPUTS }));
    for (const id of ["voltage", "current", "motor", "photoE_sensor", "metal_sensor", "push_button", "relay_ch0", "alert_0"]) {
      expect(result.current.getHistory(id, 1000)).toEqual([]);
    }
  });

  it("preserves real zero and OFF inputs rather than treating them as missing", () => {
    const { result } = renderHook(() => useMqttBuffer());
    act(() => result.current.push([
      { id: "voltage", label: "Voltage", kind: "analog", value: 0, status: "normal", accentHex: "#43d8f1" },
      { id: "photoE", label: "Photo-E", kind: "digital", active: false, status: "normal", accentHex: "#43d8f1" },
    ], { ...DEFAULT_OUTPUTS }));
    expect(result.current.getHistory("voltage", 1000)[0].value).toBe(0);
    expect(result.current.getHistory("photoE_sensor", 1000)[0].value).toBe(0);
    expect(result.current.getHistory("motor", 1000)).toEqual([]);
  });

  it("keeps channel receipt timestamps when unrelated partial frames arrive", () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const { result } = renderHook(() => useMqttBuffer());
    const voltage = { id: "voltage", label: "Voltage", kind: "analog" as const, value: 4.3, status: "normal" as const, accentHex: "#43d8f1", receivedAt: 99_000 };
    act(() => result.current.push([voltage], DEFAULT_OUTPUTS, 100_000));
    vi.setSystemTime(105_000);
    act(() => result.current.push([
      voltage,
      { id: "current", label: "Current", kind: "analog", value: 4.1, status: "normal", accentHex: "#43d8f1", receivedAt: 105_000 },
    ], DEFAULT_OUTPUTS, 105_000));
    expect(result.current.getHistory("voltage", 60_000)).toEqual([{ timestamp: 99_000, value: 4.3 }]);
    expect(result.current.getHistory("current", 60_000)).toEqual([{ timestamp: 105_000, value: 4.1 }]);
  });

  it("records genuinely new receipts even when a sensor value is unchanged", () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const { result } = renderHook(() => useMqttBuffer());
    const voltage = { id: "voltage", label: "Voltage", kind: "analog" as const, value: 4.3, status: "normal" as const, accentHex: "#43d8f1" };
    act(() => result.current.push([voltage], DEFAULT_OUTPUTS, 99_000));
    act(() => result.current.push([voltage], DEFAULT_OUTPUTS, 100_000));
    expect(result.current.getHistory("voltage", 60_000)).toEqual([
      { timestamp: 99_000, value: 4.3 }, { timestamp: 100_000, value: 4.3 },
    ]);
    expect(result.current.getBufferSize()).toBe(2);
  });

  it("does not evict a channel's samples through unrelated or empty updates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const { result } = renderHook(() => useMqttBuffer());
    act(() => result.current.push([
      { id: "voltage", label: "Voltage", kind: "analog", value: 0, status: "normal", accentHex: "#43d8f1", receivedAt: 99_000 },
    ], DEFAULT_OUTPUTS));
    act(() => {
      for (let i = 0; i < 650; i++) {
        result.current.push([], DEFAULT_OUTPUTS);
        result.current.push([
          { id: "current", label: "Current", kind: "analog", value: 1, status: "normal", accentHex: "#43d8f1", receivedAt: 99_100 + i },
        ], DEFAULT_OUTPUTS);
      }
    });
    expect(result.current.getHistory("voltage", 60_000)).toEqual([{ timestamp: 99_000, value: 0 }]);
    expect(result.current.getHistory("current", 60_000)).toHaveLength(600);
  });

  it("never lets an older retained reading replace a newer receipt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const { result } = renderHook(() => useMqttBuffer());
    const voltage = { id: "voltage", label: "Voltage", kind: "analog" as const, value: 4.3, status: "normal" as const, accentHex: "#43d8f1", receivedAt: 100_000 };
    act(() => result.current.push([voltage], DEFAULT_OUTPUTS));
    act(() => result.current.push([{ ...voltage, value: 3.1, receivedAt: 98_000 }], DEFAULT_OUTPUTS));
    expect(result.current.getHistory("voltage", 60_000)).toEqual([{ timestamp: 100_000, value: 4.3 }]);
  });

  it("does not promote aggregate relay availability or default output bits into history", () => {
    const { result } = renderHook(() => useMqttBuffer());
    act(() => result.current.push([
      { id: "relay", label: "Relay", kind: "relay", active: true, status: "normal", accentHex: "#43d8f1" },
    ], DEFAULT_OUTPUTS));
    for (const id of ["motor", "relay_ch0", "relay_ch7", "alert_0", "alert_3", "push_button"]) {
      expect(result.current.getHistory(id, 60_000)).toEqual([]);
    }
  });

  it("records only explicitly received output bits and does not refresh them through other frames", () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const { result } = renderHook(() => useMqttBuffer());
    const first = parsePLCPayload({ boardA_relay_motor: 0 }, null, { keyReceivedAt: { boardA_relay_motor: 99_000 } });
    act(() => result.current.push(first.params, first.outputs, 100_000));
    const second = parsePLCPayload({ boardA_alert_relays_red: 1 }, first, { keyReceivedAt: { boardA_alert_relays_red: 100_000 } });
    act(() => result.current.push(second.params, second.outputs, 100_000));
    expect(result.current.getHistory("motor", 60_000)).toEqual([{ timestamp: 99_000, value: 0 }]);
    expect(result.current.getHistory("relay_ch0", 60_000)).toEqual([{ timestamp: 99_000, value: 0 }]);
    expect(result.current.getHistory("relay_ch2", 60_000)).toEqual([{ timestamp: 100_000, value: 1 }]);
    expect(result.current.getHistory("alert_0", 60_000)).toEqual([{ timestamp: 100_000, value: 1 }]);
    for (const id of ["relay_ch1", "relay_ch3", "relay_ch4", "relay_ch5", "relay_ch6", "relay_ch7", "alert_1", "alert_2", "alert_3"]) {
      expect(result.current.getHistory(id, 60_000)).toEqual([]);
    }
    vi.setSystemTime(101_000);
    const third = parsePLCPayload({ boardA_relay_motor: 0, boardA_green_push_button: 0 }, second, {
      keyReceivedAt: { boardA_relay_motor: 101_000, boardA_green_push_button: 101_000 },
    });
    act(() => result.current.push(third.params, third.outputs, 101_000));
    expect(result.current.getHistory("motor", 60_000)).toEqual([{ timestamp: 99_000, value: 0 }, { timestamp: 101_000, value: 0 }]);
    expect(result.current.getHistory("push_button", 60_000)).toEqual([{ timestamp: 101_000, value: 0 }]);
    expect(result.current.getHistory("relay_ch6", 60_000)).toEqual([{ timestamp: 101_000, value: 0 }]);
    expect(result.current.getHistory("alert_0", 60_000)).toEqual([{ timestamp: 100_000, value: 1 }]);
  });
});
