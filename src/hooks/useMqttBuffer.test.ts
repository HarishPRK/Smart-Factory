import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useMqttBuffer } from "./useMqttBuffer";
import { DEFAULT_OUTPUTS } from "../services/plcService";

afterEach(cleanup);

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
});
