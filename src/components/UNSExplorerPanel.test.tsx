import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UNSExplorerPanel from "./UNSExplorerPanel";
import { UIVersionContext } from "./ui-version/UIVersionContext";

const broker = vi.hoisted(() => ({ listener: null as ((topic: string, payload: unknown) => void) | null, unsubscribe: vi.fn() }));
vi.mock("../services/plcService", () => ({ subscribeAnyMessage: (listener: (topic: string, payload: unknown) => void) => { broker.listener = listener; return broker.unsubscribe; } }));
const DEVICE = "prplInnovationHub/McKinney/production/lineA/cell1/plc1";
const BOARD_A = `${DEVICE}/data/boardA`;
const BOARD_B = `${DEVICE}/data/boardB`;
function receive(topic: string, payload: unknown) {
  act(() => { broker.listener?.(topic, payload); vi.advanceTimersByTime(250); });
}
function explore() { fireEvent.click(screen.getByRole("button", { name: "Explore topics" })); }
function hierarchy() { if (!screen.queryByRole("navigation", { name: "Namespace hierarchy" })) explore(); return screen.getByRole("navigation", { name: "Namespace hierarchy" }); }
function expandAll() { hierarchy(); fireEvent.click(screen.getByRole("button", { name: "Expand all branches" })); }
function inspectTopic(path: string) { expandAll(); fireEvent.click(within(hierarchy()).getByTitle(path)); }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100_000); broker.listener = null; broker.unsubscribe.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("UNS Explorer workspace", () => {
  it("annotates all six hierarchy levels without rewriting the received path", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive(`${DEVICE}/data/boardA`, { voltage: 4.3 });
    expandAll();
    const segments = DEVICE.split("/");
    ["Location", "Site", "Area", "Line", "Cell", "Equipment"].forEach((label, index) => {
      const row = within(hierarchy()).getByTitle(segments.slice(0, index + 1).join("/"));
      expect(within(row).getByText(label)).toBeTruthy();
    });
    inspectTopic(BOARD_A);
    expect(within(screen.getByLabelText("Selected namespace details")).getByText(BOARD_A)).toBeTruthy();
  });
  it("starts empty without seeded topics or payload values", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("Waiting for broker traffic");
    expect(screen.queryByLabelText("Selected namespace details")).toBeNull();
    expect(screen.getByText("Awaiting traffic")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export namespace snapshot" }).hasAttribute("disabled")).toBe(true);
  });

  it("opens the activity overview with actual arrivals and navigates to a topic", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive(BOARD_A, { voltage: 4.31 });
    receive(BOARD_B, { enabled: false });
    const overview = screen.getByLabelText("Namespace activity overview");
    expect(document.querySelector(".uns-workspace-body.is-overview")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Namespace hierarchy" })).toBeNull();
    expect(within(overview).getByLabelText("Traffic timeline")).toBeTruthy();
    expect(within(overview).getByLabelText("Publish interval analysis")).toBeTruthy();
    expect(within(overview).getByLabelText("Payload change timeline")).toBeTruthy();
    expect(within(overview).getByLabelText("Numeric field explorer")).toBeTruthy();
    expect(within(overview).getByText("Namespace coverage")).toBeTruthy();
    expect(within(overview).getByText("Payload composition")).toBeTruthy();
    expect(within(overview).getAllByText("First receipt")).toHaveLength(2);
    expect(overview.querySelectorAll(".uns-traffic-row rect")).toHaveLength(60);
    fireEvent.click(within(overview).getByRole("button", { name: `Inspect activity for ${BOARD_B}: 0.1 Hz` }));
    expect(screen.queryByLabelText("Namespace activity overview")).toBeNull();
    expect(within(screen.getByLabelText("Selected namespace details")).getByText(BOARD_B)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show namespace activity" }));
    act(() => vi.advanceTimersByTime(11_000));
    expect(screen.getByLabelText("Namespace activity overview").textContent).toContain("0.0Hz combined");
    expect(screen.getByLabelText("0 of 2 topics received in the last five seconds")).toBeTruthy();
  });

  it("compares the last two receipts and filters fields without hiding raw metadata", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive(BOARD_A, { voltage: 4.31, enabled: false, removed: 0, _bridgeTs: 1 });
    inspectTopic(BOARD_A);
    fireEvent.click(screen.getByRole("button", { name: "Changes" }));
    expect(screen.getByText("A second receipt is needed to compare values.")).toBeTruthy();
    receive(BOARD_A, { voltage: 4.5, enabled: false, added: 0, _bridgeTs: 2 });
    const changes = document.querySelector(".uns-payload-changes")!;
    expect(changes.querySelectorAll("li")).toHaveLength(3);
    expect(changes.textContent).toContain("4.31");
    expect(changes.textContent).toContain("4.5");
    fireEvent.click(screen.getByRole("button", { name: "Tags" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Filter payload fields" }), { target: { value: "volt" } });
    expect(document.querySelectorAll(".uns-instrument-tags > div")).toHaveLength(1);
    expect(document.querySelectorAll(".uns-tag-trace path")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(document.querySelector(".uns-workspace-payload pre")?.textContent).toContain('"_bridgeTs": 2');
    receive(BOARD_A, { voltage: 4.5, enabled: false, added: 0, _bridgeTs: 3 });
    fireEvent.click(screen.getByRole("button", { name: "Changes" }));
    expect(screen.getByText("No field changes in the latest message.")).toBeTruthy();
  });

  it("lets the overview inspect real sensor samples and switch topics and fields", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive(BOARD_A, { voltage: 4.31, current: 0 });
    receive(BOARD_A, { voltage: 4.5, current: 0 });
    receive(BOARD_B, { pressure: 65 });
    const lab = screen.getByLabelText("Numeric field explorer");
    expect(within(lab).getByRole("combobox", { name: "Numeric field" })).toHaveProperty("value", "voltage");
    expect(lab.querySelector("output")?.textContent).toBe("4.5");
    fireEvent.change(within(lab).getByRole("slider", { name: "Inspect numeric field sample" }), { target: { value: "0" } });
    expect(lab.querySelector("output")?.textContent).toBe("4.31");
    fireEvent.change(within(lab).getByRole("combobox", { name: "Numeric field" }), { target: { value: "current" } });
    expect(lab.querySelector("output")?.textContent).toBe("0");
    expect(within(lab).getByRole("img").getAttribute("aria-label")).toContain("minimum 0, maximum 0");
    fireEvent.change(within(lab).getByRole("combobox", { name: "Numeric field topic" }), { target: { value: BOARD_B } });
    expect(lab.querySelector("output")?.textContent).toBe("65");
    expect(within(lab).getByRole("slider", { name: "Inspect numeric field sample" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByRole("slider", { name: "Inspect traffic second" }), { target: { value: "0" } });
    expect(screen.getByLabelText("Traffic timeline").querySelector("output")?.textContent).toBe("0 messages");
  });

  it("copies exact topic paths and exports a downloadable received-data snapshot", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const createObjectURL = vi.fn().mockReturnValue("blob:uns-snapshot"), revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive(BOARD_A, { voltage: 4.31 });
    inspectTopic(BOARD_A);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy topic path" })));
    expect(writeText).toHaveBeenCalledWith(BOARD_A);
    expect(screen.getByText("Copied")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Export namespace snapshot" }));
    expect(createObjectURL.mock.calls[0][0].type).toBe("application/json");
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByText("Snapshot downloaded")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:uns-snapshot");
  });
  it("lets users select a discovered topic and inspect precise received values or JSON", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive(BOARD_A, { voltage: 4.310234, enabled: false, counter: 0 });
    receive("meter/data", { power: 122.5 });
    inspectTopic(BOARD_A);
    const inspector = screen.getByLabelText("Selected namespace details");
    expect(within(inspector).getByText("4.310234")).toBeTruthy();
    expect(within(inspector).getByText("false")).toBeTruthy();
    expect(within(inspector).getByText("0")).toBeTruthy();
    expect(within(hierarchy()).queryByTitle("meter/data")).toBeNull();
    fireEvent.click(within(inspector).getByRole("button", { name: "JSON" }));
    expect(inspector.querySelector("pre")?.textContent).toContain('"voltage": 4.310234');
  });
  it("supports tag search while retaining the connected path, then clears no-result searches", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive(BOARD_A, { pressure_sensor: 65 });
    receive(BOARD_B, { energy: 5 });
    explore();
    fireEvent.change(screen.getByRole("textbox", { name: "Search namespace topics or tags" }), { target: { value: "pressure" } });
    expect(within(hierarchy()).getByTitle(BOARD_A)).toBeTruthy();
    expect(within(hierarchy()).getByTitle(DEVICE)).toBeTruthy();
    expect(within(hierarchy()).queryByTitle(BOARD_B)).toBeNull();
    expect(screen.getByRole("button", { name: "Collapse all branches" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Search namespace topics or tags" }), { target: { value: "missing-device" } });
    expect(screen.getByText("No matching topics")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(within(hierarchy()).getByTitle(DEVICE)).toBeTruthy();
    expect(within(hierarchy()).queryByTitle(BOARD_A)).toBeNull();
    expandAll();
    expect(within(hierarchy()).getByTitle(BOARD_B)).toBeTruthy();
  });
  it("collapses and expands discovered branches without discarding messages", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive(BOARD_A, { voltage: 4.3 });
    explore();
    fireEvent.click(screen.getByRole("button", { name: "Collapse all branches" }));
    expect(screen.queryByTitle(BOARD_A)).toBeNull();
    expandAll();
    fireEvent.click(within(hierarchy()).getByTitle(BOARD_A));
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("1 messages received");
  });
  it("uses arrival ages and quiet state rather than pretending data stays live", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive(BOARD_A, { power: 0 });
    inspectTopic(BOARD_A);
    expect(screen.getAllByText("Receiving").length).toBe(2);
    act(() => vi.advanceTimersByTime(16_000));
    expect(screen.queryByText("Receiving")).toBeNull();
    expect(screen.getAllByText("Quiet").length).toBe(2);
    expect(screen.getAllByText("16s ago").length).toBeGreaterThan(0);
  });
  it("closes with Escape, restores focus and cleans subscription timers", () => {
    const opener = document.createElement("button");
    document.body.append(opener); opener.focus();
    const onClose = vi.fn();
    const view = render(<UNSExplorerPanel open onClose={onClose} />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close UNS Explorer" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    view.rerender(<UNSExplorerPanel open={false} onClose={onClose} />);
    expect(document.activeElement).toBe(opener);
    view.unmount();
    expect(broker.unsubscribe).toHaveBeenCalledOnce();
    opener.remove();
  });
  it("preserves search focus when a parent rerenders with a new close callback", () => {
    const firstClose = vi.fn();
    const latestClose = vi.fn();
    const view = render(<UNSExplorerPanel open onClose={firstClose} />);
    const search = screen.getByRole("textbox", { name: "Search namespace topics or tags" });
    search.focus();
    expect(document.activeElement).toBe(search);
    view.rerender(<UNSExplorerPanel open onClose={latestClose} />);
    expect(document.activeElement).toBe(search);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(firstClose).not.toHaveBeenCalled();
    expect(latestClose).toHaveBeenCalledOnce();
  });
  it("opens the readable tree without chart or list mode controls", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive(BOARD_A, { voltage: 4.3 });
    receive(BOARD_B, { pressure: 65 });
    expect(screen.queryByRole("button", { name: "Chart" })).toBeNull();
    expect(screen.queryByRole("button", { name: "List" })).toBeNull();
    expect(hierarchy().querySelectorAll(".uns-workspace-node-select")).toHaveLength(6);
    inspectTopic(BOARD_B);
    expect(screen.getByTitle(BOARD_B).getAttribute("aria-current")).toBe("true");
    expect(within(screen.getByLabelText("Selected namespace details")).getByText("65")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `Collapse ${DEVICE}` }));
    expect(screen.queryByTitle(BOARD_B)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `Expand ${DEVICE}` }));
    expect(screen.getByTitle(BOARD_B).getAttribute("aria-current")).toBe("true");
  });
  it("allows details to be opened, hidden for map space and restored with the same payload", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive(BOARD_A, { power: 0 });
    expect(screen.queryByLabelText("Selected namespace details")).toBeNull();
    inspectTopic(BOARD_A);
    fireEvent.click(screen.getByRole("button", { name: "Hide namespace details" }));
    expect(screen.queryByLabelText("Selected namespace details")).toBeNull();
    expect(screen.getByTitle(BOARD_A).getAttribute("aria-current")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Show namespace details" }));
    expect(within(screen.getByLabelText("Selected namespace details")).getByText("0")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide namespace details" }));
    fireEvent.click(screen.getByTitle(BOARD_A));
    expect(screen.getByLabelText("Selected namespace details")).toBeTruthy();
  });
  it("preserves progressive branch expansion across receipts while search exposes matching topics", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive(BOARD_A, { voltage: 4.3 });
    explore();
    expect(screen.queryByTitle(BOARD_A)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `Expand ${DEVICE}` }));
    receive(BOARD_B, { pressure: 65 });
    expect(screen.getByTitle(BOARD_A)).toBeTruthy();
    expect(screen.getByTitle(BOARD_B)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `Collapse ${DEVICE}` }));
    receive(BOARD_A, { voltage: 4.2 });
    expect(screen.queryByTitle(BOARD_A)).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Search namespace topics or tags" }), { target: { value: "pressure" } });
    expect(screen.getByTitle(BOARD_B)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear namespace search" }));
    expect(screen.queryByTitle(BOARD_B)).toBeNull();
    expandAll();
    expect(screen.getByTitle(BOARD_A)).toBeTruthy();
    const newDevice = "prplInnovationHub/McKinney/production/lineA/cell1/plc2";
    receive(`${newDevice}/data/boardA`, { voltage: 4.1 });
    expect(screen.getByTitle(BOARD_A)).toBeTruthy();
    expect(screen.queryByTitle(`${newDevice}/data/boardA`)).toBeNull();
    expect(screen.getByRole("button", { name: `Expand ${newDevice}` }).getAttribute("aria-expanded")).toBe("false");
  });
  it("ignores unrelated prefixes without changing UNS totals, payloads or freshness", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive(BOARD_A, { voltage: 4.3 });
    inspectTopic(BOARD_A);
    act(() => vi.advanceTimersByTime(16_000));
    receive("meter/data", { power: 100 });
    receive("prp1Home/McKinney/lineA/plc1/data/boardA", { voltage: 99 });
    receive("prplInnovationHub2/McKinney/lineA/plc1/data/boardA", { voltage: 99 });
    receive("prplHome/McKinney/lineA/plc1/data/boardA", { voltage: 99 });
    expect(hierarchy().querySelectorAll(".uns-workspace-node-select")).toHaveLength(8);
    const summary = document.querySelector(".uns-workspace-summary")!;
    expect([...summary.querySelectorAll("strong")].map((node) => node.textContent)).toEqual(["1", "1", "1"]);
    expect(screen.queryByText("Receiving")).toBeNull();
    expect(within(screen.getByLabelText("Selected namespace details")).getByText("4.3")).toBeTruthy();
    expect(within(hierarchy()).queryByTitle("meter")).toBeNull();
    expect(within(hierarchy()).queryByTitle("prp1Home")).toBeNull();
    expect(within(hierarchy()).queryByTitle("prplInnovationHub2")).toBeNull();
  });
  it("accepts the exact prplInnovationHub parent as well as its descendant topics", () => {
    render(<UNSExplorerPanel open onClose={vi.fn()} />);
    receive("prplInnovationHub", { online: false });
    fireEvent.click(within(hierarchy()).getByTitle("prplInnovationHub"));
    expect(within(screen.getByLabelText("Selected namespace details")).getByText("false")).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("1 messages received");
  });
  it("retains the Classic Explorer and applies the same prplInnovationHub boundary", () => {
    render(<UIVersionContext.Provider value={{ version: "classic", setVersion: vi.fn() }}><UNSExplorerPanel open onClose={vi.fn()} /></UIVersionContext.Provider>);
    expect(screen.getByText("UNS Explorer")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Chart" })).toBeNull();
    expect(screen.queryByRole("button", { name: "List" })).toBeNull();
    receive("meter/data", { power: 122.5 });
    receive("prp1Home/data", { value: 1 });
    receive("prplInnovationHub2/data", { value: 1 });
    expect(screen.getByText("0 messages this session")).toBeTruthy();
    expect(screen.getByText("Waiting for broker traffic")).toBeTruthy();
    receive("prplInnovationHub/data", { value: 0 });
    expect(screen.getByText("prplInnovationHub")).toBeTruthy();
    expect(screen.getByText("data")).toBeTruthy();
    expect(screen.getByText("1 messages this session")).toBeTruthy();
  });
});
