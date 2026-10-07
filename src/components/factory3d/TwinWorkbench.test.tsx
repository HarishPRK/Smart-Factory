import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import TwinWorkbench from "./TwinWorkbench";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";
import { useSceneSettingsStore } from "../../stores/sceneSettingsStore";
import type { ManufacturingStage } from "../../types/digitalTwin";
import { usePLCStore } from "../../stores/plcStore";
import { resetCameraView, setCameraTarget } from "./CameraController";

vi.mock("./CameraController", () => ({ resetCameraView: vi.fn(), setCameraTarget: vi.fn() }));
vi.mock("../../stores/digitalTwinSimulation", () => ({ DT_SCENARIOS: [], runDigitalTwinScenario: vi.fn(), isSensorLive: () => false }));

const stage: ManufacturingStage = {
  id: "mixing", label: "Pepsi Filling", description: "Bottle filling station", position: [6, 0.5, 0],
  sensors: [{ sensorId: "ph", type: "ph", label: "pH", value: 7.2, unit: "", min: 0, max: 14, nominal: 7, warningThreshold: 9, criticalThreshold: 11, status: "normal", timestamp: 0 }],
  outputDevices: [], status: "running", throughput: 2, qualityScore: 99, dwellTimeSec: 3, thresholdEffects: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  useDigitalTwinStore.setState({ stages: [stage], tick: 0, userSpeedMultiplier: 1, activeScenario: null });
  usePLCStore.setState({ params: [{ id: "ph", kind: "analog", label: "pH", value: 7.4, min: 0, max: 14, decimals: 1, status: "normal", accentHex: "#43d8f1" }], telemetrySource: "plc", lastReceivedAt: Date.now(), receivedHistories: {} });
  useSceneSelectionStore.getState().clear();
  useSceneSettingsStore.setState({ labelsVisible: true, sensorMonitorVisible: false, xrayMode: false, flowVisible: false, quality: "medium", postFxQuality: "med" });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const mount = () => render(<TwinWorkbench isFullscreen={false} onFullscreen={vi.fn()} />);

describe("Digital twin workbench navigation", () => {
  it("restores the sensor monitor through a named toggle and returns focus on close", () => {
    mount();
    const trigger = screen.getByRole("button", { name: "Sensor monitor" });
    fireEvent.click(trigger);
    expect(useSceneSettingsStore.getState().sensorMonitorVisible).toBe(true);
    expect(screen.getByRole("region", { name: "Sensor monitor" })).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Close sensor monitor" }));
    expect(screen.queryByRole("region", { name: "Sensor monitor" })).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("selects a production stage and shows its readings in the inspector", () => {
    useSceneSelectionStore.getState().select("mixing");
    mount();
    expect(useSceneSelectionStore.getState().selectedStageId).toBe("mixing");
    expect(screen.getByRole("region", { name: "Pepsi Filling inspector" })).toBeTruthy();
    expect(screen.getByText("7.4")).toBeTruthy();
    expect(screen.queryByText("7.2")).toBeNull();
    expect(screen.getByText("PLC inputs")).toBeTruthy();
    expect(screen.queryByText("99% estimated quality")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close stage inspector" }));
    expect(useSceneSelectionStore.getState().selectedStageId).toBeNull();
    expect(screen.queryByRole("region", { name: "Pepsi Filling inspector" })).toBeNull();
  });

  it("moves keyboard focus from a sensor reading to its inspector and back to monitor access", () => {
    useSceneSettingsStore.setState({ sensorMonitorVisible: true });
    const sidebar = document.createElement("div");
    sidebar.scrollTo = vi.fn().mockImplementation((options: ScrollToOptions) => { sidebar.scrollTop = options.top ?? 0; });
    const host = document.createElement("div");
    sidebar.append(host);
    document.body.append(sidebar);
    render(<TwinWorkbench isFullscreen={false} onFullscreen={vi.fn()} inspectorHost={host} />);
    fireEvent.click(screen.getByRole("button", { name: /Filling pH: 7.4.*Focus station/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Filling", level: 3 }));
    sidebar.scrollTop = 140;
    fireEvent.click(screen.getByRole("button", { name: "Return to whole line" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Sensor monitor" }));
    expect(screen.getByRole("region", { name: "Sensor monitor" })).toBeTruthy();
    expect(sidebar.scrollTop).toBe(140);
    sidebar.remove();
  });

  it("keeps the monitor inside the twin while the selected station uses the sidebar inspector", () => {
    useSceneSettingsStore.setState({ sensorMonitorVisible: true });
    const host = document.createElement("div");
    document.body.append(host);
    const { container } = render(<TwinWorkbench isFullscreen={false} onFullscreen={vi.fn()} inspectorHost={host} />);
    const monitor = screen.getByRole("region", { name: "Sensor monitor" });
    expect(host.contains(monitor)).toBe(false);
    expect(container.querySelector(".twin-monitor-overlay")?.contains(monitor)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Filling pH: 7.4.*Focus station/ }));
    expect(screen.getByRole("region", { name: "Sensor monitor" })).toBe(monitor);
    expect(host.contains(screen.getByRole("region", { name: "Pepsi Filling inspector" }))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close sensor monitor" }));
    expect(useSceneSelectionStore.getState().selectedStageId).toBe("mixing");
    fireEvent.click(screen.getByRole("button", { name: "Sensor monitor" }));
    expect(useSceneSelectionStore.getState().selectedStageId).toBe("mixing");
    host.remove();
  });

  it("shares the chosen projection with the scene so resizing the monitor preserves it", () => {
    const onCameraViewChange = vi.fn();
    const props = { isFullscreen: false, onFullscreen: vi.fn(), onCameraViewChange };
    const { rerender } = render(<TwinWorkbench {...props} cameraView="perspective" />);
    fireEvent.click(screen.getByRole("button", { name: "Plan" }));
    expect(onCameraViewChange).toHaveBeenCalledWith("top");
    expect(setCameraTarget).not.toHaveBeenCalled();
    rerender(<TwinWorkbench {...props} cameraView="top" />);
    fireEvent.click(screen.getByRole("button", { name: "Sensor monitor" }));
    expect(screen.getByRole("button", { name: "Plan" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Close sensor monitor" }));
    expect(screen.getByRole("button", { name: "Plan" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("never substitutes modeled readings into a machine inspector", () => {
    usePLCStore.setState({ telemetrySource: "simulation", params: [], lastReceivedAt: null });
    useSceneSelectionStore.getState().select("mixing");
    mount();
    expect(screen.getByText("No PLC readings for this machine yet.")).toBeTruthy();
    expect(screen.queryByText("7.2")).toBeNull();
    expect(screen.queryByText("99% estimated quality")).toBeNull();
  });

  it("returns from an inspected stage to plan and perspective views", () => {
    useSceneSelectionStore.getState().select("mixing");
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Plan" }));
    expect(useSceneSelectionStore.getState().selectedStageId).toBeNull();
    expect(setCameraTarget).toHaveBeenCalledWith([0, 49, 0.01], [0, 0, 0]);
    fireEvent.click(screen.getByRole("button", { name: "Reset camera" }));
    expect(resetCameraView).toHaveBeenCalled();
  });

  it("applies label and render quality preferences through the scene store", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Show stage labels" }));
    expect(useSceneSettingsStore.getState().labelsVisible).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Display settings" }));
    fireEvent.change(screen.getByLabelText("Render quality"), { target: { value: "low" } });
    expect(useSceneSettingsStore.getState().postFxQuality).toBe("off");
  });

  it("removes the obsolete sequence and X-ray tools and pauses only the simulation", () => {
    useDigitalTwinStore.setState({ simulationActive: true });
    mount();
    expect(screen.queryByRole("button", { name: "X-ray" })).toBeNull();
    expect(screen.queryByText("Production sequence")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pause simulation" }));
    expect(useDigitalTwinStore.getState().simulationActive).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Resume simulation" }));
    expect(useDigitalTwinStore.getState().simulationActive).toBe(true);
  });
});
