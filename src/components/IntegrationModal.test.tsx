import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IntegrationModal from "./IntegrationModal";

let fullscreenElement: Element | null;
const exitFullscreen = vi.fn<() => Promise<void>>();

beforeEach(() => {
  fullscreenElement = null;
  exitFullscreen.mockReset().mockResolvedValue(undefined);
  Object.defineProperties(document, {
    fullscreenElement: { configurable: true, get: () => fullscreenElement },
    fullscreenEnabled: { configurable: true, value: true },
    exitFullscreen: { configurable: true, value: exitFullscreen },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function modal(open: boolean, onClose = vi.fn()) {
  return <IntegrationModal open={open} title="Smart meter" enableFullscreen onClose={onClose}>
    <p>Meter content</p>
  </IntegrationModal>;
}

async function enterFullscreen() {
  const dialog = screen.getByRole("dialog", { name: "Smart meter" });
  Object.defineProperty(dialog, "requestFullscreen", {
    configurable: true,
    value: vi.fn(async () => {
      fullscreenElement = dialog;
      document.dispatchEvent(new Event("fullscreenchange"));
    }),
  });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" })); });
  expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeTruthy();
  return dialog;
}

describe("Integration modal fullscreen ownership", () => {
  it("never exits fullscreen on a closed initial mount or ordinary close", () => {
    const { rerender, unmount } = render(modal(false));
    rerender(modal(true));
    rerender(modal(false));
    unmount();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it("leaves another element's fullscreen session untouched", () => {
    fullscreenElement = document.createElement("section");
    const onClose = vi.fn();
    render(modal(true, onClose));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it("closes and restores its presentation even when native exit rejects", async () => {
    const onClose = vi.fn();
    render(modal(true, onClose));
    const dialog = await enterFullscreen();
    exitFullscreen.mockRejectedValue(new TypeError("Document not active"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Close" })); });
    expect(onClose).toHaveBeenCalledOnce();
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(dialog.style.position).toBe("");
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeTruthy();
  });

  it("handles a rejected Escape exit before closing on the next Escape", async () => {
    const onClose = vi.fn();
    render(modal(true, onClose));
    await enterFullscreen();
    exitFullscreen.mockRejectedValue(new TypeError("Document not active"));
    await act(async () => { fireEvent.keyDown(window, { key: "Escape" }); });
    expect(onClose).not.toHaveBeenCalled();
    expect(exitFullscreen).toHaveBeenCalledOnce();
    fullscreenElement = null;
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("catches a rejected fullscreen-button exit and restores the modal", async () => {
    render(modal(true));
    const dialog = await enterFullscreen();
    exitFullscreen.mockRejectedValue(new TypeError("Document not active"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" })); });
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(dialog.style.position).toBe("");
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeTruthy();
  });

  it.each(["close", "unmount"])("exits owned fullscreen on programmatic %s without leaking rejection", async (action) => {
    const { rerender, unmount } = render(modal(true));
    const dialog = await enterFullscreen();
    exitFullscreen.mockRejectedValue(new TypeError("Document not active"));
    await act(async () => {
      if (action === "close") rerender(modal(false));
      else unmount();
    });
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(dialog.style.position).toBe("");
  });
});
