import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PLCParameter } from "../types";
import ParameterMicroviz from "./ParameterMicroviz";

const base: PLCParameter = { id: "voltage", label: "Voltage", kind: "analog", value: 6, unit: "V", min: 0, max: 12, nominal: 5, accentHex: "#43d8f1", status: "normal" };
afterEach(cleanup);

describe("ParameterMicroviz configured-range instruments", () => {
  it.each(["voltage", "current", "ph", "forming_pressure", "curing_mq", "mixing_turbidity", "forming_light", "mixing_orp"])("shows only the empty instrument face for unavailable %s", (id) => {
    const { container } = render(<ParameterMicroviz param={{ ...base, id, placeholder: true }} />);
    expect(screen.getByRole("img", { name: "Voltage: awaiting PLC reading" })).toBeTruthy();
    expect(container.querySelectorAll("[data-sample]")).toHaveLength(0);
    expect(container.querySelectorAll(".pmv-track").length).toBeGreaterThan(0);
  });

  it("plots a negative ORP sample to the left of its actual zero reference", () => {
    const { container } = render(<ParameterMicroviz param={{ ...base, id: "mixing_orp", label: "ORP", value: -200, min: -500, max: 500, nominal: 200, unit: "mV" }} />);
    expect(screen.getByRole("img", { name: "ORP range position: 30% of -500–500 mV" })).toBeTruthy();
    expect(container.querySelector('[data-reference="zero"]')?.getAttribute("x1")).toBe("32");
    expect(container.querySelector('[data-sample="position"]')?.getAttribute("cx")).toBe("22.4");
    expect(container.querySelector('[data-sample="level"]')?.getAttribute("x1")).toBe("32");
  });

  it.each([{ value: -900, percent: 0, x: "8" }, { value: 900, percent: 100, x: "56" }])("clamps an out-of-range sample $value to the instrument boundary", ({ value, percent, x }) => {
    const { container } = render(<ParameterMicroviz param={{ ...base, id: "mixing_orp", value, min: -500, max: 500 }} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain(`${percent}%`);
    expect(container.querySelector('[data-sample="position"]')?.getAttribute("cx")).toBe(x);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it.each([
    { value: Number.NaN }, { value: Number.POSITIVE_INFINITY }, { value: undefined },
    { min: undefined }, { max: undefined }, { min: Number.NEGATIVE_INFINITY }, { max: Number.POSITIVE_INFINITY }, { min: 12, max: 12 },
    { min: 13, max: 12 }, { min: -Number.MAX_VALUE, max: Number.MAX_VALUE },
  ])("does not plot a nonfinite or uncalibrated reading %j", (invalid) => {
    const { container } = render(<ParameterMicroviz param={{ ...base, ...invalid }} />);
    expect(screen.getByRole("img", { name: "Voltage: awaiting PLC reading" })).toBeTruthy();
    expect(container.querySelectorAll("[data-sample]")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it("updates the instrument from the latest received value without inventing history", () => {
    const { container, rerender } = render(<ParameterMicroviz param={{ ...base, id: "ph", label: "pH", value: 7, min: 0, max: 14, unit: "" }} />);
    expect(container.querySelector('[data-sample="position"]')?.getAttribute("d")).toBe("M29 9l3 4 3-4z");
    rerender(<ParameterMicroviz param={{ ...base, id: "ph", label: "pH", value: 10.5, min: 0, max: 14, unit: "" }} />);
    expect(screen.getByRole("img", { name: "pH range position: 75% of 0–14" })).toBeTruthy();
    expect(container.querySelectorAll("[data-sample]")).toHaveLength(1);
    expect(container.querySelector('[data-sample="position"]')?.getAttribute("d")).toBe("M41 9l3 4 3-4z");
  });
});
