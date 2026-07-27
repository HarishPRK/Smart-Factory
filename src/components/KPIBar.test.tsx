import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    expect(
      analytics.querySelector(".kpi-workspace-viz--analytics"),
    ).toBeTruthy();

    fireEvent.click(analytics);

    expect(onAnalyticsClick).toHaveBeenCalledTimes(1);
  });
});
