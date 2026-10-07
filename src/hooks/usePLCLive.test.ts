import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OUTPUTS, IoTCorePLCService, MosquittoPLCService, type PLCService, type PLCState } from "../services/plcService";
import { usePLCLive } from "./usePLCLive";

afterEach(cleanup);

describe("usePLCLive initial telemetry", () => {
  it("stays empty until a service delivers a sample, including across remounts", () => {
    let publish: ((state: PLCState) => void) | undefined;
    const unsubscribe = vi.fn();
    const service: PLCService = {
      subscribe: (listener) => { publish = listener; return unsubscribe; },
      sendCommand: vi.fn(),
      fetchCurrentState: vi.fn(),
    };
    const hook = renderHook(() => usePLCLive(service));
    expect(hook.result.current.params).toEqual([]);
    expect(hook.result.current.isConnected).toBe(false);

    act(() => publish?.({ params: [{ id: "voltage", label: "Voltage", kind: "analog", value: 4.31, status: "normal", accentHex: "#43d8f1" }], outputs: { ...DEFAULT_OUTPUTS } }));
    expect(hook.result.current.params[0].value).toBe(4.31);
    expect(hook.result.current.isConnected).toBe(true);
    hook.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();

    const remount = renderHook(() => usePLCLive(service));
    expect(remount.result.current.params).toEqual([]);
    expect(remount.result.current.isConnected).toBe(false);
  });

  it("returns no demo samples from hardware services before receiving telemetry", async () => {
    // Fetching these local snapshots does not connect to either transport.
    const bridge = new MosquittoPLCService("ws://fixture.invalid/ws");
    const iot = new IoTCorePLCService("fixture.invalid", "test-pool", "us-east-1", "");
    expect((await bridge.fetchCurrentState()).params).toEqual([]);
    expect((await iot.fetchCurrentState()).params).toEqual([]);
  });
});
