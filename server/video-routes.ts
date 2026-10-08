/**
 * Video analytics routes — registers /api/video and /api/video/:id on the
 * Express app. Each :id maps to an MJPEG endpoint on the Dell inference
 * node; the server streams the multipart/x-mixed-replace body straight
 * through to the browser.
 *
 * Stream IDs (must match what VideoAnalytics.tsx requests):
 *   nv-nanoowl, nv-violence, nv-fall, nv-ppe, nv-table, nv-weapon, nv-parking
 *   ha-anpd, ha-intruder, ha-hairnet, ha-fire, ha-crowd, ha-drive
 *
 * All feeds and stop APIs use VIDEO_BASE_DELL, defaulting to the Dell LAN host.
 * Historical nv-/ha- IDs remain stable for existing browser/API links.
 *
 * On a cloud host, VIDEO_BASE_DELL can point to the Dell node's reachable
 * mesh/VPN address. Old vendor bases and per-stream overrides are ignored.
 *
 * Usage:
 *   import { registerVideoRoutes } from './video-routes.js';
 *   registerVideoRoutes(app);
 */

import type { Express } from 'express';

const VIDEO_DEFAULT_BASE = 'http://192.168.10.148:5000';

const VIDEO_STREAM_PATHS: Record<string, { path: string }> = {
  'nv-nanoowl':  { path: '/nanoowl_feed' },
  'nv-violence': { path: '/violence_feed' },
  'nv-fall':     { path: '/fall_feed' },
  'nv-ppe':      { path: '/ppe_feed' },
  'nv-table':    { path: '/table_feed' },
  'nv-weapon':   { path: '/weapon_feed' },
  'nv-parking':  { path: '/parking_feed' },
  'ha-anpd':     {  path: '/anpd_feed' },
  'ha-intruder': {  path: '/intruder_feed' },
  'ha-hairnet':  {  path: '/hairnetmonitor_feed' },
  'ha-fire':     {  path: '/firedetection_feed' },
  'ha-crowd':    {  path: '/crowd_feed' },
  'ha-drive':    {  path: '/drive_thru_monitor_stream' },
};

/** Upstream POST endpoints that explicitly stop an inference pipeline.
 *  The theft, pet-monitor, and alternate fall endpoints are registered even
 *  though those feeds do not currently have tiles in VideoAnalytics.tsx. */
const VIDEO_STOP_PATHS: Record<string, { path: string }> = {
  'nv-nanoowl':  { path: '/stop_nanoowl' },
  'nv-violence': { path: '/stop_violence' },
  'nv-fall':     { path: '/stop_fall' },
  'nv-ppe':      { path: '/stop_ppe_feed' },
  'ha-intruder': {  path: '/stop_intruder' },
  'ha-theft':    {  path: '/stop_theft_detection' },
  'ha-pet':      {  path: '/stop_petmonitor' },
  'ha-hairnet':  {  path: '/stop_hairnetmonitor' },
  'ha-fire':     {  path: '/stop_firedetection' },
  'ha-fall':     {  path: '/stop_falldetection' },
  'ha-crowd':    {  path: '/stop_crowddetection' },
};

function videoUrl(path: string): string {
  const base = process.env.VIDEO_BASE_DELL?.trim() || VIDEO_DEFAULT_BASE;
  return `${base.replace(/\/+$/, '')}${path}`;
}

function getVideoUpstream(id: string): string | null {
  const definition = VIDEO_STREAM_PATHS[id];
  return definition ? videoUrl(definition.path) : null;
}

function getVideoStopUpstream(id: string): string | null {
  const definition = VIDEO_STOP_PATHS[id];
  return definition ? videoUrl(definition.path) : null;
}
export function registerVideoRoutes(app: Express): void {
  /** List of configured streams + their resolved upstreams. Handy for debugging. */
  app.get('/api/video', (_req, res) => {
    res.json(
      Object.keys(VIDEO_STREAM_PATHS).map((id) => ({
        id,
        upstream: getVideoUpstream(id),
        stopUpstream: getVideoStopUpstream(id),
      })),
    );
  });

  /** Stop an upstream inference pipeline. Only explicitly configured IDs are
   *  accepted so this route cannot be used as an open POST proxy. */
  app.post('/api/video/:id/stop', async (req, res) => {
    const upstream = getVideoStopUpstream(req.params.id);
    if (!upstream) {
      res.status(404).json({ error: `No stop API configured for stream id: ${req.params.id}` });
      return;
    }

    try {
      const r = await fetch(upstream, {
        method: 'POST',
        headers: { Accept: 'application/json, text/plain, */*' },
        signal: AbortSignal.timeout(10_000),
      });
      const body = await r.text();

      if (!r.ok) {
        res.status(502).json({
          error: `stop API returned ${r.status}`,
          upstreamStatus: r.status,
          detail: body || undefined,
        });
        return;
      }

      const contentType = r.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      res.status(r.status);
      if (body) res.send(body);
      else res.end();
    } catch (err) {
      console.error(`[video-stop:${req.params.id}] upstream error:`, err);
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /** MJPEG passthrough. */
  app.get('/api/video/:id', async (req, res) => {
    const upstream = getVideoUpstream(req.params.id);
    if (!upstream) {
      res.status(404).json({ error: `Unknown stream id: ${req.params.id}` });
      return;
    }

    const ctrl = new AbortController();
    const onClose = () => ctrl.abort();
    req.on('close', onClose);

    try {
      const r = await fetch(upstream, { signal: ctrl.signal });
      if (!r.ok || !r.body) {
        if (!res.headersSent) res.status(502).json({ error: `upstream ${r.status}` });
        return;
      }

      // MJPEG = multipart/x-mixed-replace. Pass content-type and boundary verbatim.
      const ct = r.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'no-cache, no-transform, no-store');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      res.socket?.setNoDelay(true);
      res.socket?.setKeepAlive(true);

      const reader = r.body.getReader();
      while (!ctrl.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.writable || res.writableEnded) break;
        res.write(value);
      }
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        console.error(`[video-proxy:${req.params.id}] upstream error:`, err);
        if (!res.headersSent) {
          res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
        }
      }
    } finally {
      req.off('close', onClose);
      if (!res.writableEnded) res.end();
    }
  });
}
