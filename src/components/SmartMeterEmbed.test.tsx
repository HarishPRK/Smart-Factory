// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";
import type { AddressInfo } from "node:net";
import SmartMeterEmbed from "./SmartMeterEmbed";

let server: ViteDevServer;
let origin: string;

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0, strictPort: true, hmr: false, watch: null },
  });
  await server.listen();
  origin = `http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`;
}, 20_000);

afterAll(async () => { await server?.close(); });

describe("Smart Meter embed routing", () => {
  it("serves the meter document and its assets instead of the factory SPA fallback", async () => {
    // Exercise the URL rendered by the actual component against Vite's public-file handling.
    const markup = renderToStaticMarkup(<SmartMeterEmbed />);
    const path = markup.match(/src="([^"]+)"/)?.[1];
    expect(path).toBeTruthy();
    const response = await fetch(new URL(path!, origin));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toMatch(/<title>Aituzero.*Smart Meter/);
    expect(html).not.toContain("/src/main.tsx");
    expect(html).not.toContain("<title>Digital Manufacturing</title>");

    const assets = [...html.matchAll(/(?:src|href)="(\/widgets\/aituzero-meter\/assets\/[^"]+)"/g)];
    expect(assets.length).toBeGreaterThanOrEqual(2);
    for (const [, assetPath] of assets) {
      const asset = await fetch(new URL(assetPath, origin), { method: "HEAD" });
      expect(asset.status).toBe(200);
      expect(asset.headers.get("content-type")).not.toContain("text/html");
    }
  });
});
