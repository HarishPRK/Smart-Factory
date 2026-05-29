/**
 * IPsec routes — registers /api/ipsec/snapshot, /api/ipsec/stream, and
 * /api/gateway/path on the Express app passed in. Requires `ipsecSource.ts`
 * + `ipsecProto.ts` to live alongside this file (or wherever, just fix the
 * import).
 *
 * Usage in your server entry:
 *
 *   import { registerIpsecRoutes } from './ipsec-routes.js';
 *   registerIpsecRoutes(app);
 *
 * Env vars consumed:
 *   IOT_PATH_CONTROL_TOPIC — IoT Core topic the com.rdk.pathcontrol Greengrass
 *                          component listens on (via the device's mqtt bridge)
 *                          to flip the active underlay. Default rdk/path/control.
 *                          /api/gateway/path publishes the Auto / Force-Fiber /
 *                          Force-5G command here and waits for the component ack.
 */

import type { Express } from 'express';
import { ipsecSource } from './ipsecSource.js';
import { pathControlSource } from './pathControlSource.js';

export function registerIpsecRoutes(app: Express): void {
  /** Current cached snapshot (hydrate-on-mount). */
  app.get('/api/ipsec/snapshot', (_req, res) => {
    res.json(ipsecSource.getSnapshot());
  });

  /** SSE stream — pushes every fresh update + a heartbeat. */
  app.get('/api/ipsec/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.socket?.setNoDelay(true);
    res.socket?.setKeepAlive(true);

    const emit = (event: string, data: Record<string, unknown>) => {
      if (!res.writable || res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    emit('snapshot', ipsecSource.getSnapshot());

    const offUpdate = ipsecSource.onUpdate((u) => emit('update', u as unknown as Record<string, unknown>));
    const offStatus = ipsecSource.onStatus((s) => emit('status', s as unknown as Record<string, unknown>));

    const hb = setInterval(() => {
      if (res.writable && !res.writableEnded) res.write(': hb\n\n');
    }, 15_000);

    req.on('close', () => {
      offUpdate();
      offStatus();
      clearInterval(hb);
      if (!res.writableEnded) res.end();
    });
  });

  /** POST /api/gateway/path — drives the DPS Auto / Force-Fiber / Force-5G
   *  button through the `com.rdk.pathcontrol` Greengrass component on the edge
   *  gateway. We publish the command to AWS IoT Core (rdk/path/control); the
   *  device's mqtt bridge relays it to the local broker the component listens
   *  on, the component applies it via its local :8090/api/path API, and acks on
   *  rdk/path/control/result. We forward that ack back to the browser. No
   *  direct LAN reachability to the gateway is needed. */
  app.post('/api/gateway/path', async (req, res) => {
    const mode = req.body?.mode;
    if (mode !== 'auto' && mode !== 'fiber' && mode !== '5g') {
      res.status(400).json({ error: `mode must be one of: auto, fiber, 5g (got ${JSON.stringify(mode)})` });
      return;
    }
    try {
      const result = await pathControlSource.setMode(mode);
      if (result.ok === false) {
        // The component reached the gateway but the gateway rejected the change.
        res.status(502).json({
          error: result.error ?? 'gateway rejected the mode change',
          mode,
          result,
        });
        return;
      }
      res.json({ ok: true, mode, result });
    } catch (err) {
      // Publish/connect failure, or no ack within the timeout window.
      // eslint-disable-next-line no-console
      console.error('[gateway-path] path-control error:', err);
      res.status(502).json({
        error: err instanceof Error ? err.message : String(err),
        topic: pathControlSource.status().controlTopic,
      });
    }
  });
}
