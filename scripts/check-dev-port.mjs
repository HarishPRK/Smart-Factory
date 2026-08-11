import net from "node:net";

const port = Number(process.argv[2] ?? 5173);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`[dev] Invalid port: ${process.argv[2] ?? ""}`);
  process.exit(1);
}

const occupied = await new Promise((resolve, reject) => {
  const socket = net.createConnection({ host: "127.0.0.1", port });

  socket.setTimeout(500);
  socket.once("connect", () => {
    socket.destroy();
    resolve(true);
  });
  socket.once("timeout", () => {
    socket.destroy();
    resolve(false);
  });
  socket.once("error", (error) => {
    socket.destroy();
    if (error.code === "ECONNREFUSED") resolve(false);
    else reject(error);
  });
});

if (occupied) {
  console.error(
    `[dev] Port ${port} is already serving an app on localhost.\n` +
      "[dev] Reuse that app or stop its terminal before starting another Vite instance.\n" +
      "[dev] This guard prevents a stale mock-mode server from shadowing the current PLC configuration.",
  );
  process.exit(1);
}
