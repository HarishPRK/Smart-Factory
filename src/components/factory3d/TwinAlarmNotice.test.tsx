import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ManufacturingStage, StageId } from "../../types/digitalTwin";
import { useSceneSelectionStore } from "../../stores/sceneSelectionStore";
import { STAGE_CONFIGS } from "./digitalTwinLayout";
import { summarizeTwinAlarm } from "./twinAlarmState";
import TwinAlarmNotice from "./TwinAlarmNotice";

function stageFixture(id: StageId): ManufacturingStage {
  const config = STAGE_CONFIGS.find((stage) => stage.id === id)!;
  return {
    id, label: config.label, description: config.description, position: [...config.position],
    sensors: config.sensorConfigs.map((sensor) => ({ ...sensor, value: sensor.nominal, status: "normal", timestamp: 1 })),
    outputDevices: [], status: "running", throughput: 0, qualityScore: 100,
    dwellTimeSec: config.dwellTimeSec, thresholdEffects: [...config.thresholdEffects],
  };
}

function setReading(stage: ManufacturingStage, id: string, value: number) {
  stage.sensors.find((sensor) => sensor.sensorId === id)!.value = value;
}

beforeEach(() => useSceneSelectionStore.getState().clear());
afterEach(() => { cleanup(); useSceneSelectionStore.getState().clear(); });

describe("Twin alarm notice", () => {
  it("stays absent while all configured readings are healthy", () => {
    render(<TwinAlarmNotice alarm={summarizeTwinAlarm([stageFixture("forming")])} />);
    expect(screen.queryByRole("region", { name: "Twin threshold response" })).toBeNull();
  });

  it("identifies a live stop as a visual interlock and inspects the affected machine", () => {
    const forming = stageFixture("forming");
    setReading(forming, "forming_pressure", 40);
    render(<TwinAlarmNotice alarm={summarizeTwinAlarm([forming], { isSensorLive: () => true })} />);
    expect(screen.getByText("Twin line stopped")).toBeTruthy();
    expect(screen.getByText("Live PLC")).toBeTruthy();
    expect(screen.getByText("Visual interlock · resumes when the fault clears")).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    fireEvent.click(screen.getByRole("button", { name: "Inspect Blow molding alarm" }));
    expect(useSceneSelectionStore.getState().selectedStageId).toBe("forming");
  });

  it("does not describe a quality-only critical reading as a stopped production line", () => {
    const quality = stageFixture("quality");
    setReading(quality, "quality_lidar", 25);
    render(<TwinAlarmNotice alarm={summarizeTwinAlarm([quality], { isSensorLive: () => true })} />);
    expect(screen.getByText("Critical reading")).toBeTruthy();
    expect(screen.queryByText("Twin line stopped")).toBeNull();
    expect(screen.queryByText(/Visual interlock/)).toBeNull();
  });

  it("labels a simulated warning as Model and a configured slowdown as Process slowed", () => {
    const forming = stageFixture("forming");
    setReading(forming, "forming_proximity", 0);
    render(<TwinAlarmNotice alarm={summarizeTwinAlarm([forming], { isSensorLive: () => false })} />);
    expect(screen.getByText("Model")).toBeTruthy();
    expect(screen.getByText("Process slowed")).toBeTruthy();
    expect(screen.queryByText("Live PLC")).toBeNull();
    expect(screen.queryByText(/Visual interlock/)).toBeNull();
  });

  it("discloses mixed triggered sources instead of calling the whole alarm live", () => {
    const forming = stageFixture("forming"), mixing = stageFixture("mixing");
    setReading(forming, "forming_pressure", 40);
    setReading(mixing, "mixing_ph", 11);
    render(<TwinAlarmNotice alarm={summarizeTwinAlarm([forming, mixing], { isSensorLive: (id) => id === "forming_pressure" })} />);
    expect(screen.getByText("Mixed input")).toBeTruthy();
    expect(screen.queryByText("Live PLC")).toBeNull();
  });

  it("does not invent a live sensor source for a bare equipment fault", () => {
    const packaging = stageFixture("packaging");
    packaging.status = "faulted";
    render(<TwinAlarmNotice alarm={summarizeTwinAlarm([packaging], { isSensorLive: () => true })} />);
    expect(screen.getByText("Equipment state")).toBeTruthy();
    expect(screen.queryByText("Live PLC")).toBeNull();
  });

  it("keeps an unknown stop cause labeled Equipment state when unrelated warnings are live", () => {
    const forming = stageFixture("forming"), curing = stageFixture("curing");
    forming.status = "faulted";
    setReading(forming, "forming_light", 150);
    setReading(curing, "curing_mq", 350);
    const { container } = render(<TwinAlarmNotice alarm={summarizeTwinAlarm([forming, curing], { isSensorLive: () => true })} />);
    expect(screen.getByText("Equipment state")).toBeTruthy();
    expect(screen.queryByText("Live PLC")).toBeNull();
    expect(container.querySelector(".twin-alarm-notice__copy p")?.textContent).toContain(`${forming.label} equipment fault`);
  });

  it("shows the actual E-stop station instead of the first propagated equipment fault", () => {
    const intake = stageFixture("intake"), packaging = stageFixture("packaging");
    intake.status = "faulted";
    packaging.status = "faulted";
    setReading(packaging, "pkg_estop", 1);
    render(<TwinAlarmNotice alarm={summarizeTwinAlarm([intake, packaging], { isSensorLive: () => true })} />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect Packaging alarm" }));
    expect(useSceneSelectionStore.getState().selectedStageId).toBe("packaging");
    expect(screen.queryByText(/Material Intake equipment fault/)).toBeNull();
  });

  it("prioritizes the actual stop cause over a warning earlier on the same machine", () => {
    const forming = stageFixture("forming");
    setReading(forming, "forming_light", 150);
    setReading(forming, "forming_pressure", 40);
    forming.sensors.sort((a, b) => Number(b.sensorId === "forming_light") - Number(a.sensorId === "forming_light"));
    const { container } = render(<TwinAlarmNotice alarm={summarizeTwinAlarm([forming], { isSensorLive: () => true })} />);
    expect(container.querySelector(".twin-alarm-notice__copy p")?.textContent).toContain("Pressure below 50 bar — press halted");
  });

  it("clears the notice on recovery without retaining a stopped label", () => {
    const forming = stageFixture("forming");
    setReading(forming, "forming_pressure", 20);
    const { rerender } = render(<TwinAlarmNotice alarm={summarizeTwinAlarm([forming])} />);
    expect(screen.getByText("Twin line stopped")).toBeTruthy();
    setReading(forming, "forming_pressure", 65);
    rerender(<TwinAlarmNotice alarm={summarizeTwinAlarm([forming])} />);
    expect(screen.queryByRole("region", { name: "Twin threshold response" })).toBeNull();
  });
});
