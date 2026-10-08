import { useCallback, useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PLCAnalyticsHistory } from "../hooks/usePLCAnalyticsHistory";
import type { SiteWiseProperty } from "../services/siteWiseService";
import KPIAnalyticsPanel from "./KPIAnalyticsPanel";

const fixtures = vi.hoisted(() => ({
  histories: new Map<string, PLCAnalyticsHistory>(),
  now: 1_800_000_060_000,
  configured: false,
}));

vi.mock("../hooks/usePLCAnalyticsHistory", async (importOriginal) => {
  const original = await importOriginal<typeof import("../hooks/usePLCAnalyticsHistory")>();
  return {
    ...original,
    usePLCAnalyticsHistory: (property: string, range: keyof typeof original.ANALYTICS_RANGE_CONFIGS, offset = 0): PLCAnalyticsHistory => {
      const end = fixtures.now - offset;
      return fixtures.histories.get(`${property}:${range}:${offset}`) ?? {
        points: [], loading: false, source: "unavailable",
        state: range === "1m" || range === "5m" ? "empty" : "unconfigured",
        lastUpdated: null, windowStart: end - original.ANALYTICS_RANGE_CONFIGS[range].durationMs,
        windowEnd: end, error: null,
      };
    },
  };
});
vi.mock("../services/siteWiseService", () => ({
  isSiteWiseConfigured: () => fixtures.configured,
  fetchMetrics: vi.fn().mockResolvedValue({}),
}));

function received(property: SiteWiseProperty, values: number[], range = "1m", offset = 0) {
  const end = fixtures.now - offset;
  const duration = range === "6h" ? 21_600_000 : range === "1h" ? 3_600_000 : 60_000;
  fixtures.histories.set(`${property}:${range}:${offset}`, {
    points: values.map((value, index) => ({ timestamp: end - (values.length - index) * 5_000, value })),
    loading: false, source: range === "1m" ? "mqtt" : "sitewise", state: "ready",
    lastUpdated: values.length ? end - 5_000 : null,
    windowStart: end - duration, windowEnd: end, error: null,
  });
}
function summaryValue(summary: HTMLElement, label: string) {
  return within(summary).getByText(label).nextElementSibling?.textContent;
}

beforeEach(() => { fixtures.histories.clear(); fixtures.configured = false; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("PLC Analytics received-data workspace", () => {
  it("keeps missing measurements empty and disables export instead of generating samples", () => {
    render(<KPIAnalyticsPanel open onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "PLC Analytics" })).toBeTruthy();
    expect(screen.getByText("Waiting for this sensor")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Voltage received history/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Export CSV" }).hasAttribute("disabled")).toBe(true);
    const summary = screen.getByLabelText("Voltage summary");
    expect(summaryValue(summary, "Average")).toBe("—V");
    expect(summaryValue(summary, "Statistical outliers")).toBe("—samples · 1.8σ");
    expect(screen.queryByText(/Sample data/)).toBeNull();
  });

  it("preserves actual zeros, a flat distribution, and finite chart geometry", () => {
    received("voltage", [0, 0, 0]);
    render(<KPIAnalyticsPanel open onClose={vi.fn()} />);
    const plot = screen.getByRole("img", { name: "Voltage received history, 3 timestamped readings" });
    expect(plot.innerHTML).not.toMatch(/NaN|Infinity/);
    const summary = screen.getByLabelText("Voltage summary");
    expect(summaryValue(summary, "Average")).toBe("0V");
    expect(summaryValue(summary, "Peak")).toBe("0V");
    expect(summaryValue(summary, "Minimum")).toBe("0V");
    expect(summaryValue(summary, "Statistical outliers")).toBe("0samples · 1.8σ");
    const histogram = screen.getByRole("img", { name: "3 readings in 12 distribution bins" });
    expect(Array.from(histogram.querySelectorAll("rect")).filter((rect) => Number(rect.getAttribute("height")) > 0)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Export CSV" }).hasAttribute("disabled")).toBe(false);
  });

  it("fills the empty hourly analog plot with variation and coherent chart statistics", () => {
    render(<KPIAnalyticsPanel open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "1h" }));
    const plot = screen.getByRole("img", { name: /Voltage trend history/ });
    expect(plot.innerHTML).not.toMatch(/NaN|Infinity/);
    const trace = plot.querySelector('path[fill="none"]')?.getAttribute("d") ?? "";
    const yPositions = [...trace.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((match) => match[1]);
    expect(new Set(yPositions).size).toBeGreaterThan(100);
    const summary = screen.getByLabelText("Voltage summary");
    expect(summaryValue(summary, "Average")).not.toBe("—V");
    expect(summaryValue(summary, "Peak")).not.toBe(summaryValue(summary, "Minimum"));
    expect(screen.getByRole("button", { name: "Export CSV" }).hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText("Received data only")).toBeNull();
    expect(screen.getByText("Last hour · 15-second intervals")).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).not.toMatch(/simulated|simulation|sample data/i);
    fireEvent.click(screen.getByRole("button", { name: "1m" }));
    expect(screen.queryByRole("img", { name: /Voltage trend history/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Export CSV" }).hasAttribute("disabled")).toBe(true);
  });

  it("keeps received hourly values exact and never invents digital or alert history", () => {
    received("voltage", [0, 0, 0], "1h");
    render(<KPIAnalyticsPanel open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "1h" }));
    expect(screen.getByRole("img", { name: "Voltage received history, 3 timestamped readings" })).toBeTruthy();
    expect(summaryValue(screen.getByLabelText("Voltage summary"), "Average")).toBe("0V");
    fireEvent.click(screen.getByRole("button", { name: "Digital I/O" }));
    expect(screen.queryByRole("img", { name: /state history/ })).toBeNull();
    expect(screen.getAllByText("No history")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Alerts" }));
    expect(screen.queryByRole("img", { name: /state history/ })).toBeNull();
  });

  it("positions short histories at measurement times instead of stretching them across the minute", () => {
    received("voltage", [4.1, 4.3]);
    render(<KPIAnalyticsPanel open onClose={vi.fn()} />);
    const plot = screen.getByRole("img", { name: "Voltage received history, 2 timestamped readings" });
    const trace = plot.querySelector('path[fill="none"]')?.getAttribute("d") ?? "";
    const [firstX, lastX] = [...trace.matchAll(/[ML]([\d.]+),/g)].map((match) => Number(match[1]));
    const width = Number(plot.getAttribute("viewBox")?.split(" ")[2]);
    expect(firstX).toBeGreaterThan(width * 0.7);
    expect(lastX - firstX).toBeLessThan(width * 0.2);
  });

  it("does not show the prior channel's values when selecting a channel with no history", () => {
    received("voltage", [4.31]);
    render(<KPIAnalyticsPanel open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect Temperature" }));
    expect(screen.getByRole("heading", { name: "Temperature history" })).toBeTruthy();
    expect(screen.getByText("Waiting for this sensor")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Temperature received history/ })).toBeNull();
    const summary = screen.getByLabelText("Temperature summary");
    expect(summaryValue(summary, "Average")).toBe("—°C");
    expect(summary.textContent).not.toContain("4.31");
    expect(screen.getByRole("button", { name: "Export CSV" }).hasAttribute("disabled")).toBe(true);
  });

  it("supports inspecting a received reading by keyboard in nominal deviation mode", () => {
    received("voltage", [4.1, 4.3]);
    render(<KPIAnalyticsPanel open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Nominal deviation" }));
    expect(screen.getByRole("button", { name: "Nominal deviation" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("img", { name: "Voltage deviation from nominal, 2 timestamped readings" })).toBeTruthy();
    const inspection = screen.getByRole("group", { name: "Inspect Voltage readings with left and right arrow keys" });
    fireEvent.keyDown(inspection, { key: "ArrowLeft" });
    expect(within(inspection).getByText("-0.9 V")).toBeTruthy();
    fireEvent.keyDown(inspection, { key: "ArrowRight" });
    expect(within(inspection).getByText("-0.7 V")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Full range" }));
    expect(screen.getByRole("img", { name: /Voltage deviation from nominal/ }).innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it("shows real digital transitions and keeps missing digital and alert states unavailable", () => {
    received("photoE_sensor", [0, 1, 1, 0]);
    received("alert_0", [0, 1, 1, 0, 1]);
    render(<KPIAnalyticsPanel open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Digital I/O" }));
    const photo = screen.getByRole("heading", { name: "Photoelectric" }).closest("section")!;
    expect(within(photo).getByRole("img", { name: "Photoelectric state history, 4 timestamped readings" })).toBeTruthy();
    expect(summaryValue(photo, "Transitions")).toBe("2");
    expect(summaryValue(photo, "ON samples")).toBe("50%");
    const metal = screen.getByRole("heading", { name: "Metal detector" }).closest("section")!;
    expect(within(metal).getByText("No history")).toBeTruthy();
    expect(within(metal).queryByText("OFF")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Alerts" }));
    const alert = screen.getByRole("heading", { name: "Alert channel 0" }).closest("section")!;
    expect(summaryValue(alert, "Activations")).toBe("2");
    expect(within(alert).getByText("Active")).toBeTruthy();
    const emergencyLamp = screen.getByRole("heading", { name: "Emergency light channel" }).closest("section")!;
    expect(within(emergencyLamp).getByText("No history")).toBeTruthy();
    expect(within(emergencyLamp).queryByText("Clear")).toBeNull();
  });

  it("compares actual adjacent historian windows and leaves unconnected comparisons empty", () => {
    received("voltage", [4, 6], "6h");
    received("voltage", [2, 4], "6h", 21_600_000);
    render(<KPIAnalyticsPanel open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Shift comparison" }));
    expect(screen.getByText("Compare adjacent periods")).toBeTruthy();
    expect(screen.getByText("Current average").nextElementSibling?.textContent).toBe("5V");
    expect(screen.getByText("Previous average").nextElementSibling?.textContent).toBe("3V");
    expect(screen.getByText("Difference").nextElementSibling?.textContent).toBe("+2V");
    fireEvent.click(screen.getByRole("button", { name: "24h" }));
    expect(screen.getAllByText("Historical data is not connected")).toHaveLength(2);
    expect(screen.getByText("Difference").nextElementSibling?.textContent).toBe("—V");
  });

  it("closes with Escape and restores the launch control and page scrolling", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const onClose = useCallback(() => setOpen(false), []);
      return <><button onClick={() => setOpen(true)}>Open analytics</button><KPIAnalyticsPanel open={open} onClose={onClose} /></>;
    }
    document.body.style.overflow = "auto";
    render(<Harness />);
    const launch = screen.getByRole("button", { name: "Open analytics" });
    launch.focus();
    fireEvent.click(launch);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close analytics" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(launch);
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
  });

  it("keeps in-dialog focus and scroll locking across callback changes and uses the latest close handler", () => {
    const firstClose = vi.fn();
    const latestClose = vi.fn();
    const { rerender } = render(<KPIAnalyticsPanel open onClose={firstClose} />);
    const channel = screen.getByRole("button", { name: "Inspect Current" });
    channel.focus();
    const overflowWrites = vi.spyOn(document.body.style, "overflow", "set");

    rerender(<KPIAnalyticsPanel open onClose={latestClose} />);

    expect(document.activeElement).toBe(channel);
    expect(document.body.style.overflow).toBe("hidden");
    expect(overflowWrites).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(firstClose).not.toHaveBeenCalled();
    expect(latestClose).toHaveBeenCalledOnce();
  });
});
