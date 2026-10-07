import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LorawanDevice, LorawanReading } from "../hooks/useLorawanSensors";
import LorawanWidget from "./LorawanWidget";

const feed = vi.hoisted(() => ({ list: [] as LorawanDevice[] }));

vi.mock("../hooks/useLorawanSensors", () => ({
  useLorawanSensors: () => ({ list: feed.list }),
}));

vi.mock("./LorawanDetailDrawer", () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => open ? (
    <section role="dialog" aria-label="LoRaWAN sensor details">
      <button onClick={onClose}>Close feed</button>
    </section>
  ) : null,
}));

const device = (id: string, values: Partial<LorawanReading>): LorawanDevice => {
  const latest = { receivedAt: 1, deviceName: id, devEui: id, ...values };
  return { devEui: id, deviceName: id, latest, history: [latest] };
};

beforeEach(() => { feed.list = []; });
afterEach(cleanup);

describe("LoRaWAN workspace card", () => {
  it("shows an honest waiting state before the first packet", () => {
    render(<LorawanWidget />);

    expect(screen.getByText("Awaiting data")).toBeTruthy();
    expect(screen.getByText("Waiting")).toBeTruthy();
    expect(screen.queryByText("Live")).toBeNull();
    expect(screen.getByRole("button", { name: /Waiting for the first packet/ })).toBeTruthy();
  });

  it("preserves measured zero while excluding simulated and non-finite readings", () => {
    feed.list = [
      device("measured", { soilMoisturePct: 0, soilTempC: 20, batteryV: 3.6 }),
      device("modeled", { soilMoisturePct: 45, batteryV: 3.1, simulated: { soilMoisturePct: true, batteryV: true } }),
      device("invalid", { soilMoisturePct: Number.NaN }),
    ];
    render(<LorawanWidget />);

    expect(screen.getByText("0% moisture")).toBeTruthy();
    expect(screen.getByText("Received")).toBeTruthy();
    expect(screen.queryByText("Low battery")).toBeNull();
    expect(screen.getByRole("button", { name: /average reported moisture 0 percent/ })).toBeTruthy();
  });

  it("shows device count when packets contain only modeled metrics", () => {
    feed.list = [device("modeled", {
      soilMoisturePct: 45, soilTempC: 24, batteryV: 3.1,
      simulated: { soilMoisturePct: true, soilTempC: true, batteryV: true },
    })];
    render(<LorawanWidget />);

    expect(screen.getByText("1 device")).toBeTruthy();
    expect(screen.queryByText(/% moisture/)).toBeNull();
    expect(screen.queryByText("Low battery")).toBeNull();
    expect(screen.getByRole("button", { name: "Open LoRaWAN sensor feed. 1 device" })).toBeTruthy();
  });

  it("uses a reported temperature fallback and a measured low-battery warning", () => {
    feed.list = [device("temperature", { soilTempC: 21.4, batteryV: 3.2 })];
    render(<LorawanWidget />);

    expect(screen.getByText("21.4°C")).toBeTruthy();
    expect(screen.getByText("Low battery")).toBeTruthy();
  });

  it("keeps the feed drawer action and expanded state", () => {
    render(<LorawanWidget />);
    const launcher = screen.getByRole("button", { name: /Open LoRaWAN sensor feed/ });
    expect(launcher.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(launcher);
    expect(screen.getByRole("dialog", { name: "LoRaWAN sensor details" })).toBeTruthy();
    expect(launcher.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Close feed" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(launcher.getAttribute("aria-expanded")).toBe("false");
  });
});
