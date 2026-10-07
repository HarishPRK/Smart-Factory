import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import LanggraphResponse from "./LanggraphResponse";

afterEach(cleanup);
describe("LangGraph answer rendering", () => {
  it("escapes server HTML and makes only HTTP links clickable", () => {
    const { container } = render(<LanggraphResponse content={'<script>alert(1)</script>\n\n[Unsafe](javascript:alert) and [Reference](https://example.com/doc)'} />);
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Reference" }).getAttribute("rel")).toBe("noopener noreferrer");
  });
  it("preserves unformatted answers and code without inventing facts", () => {
    render(<LanggraphResponse content={'The equipment is unavailable.\nCheck the connection.\n\n```text\nPressure: unknown\n```'} />);
    expect(screen.getByText(/The equipment is unavailable/).textContent).toContain("Check the connection.");
    expect(screen.getByText("Pressure: unknown").tagName).toBe("CODE");
  });
});
