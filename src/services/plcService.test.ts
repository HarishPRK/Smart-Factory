import { describe, expect, it } from "vitest";
import { parsePLCPayload } from "./plcService";

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
