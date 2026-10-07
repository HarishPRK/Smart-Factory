import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManufacturingStage } from "../../types/digitalTwin";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";
import { STAGE_CONFIGS } from "./digitalTwinLayout";
import SensorHUD from "./SensorHUD";

const { liveSensors } = vi.hoisted(() => ({ liveSensors: new Set<string>() }));
vi.mock("../../stores/digitalTwinSimulation", () => ({
  isSensorLive: (sensorId: string) => liveSensors.has(sensorId),
}));

function configuredStages(): ManufacturingStage[] {
  return STAGE_CONFIGS.map((config) => ({
    id: config.id,
    label: config.label,
    description: config.description,
    position: config.position,
    sensors: config.sensorConfigs.map((sensor) => ({ ...sensor, value: sensor.nominal, status: "normal", timestamp: 1 })),
    outputDevices: [],
    status: "running",
    throughput: 0,
    qualityScore: 100,
    dwellTimeSec: config.dwellTimeSec,
    thresholdEffects: config.thresholdEffects,
  }));
}

beforeEach(() => {
  liveSensors.clear();
  useSceneSelectionStore.getState().clear();
  useDigitalTwinStore.setState({ tick: 0, stages: configuredStages(), sensorHistories: { mixing_ph: [7, 7.2, 7.4] } });
});

afterEach(() => {
  cleanup();
  useDigitalTwinStore.setState({ tick: 0, stages: [], sensorHistories: {} });
  useSceneSelectionStore.getState().clear();
});

describe("Sensor monitor", () => {
  it("restores all 34 configured non-interlock sensors under the current seven stage names", () => {
    render(<SensorHUD />);
    const readings = screen.getByRole("region", { name: "Factory sensor readings" });
    expect(within(readings).getAllByRole("button")).toHaveLength(34);
    for (const name of ["Material intake", "Blow molding", "Filling", "Cooling", "Inspection", "Packaging", "Dispatch"]) {
      expect(within(readings).getByRole("heading", { name })).toBeTruthy();
    }
    expect(within(readings).queryByText("E-Stop")).toBeNull();
  });

  it("identifies each model or live reading without claiming the whole monitor is live", () => {
    liveSensors.add("mixing_ph");
    render(<SensorHUD />);
    const ph = screen.getByRole("button", { name: /Filling pH: 7.0.*Live PLC input/ });
    const orp = screen.getByRole("button", { name: /Filling ORP: 200.*Simulated value/ });
    expect(within(ph).getByText("Live")).toBeTruthy();
    expect(within(orp).getByText("Sim")).toBeTruthy();
    expect(screen.getByText(/Sim = modeled values/)).toBeTruthy();
    expect(ph.querySelector("svg path")?.getAttribute("d")).toContain("M");
  });

  it("shows unavailable readings and interlocks without substituting zero or normal", () => {
    useDigitalTwinStore.setState({ stages: [] });
    render(<SensorHUD />);
    const ph = screen.getByRole("button", { name: /Filling pH: —.*No reading.*unavailable/ });
    expect(within(ph).getByText("—")).toBeTruthy();
    expect(within(ph).queryByText("0.0")).toBeNull();
    expect(within(ph).queryByText("Sim")).toBeNull();
    expect(ph.querySelector("svg")).toBeNull();
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.queryByText("Clear")).toBeNull();
  });

  it("uses the shared selection for native row buttons and the whole-line action", () => {
    render(<SensorHUD />);
    const pressure = screen.getByRole("button", { name: /Blow molding Pressure:/ });
    fireEvent.click(pressure);
    expect(useSceneSelectionStore.getState().selectedStageId).toBe("forming");
    expect(pressure.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pressure);
    expect(useSceneSelectionStore.getState().selectedStageId).toBeNull();
    fireEvent.click(pressure);
    fireEvent.click(screen.getByRole("button", { name: "Return to whole line from sensor monitor" }));
    expect(useSceneSelectionStore.getState().selectedStageId).toBeNull();
  });

  it("refreshes mutable readings on the UI tick and presents warnings independently of source", () => {
    render(<SensorHUD />);
    act(() => {
      const state = useDigitalTwinStore.getState();
      const ph = state.stages.find((stage) => stage.id === "mixing")!.sensors.find((sensor) => sensor.sensorId === "mixing_ph")!;
      ph.value = 9.2;
      ph.status = "warning";
      useDigitalTwinStore.setState({ tick: state.tick + 1 });
    });
    const ph = screen.getByRole("button", { name: /Filling pH: 9.2.*Warning.*Simulated value/ });
    expect(within(ph).getByText("Warning")).toBeTruthy();
    expect(within(ph).getByText("Sim")).toBeTruthy();
    expect(ph.getAttribute("data-channel")).toBe("ph");
    expect(ph.getAttribute("data-state")).toBe("warning");
  });

  it("qualifies triggered process interlocks with their source and keeps them out of sensor rows", () => {
    const stage = useDigitalTwinStore.getState().stages.find((item) => item.id === "forming")!;
    stage.sensors.find((sensor) => sensor.sensorId === "forming_estop")!.status = "critical";
    render(<SensorHUD />);
    const interlocks = screen.getByText("Process interlocks").parentElement!;
    expect(within(interlocks).getByText("Triggered")).toBeTruthy();
    expect(within(interlocks).getByText("Sim")).toBeTruthy();
  });

  it("delegates closing to its host", () => {
    const close = vi.fn();
    render(<SensorHUD onClose={close} />);
    fireEvent.click(screen.getByRole("button", { name: "Close sensor monitor" }));
    expect(close).toHaveBeenCalledOnce();
  });
});
