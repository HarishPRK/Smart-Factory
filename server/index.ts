/**
 * Express server for Dynamic Path Selection + Video Analytics modals.
 * Run via `npm run dev:server` (uses `tsx watch`).
 *
 * Routes registered:
 *   GET  /api/ipsec/snapshot
 *   GET  /api/ipsec/stream         (SSE)
 *   POST /api/gateway/path
 *   POST /api/ipsec/insight        (SSE, Bedrock-powered)
 *   GET  /api/video                (list streams)
 *   GET  /api/video/:id            (MJPEG passthrough)
 *
 * dotenv MUST load before any other import that consumes env vars (the AWS
 * IoT SDK inside ipsecSource reads IOT_IPSEC_TOPIC / creds / endpoint at
 * module-load time). Because ESM hoists imports above top-level statements,
 * env loading lives in its own module that is imported FIRST below — that
 * guarantees it runs before ipsecSource et al. are evaluated.
 */

import './load-env.js';

import express from 'express';
import cors from 'cors';
import { registerIpsecRoutes } from './ipsec-routes.js';
import { registerIpsecInsightRoute } from './ipsec-insight-route.js';
import { registerVideoRoutes } from './video-routes.js';
import { ipsecSource } from './ipsecSource.js';
import { pathControlSource } from './pathControlSource.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

registerIpsecRoutes(app);
registerIpsecInsightRoute(app);
registerVideoRoutes(app);

const PORT = Number(process.env.PORT ?? 3001);
// Bind explicitly to IPv4 127.0.0.1 so it matches the Vite proxy target and
// avoids the Windows IPv6 (::1) / IPv4 localhost mismatch that yields ECONNREFUSED.
app.listen(PORT, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://127.0.0.1:${PORT}`);
  // Kick off the AWS IoT subscription — without this the dashboard never
  // receives any IPsec telemetry (this was the missing piece).
  void ipsecSource.start();
  // Pre-connect the path-control publisher so the rdk/path/control/result
  // subscription is live before the first DPS button press (it would otherwise
  // connect lazily on the first /api/gateway/path call). Swallow startup
  // errors — the route surfaces them per-request if creds are missing.
  void pathControlSource.start().catch(() => { /* logged inside start() */ });
});
