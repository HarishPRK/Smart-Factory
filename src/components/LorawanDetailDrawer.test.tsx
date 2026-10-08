import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { LorawanDevice, LorawanReading } from "../hooks/useLorawanSensors";
import LorawanDetailDrawer from "./LorawanDetailDrawer";

const feed = vi.hoisted(() => ({ list: [] as LorawanDevice[], totalReadings: 0, lastReading: null as LorawanReading | null }));
vi.mock("../hooks/useLorawanSensors", () => ({ useLorawanSensors: () => feed }));

const device = (id: string, values: Partial<LorawanReading> = {}, historyValues: Partial<LorawanReading>[] = []): LorawanDevice => {
  const latest = { receivedAt: Date.now(), deviceName: id, devEui: `eui-${id}`, ...values };
  return { devEui: latest.devEui, deviceName: id, latest, history: historyValues.length ? historyValues.map((point) => ({ ...latest, ...point })) : [latest] };
};
const seed = (...devices: LorawanDevice[]) => { feed.list = devices; feed.totalReadings = devices.reduce((sum, item) => sum + item.history.length, 0); feed.lastReading = devices.at(-1)?.latest ?? null; };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T15:00:00Z")); feed.list = []; feed.totalReadings = 0; feed.lastReading = null; });
afterEach(() => { cleanup(); vi.useRealTimers(); document.body.style.overflow = ""; });

describe("LoRaWAN modal workspace", () => {
  it("stays closed until opened", () => {
    render(<LorawanDetailDrawer open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("opens a named modal and teaches the packet-wait state", () => {
    render(<LorawanDetailDrawer open onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "LoRaWAN sensors" }).getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Waiting for the first packet")).toBeTruthy();
    expect(screen.getByText("Awaiting gateway")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close LoRaWAN sensors" }));
  });
  it("preserves measured zeros, excluding synthetic fields from summary, instruments and chart", () => {
    seed(device("Probe", { soilMoisturePct: 0, soilTempC: 24.6, batteryV: 3.1, simulated: { soilTempC: true, batteryV: true } }));
    render(<LorawanDetailDrawer open onClose={vi.fn()} />);
    const measurements = screen.getByRole("region", { name: "Selected device measurements" });
    expect(within(measurements).getByRole("button", { name: "Show moisture history" }).textContent).toContain("0.0");
    expect(within(measurements).getByRole("button", { name: "Show soil temperature history" }).textContent).toContain("Not reported");
    expect(screen.queryByText("24.6")).toBeNull();
    expect(screen.queryByText("3.10")).toBeNull();
    expect(screen.getByRole("img", { name: /Probe moisture history, 1 received samples, minimum 0.0/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show soil temperature history" }));
    expect(screen.getByText("No soil temperature reported")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
  it("switches selected device and metric using actual received history", () => {
    seed(device("Probe A", { soilMoisturePct: 0 }), device("Probe B", { soilMoisturePct: 7.2, soilTempC: 19.9 }, [{ soilTempC: 18.5, receivedAt: Date.now() - 60_000 }, { soilTempC: 19.9 }]));
    render(<LorawanDetailDrawer open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect Probe B" }));
    expect(screen.getByRole("button", { name: "Inspect Probe B" }).getAttribute("aria-current")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Show soil temperature history" }));
    expect(screen.getByRole("img", { name: /Probe B soil temperature history, 2 received samples, minimum 18.5, maximum 19.9/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Compare Probe A" }));
    expect(screen.getByRole("button", { name: "Inspect Probe A" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByText("No soil temperature reported")).toBeTruthy();
  });
  it("shows one received point without inventing an earlier curve", () => {
    seed(device("Probe", { soilMoisturePct: 7.2 }));
    render(<LorawanDetailDrawer open onClose={vi.fn()} />);
    const chart = screen.getByRole("img");
    expect(chart.querySelectorAll("circle")).toHaveLength(1);
    expect(chart.querySelector("polyline")).toBeNull();
    expect(screen.getByText("One packet received")).toBeTruthy();
  });
  it("reports stale packets without claiming a connected gateway", () => {
    seed(device("Quiet probe", { receivedAt: Date.now() - 240_000, soilMoisturePct: 12 }));
    render(<LorawanDetailDrawer open onClose={vi.fn()} />);
    expect(screen.getByText("No recent packets")).toBeTruthy();
    expect(screen.queryByText("Receiving packets")).toBeNull();
  });
  it("offers packet fields and source timestamp, retaining zero while omitting gap-fill", () => {
    seed(device("Probe", { soilMoisturePct: 0, soilTempC: 24.6, simulated: { soilTempC: true }, sourceTs: "2026-10-08T14:59:58Z" }));
    render(<LorawanDetailDrawer open onClose={vi.fn()} />);
    const details = screen.getByText("Latest received fields").closest("details")!;
    fireEvent.click(screen.getByText("Latest received fields"));
    expect(details.textContent).toContain('"soil_moisture_pct": 0');
    expect(details.textContent).not.toContain('"soil_temp_c"');
    expect(details.textContent).toContain("2026-10-08T14:59:58Z");
  });
  it("closes on Escape, close button and backdrop but not on workspace content", () => {
    const onClose = vi.fn(); render(<LorawanDetailDrawer open onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog")); expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close LoRaWAN sensors" }));
    fireEvent.click(screen.getByTestId("lorawan-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
  it("traps focus at both edges of the dialog", () => {
    seed(device("Probe", { soilMoisturePct: 7.2 })); render(<LorawanDetailDrawer open onClose={vi.fn()} />);
    const close = screen.getByRole("button", { name: "Close LoRaWAN sensors" });
    const summary = screen.getByText("Latest received fields").closest("summary")!;
    close.focus(); fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(summary);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
  });
  it("restores launcher focus and body scroll when dismissed", () => {
    function Harness() { const [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>Open feed</button><LorawanDetailDrawer open={open} onClose={() => setOpen(false)} /></>; }
    render(<Harness />);
    const launcher = screen.getByRole("button", { name: "Open feed" }); launcher.focus(); fireEvent.click(launcher);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(launcher);
    expect(document.body.style.overflow).toBe("");
  });
});
