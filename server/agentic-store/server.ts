import "../load-env.js";

import { createServer } from "node:http";

import {
  AgenticStoreStreamRegistry,
  createAgenticStoreHttpApp,
} from "./http/routes.js";
import { createAgenticStoreRuntime } from "./runtime.js";

const runtime = createAgenticStoreRuntime();
const streams = new AgenticStoreStreamRegistry();
const app = createAgenticStoreHttpApp(runtime, streams);
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST?.trim() || "127.0.0.1";

if (!isLoopbackHost(host)) {
  throw new Error(
    "This local Agentic Store backend only binds to loopback. Add a production identity/TLS gateway before remote exposure.",
  );
}

runtime.start();
const server = createServer(app);
server.listen(port, host, () => {
  console.log(`[agentic-store] local backend listening on http://${host}:${port}`);
});

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[agentic-store] received ${signal}; shutting down`);
  streams.closeAll();
  server.closeIdleConnections();
  let forced = false;
  const forceShutdown = setTimeout(() => {
    forced = true;
    console.error("[agentic-store] graceful shutdown timed out");
    process.exitCode = 1;
    server.closeAllConnections();
  }, 10_000);
  forceShutdown.unref();
  server.close(async () => {
    await runtime.dispose();
    clearTimeout(forceShutdown);
    if (!forced) process.exitCode = 0;
  });
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

function isLoopbackHost(value: string): boolean {
  return ["127.0.0.1", "localhost", "::1"].includes(value);
}
