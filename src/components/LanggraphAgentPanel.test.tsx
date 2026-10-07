import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
    const controls = dialog.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), a[href], summary, [tabindex="0"]');
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

  it("browses investigation topics without sending until a suggested question is clicked", async () => {
    vi.mocked(askAgent).mockResolvedValue("Pressure report");
    render(<PanelHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open LangGraph AI" }));
    fireEvent.click(screen.getByRole("button", { name: "Sensors & energy" }));
    expect(askAgent).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Factory performance/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Pressure readings Ask/ }));
    await screen.findByText("Pressure report");
    expect(askAgent).toHaveBeenCalledWith("What do the pressure sensor readings show?", expect.any(Object));
    expect(screen.getByRole("textbox", { name: "Message LangGraph AI" })).toBeTruthy();
  });

  it("shows only reported request progress and honors cancellation", async () => {
    let reportPending: ((requestId: string, elapsedMs: number) => void) | undefined;
    vi.mocked(askAgent).mockImplementation((_prompt, options) => {
      reportPending = options?.onPending;
      return new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
    });
    render(<PanelHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open LangGraph AI" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Message LangGraph AI" }), { target: { value: "Test request" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByRole("status").textContent).toBe("Sending your question");
    act(() => reportPending?.("request-17", 2500));
    expect(screen.getByRole("status").textContent).toBe("Awaiting the agent's response");
    expect(screen.getByText("request-17")).toBeTruthy();
    expect(screen.getByText("2.5 s elapsed")).toBeTruthy();
    expect(screen.queryByText(/Fetching from Historian|Cross-checking alerts|Synthesizing/)).toBeNull();
    expect(screen.getByRole("button", { name: "Clear conversation" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByText("Stopped listening");
    expect(screen.getByText(/agent may continue processing on the server/)).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Message LangGraph AI" }).hasAttribute("disabled")).toBe(false);
  });

  it("renders readable structured responses and clears the conversation", async () => {
    vi.mocked(askAgent).mockResolvedValue("## Connected equipment\n\n1. **RFID reader**\n2. Relay board\n\n| Device | Bus |\n| --- | --- |\n| Relay | RS485 |\n\nUse `Modbus` for addressing.");
    render(<PanelHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open LangGraph AI" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Message LangGraph AI" }), { target: { value: "Which devices?" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Message LangGraph AI" }), { key: "Enter" });
    await screen.findByRole("heading", { name: "Connected equipment" });
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toContain("RFID reader");
    expect(within(screen.getByRole("table")).getByRole("cell", { name: "RS485" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear conversation" }));
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("heading", { name: /What needs attention/ })).toBeTruthy();
  });

  it("keeps errors recoverable through retry with the same prompt", async () => {
    vi.mocked(askAgent).mockRejectedValueOnce(new Error("Status poll failed: HTTP 503")).mockResolvedValueOnce("Recovered response");
    render(<PanelHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open LangGraph AI" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Message LangGraph AI" }), { target: { value: "Plant status" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("HTTP 503");
    fireEvent.click(screen.getByRole("button", { name: "Retry request" }));
    await screen.findByText("Recovered response");
    expect(askAgent).toHaveBeenCalledTimes(2);
    expect(vi.mocked(askAgent).mock.calls[1][0]).toBe("Plant status");
  });

  it("does not submit a newline or an active IME composition", () => {
    render(<PanelHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open LangGraph AI" }));
    const input = screen.getByRole("textbox", { name: "Message LangGraph AI" });
    fireEvent.change(input, { target: { value: "Plant status" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(askAgent).not.toHaveBeenCalled();
  });
});
