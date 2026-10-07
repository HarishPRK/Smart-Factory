import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { askAgent } from "../services/langgraphService";
import LanggraphAgentPanel from "./LanggraphAgentPanel";

vi.mock("../services/langgraphService", () => ({ askAgent: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function PanelHarness() {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>Open LangGraph AI</button>
    <LanggraphAgentPanel open={open} onClose={() => setOpen(false)} />
  </>;
}

describe("LangGraph AI launch and conversation", () => {
  it("opens without contacting the agent, contains keyboard focus, and returns focus on Escape", () => {
    render(<PanelHarness />);
    const launcher = screen.getByRole("button", { name: "Open LangGraph AI" });
    launcher.focus();
    fireEvent.click(launcher);

    const dialog = screen.getByRole("dialog", { name: "LangGraph AI factory assistant" });
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Message LangGraph AI" }));
    const controls = dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    const first = controls[0];
    const last = controls[controls.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(launcher);
    expect(askAgent).not.toHaveBeenCalled();
  });

  it("preserves the existing conversation when the panel is closed and reopened", async () => {
    vi.mocked(askAgent).mockResolvedValue("This reply came from the mocked service.");
    render(<PanelHarness />);
    const launcher = screen.getByRole("button", { name: "Open LangGraph AI" });
    fireEvent.click(launcher);
    fireEvent.change(screen.getByRole("textbox", { name: "Message LangGraph AI" }), { target: { value: "A local test prompt" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("This reply came from the mocked service.");
    fireEvent.click(screen.getByTitle("Close LangGraph AI"));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(launcher);

    expect(screen.getByText("A local test prompt")).toBeTruthy();
    expect(screen.getByText("This reply came from the mocked service.")).toBeTruthy();
    expect(askAgent).toHaveBeenCalledTimes(1);
  });
});
