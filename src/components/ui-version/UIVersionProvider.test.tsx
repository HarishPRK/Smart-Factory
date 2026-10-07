import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UIVersionProvider } from "./UIVersionProvider";
import { useUIVersion } from "./UIVersionContext";

const STORAGE_KEY = "smart-factory.ui-version";

function VersionControls() {
  const { version, setVersion } = useUIVersion();
  return (
    <>
      <output data-testid="selected-ui">{version}</output>
      <button type="button" onClick={() => setVersion("new")}>Choose new</button>
      <button type="button" onClick={() => setVersion("classic")}>Choose classic</button>
    </>
  );
}

function renderProvider() {
  return render(
    <UIVersionProvider>
      <VersionControls />
    </UIVersionProvider>,
  );
}

beforeEach(() => {
  // Node's experimental web storage can mask jsdom's implementation.
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() { return values.size; },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  };
  vi.stubGlobal("localStorage", storage);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("UIVersionProvider", () => {
  it("opens the new interface when no preference has been selected", () => {
    renderProvider();

    expect(screen.getByTestId("selected-ui").textContent).toBe("new");
  });

  it("restores the saved interface and retains changes across a reload", () => {
    window.localStorage.setItem(STORAGE_KEY, "classic");
    const initial = renderProvider();
    expect(screen.getByTestId("selected-ui").textContent).toBe("classic");

    fireEvent.click(screen.getByRole("button", { name: "Choose new" }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("new");
    initial.unmount();

    // A fresh visit without a query parameter uses the persisted choice.
    window.history.replaceState(null, "", "/");
    renderProvider();
    expect(screen.getByTestId("selected-ui").textContent).toBe("new");
  });

  it.each([
    ["classic", "new"],
    ["new", "classic"],
  ] as const)("lets the %s URL override a saved %s preference", (requested, saved) => {
    window.localStorage.setItem(STORAGE_KEY, saved);
    window.history.replaceState(null, "", `/?ui=${requested}`);

    renderProvider();

    expect(screen.getByTestId("selected-ui").textContent).toBe(requested);
  });

  it("ignores invalid preferences without blocking startup", () => {
    window.localStorage.setItem(STORAGE_KEY, "unknown-interface");
    window.history.replaceState(null, "", "/?ui=unknown-interface");

    renderProvider();

    expect(screen.getByTestId("selected-ui").textContent).toBe("new");
  });

  it("updates the URL without losing unrelated parameters, the path, or the hash", () => {
    window.history.replaceState({ source: "factory" }, "", "/factory?zone=2&ui=new#machine-3");
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "Choose classic" }));

    const location = new URL(window.location.href);
    expect(location.pathname).toBe("/factory");
    expect(location.searchParams.get("zone")).toBe("2");
    expect(location.searchParams.get("ui")).toBe("classic");
    expect(location.hash).toBe("#machine-3");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("classic");
    expect(screen.getByTestId("selected-ui").textContent).toBe("classic");
  });

  it("follows the requested UI when browser navigation changes the query", async () => {
    renderProvider();

    window.history.pushState(null, "", "/?ui=classic");
    fireEvent(window, new PopStateEvent("popstate"));
    await waitFor(() => expect(screen.getByTestId("selected-ui").textContent).toBe("classic"));

    window.history.pushState(null, "", "/?ui=new");
    fireEvent(window, new PopStateEvent("popstate"));
    await waitFor(() => expect(screen.getByTestId("selected-ui").textContent).toBe("new"));
  });

  it("still switches when browser storage is unavailable", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is blocked", "SecurityError");
    });
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is blocked", "SecurityError");
    });
    renderProvider();

    expect(screen.getByTestId("selected-ui").textContent).toBe("new");
    fireEvent.click(screen.getByRole("button", { name: "Choose classic" }));

    expect(screen.getByTestId("selected-ui").textContent).toBe("classic");
    expect(new URL(window.location.href).searchParams.get("ui")).toBe("classic");
  });
});
