import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FilterProvider } from "../context/FilterContext";
import KPIBar from "./KPIBar";

vi.mock("./KOSDispenseWidget", () => ({
  default: () => <button type="button">Pepsi feed</button>,
}));

vi.mock("./LorawanWidget", () => ({
  default: () => <button type="button">LoRaWAN feed</button>,
}));

class ResizeObserverMock {
  disconnect() {}
  observe() {}
  unobserve() {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: query.includes("reduced-motion"),
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(cleanup);

const renderRail = (onAnalyticsClick = vi.fn()) =>
  render(
    <FilterProvider>
      <KPIBar onAnalyticsClick={onAnalyticsClick} />
    </FilterProvider>,
  );

describe("KPIBar", () => {
  it("exposes metric selection as a pressed button state", () => {
    renderRail();

    const energy = screen.getByRole("button", {
      name: /Apply Energy dashboard filter/i,
    });
    expect(energy.getAttribute("aria-pressed")).toBe("false");
    expect(energy.querySelector(".kpi-card__label")?.textContent).toBe("ENERGY");

    fireEvent.click(energy);

    expect(energy.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Filtering")).toBeTruthy();
  });

  it("switches to the workspace group and preserves launcher callbacks", () => {
    const onAnalyticsClick = vi.fn();
    renderRail(onAnalyticsClick);

    fireEvent.click(screen.getByRole("tab", { name: "Workspaces" }));
    const analytics = screen.getByRole("button", {
      name: "Open analytics trends",
    });

    expect(analytics.textContent).not.toContain("Open");
    expect(analytics.textContent).toBe("ANALYTICS");
    expect(analytics.getAttribute("title")).toBe("Trends & sensor history");

    fireEvent.click(analytics);

    expect(onAnalyticsClick).toHaveBeenCalledTimes(1);
  });

  it("updates the reading and its change together when changing zones", () => {
    renderRail();

    const energy = screen.getByRole("button", { name: /Apply Energy dashboard filter/i });
    expect(energy.textContent).toContain("2,041");
    expect(energy.textContent).toContain("3.2%");
    expect(energy.getAttribute("aria-description")).toBe("Sample data. Increase of 3.2%.");

    fireEvent.click(screen.getByRole("button", { name: "Zone 1" }));

    expect(energy.textContent).toContain("680");
    expect(energy.textContent).toContain("2.1%");
    expect(energy.getAttribute("aria-description")).toBe("Sample data. Increase of 2.1%.");
    expect(screen.getAllByText("Sample data")).toHaveLength(1);
  });

  it("keeps metric readings immediately available after switching tabs", () => {
    renderRail();
    fireEvent.click(screen.getByRole("tab", { name: "Workspaces" }));
    fireEvent.click(screen.getByRole("tab", { name: /Plant KPIs/i }));

    expect(screen.getByRole("button", { name: /Apply Energy dashboard filter/i }).textContent).toContain("2,041");
    expect(screen.getByRole("button", { name: /Open OEE details/i }).textContent).toContain("75.2");
  });

  it("does not reserve arrow space when all cards can fit in the full panel", () => {
    renderRail();
    const rail = screen.getByRole("region", { name: "Plant KPIs cards" });
    Object.defineProperties(rail, {
      clientWidth: { configurable: true, value: 826 },
      scrollWidth: { configurable: true, value: 894 },
    });
    Object.defineProperty(rail.parentElement, "clientWidth", { configurable: true, value: 900 });
    fireEvent.scroll(rail);

    expect(rail.parentElement?.classList.contains("is-scrollable")).toBe(false);

    Object.defineProperty(rail.parentElement, "clientWidth", { configurable: true, value: 850 });
    fireEvent.scroll(rail);

    expect(rail.parentElement?.classList.contains("is-scrollable")).toBe(true);
  });

  it("opens OEE details while retaining its honest percentage scale", () => {
    const onOeeClick = vi.fn();
    render(<FilterProvider><KPIBar onOeeClick={onOeeClick} /></FilterProvider>);
    const oee = screen.getByRole("button", { name: /Open OEE details/i });

    expect(oee.getAttribute("aria-description")).toContain("75.2 percent on a 0 to 100 percent scale");
    fireEvent.click(oee);

    expect(onOeeClick).toHaveBeenCalledTimes(1);
    expect(oee.getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps twelve workspaces available with renamed launchers and LoRaWAN", () => {
    const onLaunch = vi.fn();
    render(<FilterProvider><KPIBar
      onOfferingsClick={onLaunch} onEagleClick={onLaunch} onAnalyticsClick={onLaunch}
      onPredictClick={onLaunch} onDpsClick={onLaunch} onRoutingClick={onLaunch}
      onItDevicesClick={onLaunch} onOtDevicesClick={onLaunch} onOnboardingClick={onLaunch}
      onGatewayTwinClick={onLaunch} onVideoClick={onLaunch}
    /></FilterProvider>);

    const workspaces = screen.getByRole("tab", { name: "Workspaces" });
    expect(workspaces.textContent).toContain("12");
    fireEvent.click(workspaces);

    const launchers = screen.getAllByRole("button", { name: /^Open / });
    expect(launchers).toHaveLength(11);
    launchers.forEach(button => fireEvent.click(button));
    expect(onLaunch).toHaveBeenCalledTimes(11);
    expect(screen.getByRole("button", { name: "LoRaWAN feed" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open LangGraph AI" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open dynamic failover" }).textContent).toBe("DYNAMIC FAILOVER");
    expect(screen.getByRole("button", { name: "Open video analytics streams" }).textContent).toBe("VIDEO ANALYTICS");
    launchers.forEach((button) => {
      const label = button.querySelector(".kpi-card__label")?.textContent;
      expect(label).toBeTruthy();
      expect(label).toBe(label?.toUpperCase());
    });
  });

  it("supports keyboard movement between category tabs", async () => {
    renderRail();
    const metrics = screen.getByRole("tab", { name: /Plant KPIs/i });
    const workspaces = screen.getByRole("tab", { name: "Workspaces" });

    fireEvent.keyDown(metrics, { key: "End" });
    await waitFor(() => expect(document.activeElement).toBe(workspaces));
    expect(workspaces.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(workspaces, { key: "ArrowRight" });
    await waitFor(() => expect(document.activeElement).toBe(metrics));
    expect(metrics.getAttribute("aria-selected")).toBe("true");
  });
});
