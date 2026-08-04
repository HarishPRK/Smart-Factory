/**
 * Express server for Smart Factory integration modals.
 * Run via `npm run dev:server` (uses `tsx watch`).
 *
 * Routes registered:
 *   GET  /api/ipsec/snapshot
 *   GET  /api/ipsec/stream         (SSE)
 *   POST /api/gateway/path
 *   POST /api/ipsec/insight        (SSE, Bedrock-powered)
 *   GET  /api/aar/snapshot
 *   GET  /api/aar/stream           (SSE)
 *   POST /api/approute/publish     (binary AppRouteCommand)
 *   POST /api/approute/suggest
 *   POST /api/insight              (generic AI insight SSE)
 *   GET  /api/devices/snapshot
 *   GET  /api/devices/stream       (SSE)
 *   GET  /api/video                (list streams)
 *   GET  /api/video/:id            (MJPEG passthrough)
 *   POST /api/video/:id/stop       (stop upstream inference pipeline)
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
import { registerAppRouteRoutes } from './app-route-routes.js';
import { registerDeviceRoutes } from './device-routes.js';
import { registerGenericInsightRoute } from './generic-insight-route.js';
import { registerFactoryAIRoute } from './factory-ai-route.js';
import { registerVideoRoutes } from './video-routes.js';
import { ipsecSource } from './ipsecSource.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

registerIpsecRoutes(app);
registerIpsecInsightRoute(app);
registerAppRouteRoutes(app);
registerDeviceRoutes(app);
registerGenericInsightRoute(app);
registerFactoryAIRoute(app);
registerVideoRoutes(app);

const PORT = Number(process.env.PORT ?? 3001);
// Bind explicitly to IPv4 127.0.0.1 so it matches the Vite proxy target and
// avoids the Windows IPv6 (::1) / IPv4 localhost mismatch that yields ECONNREFUSED.
app.listen(PORT, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://127.0.0.1:${PORT}`);
  // Kick off the AWS IoT subscription — without this the dashboard never
  // receives IPsec, AAR, or device telemetry. This one connection also owns
  // rdk/prpl path-control and AppRoute publishes.
  void ipsecSource.start();
});
