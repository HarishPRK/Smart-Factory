/**
 * Dynamic Failover + Application-Aware Routing telemetry routes.
 *
 * The shared ipsecSource owns one AWS IoT connection for both rdk and prpl,
 * exposes the decoded IPsec cache, aggregates routing/* AAR protobuf events,
 * and publishes per-source path-control commands.
 */

import type { Express } from 'express';
import { ipsecSource } from './ipsecSource.js';

export function registerIpsecRoutes(app: Express): void {
  app.get('/api/ipsec/snapshot', (_req, res) => {
    res.json(ipsecSource.getSnapshot());
  });

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
    const offUpdate = ipsecSource.onUpdate((u) =>
      emit('update', u as unknown as Record<string, unknown>),
    );
    const offStatus = ipsecSource.onStatus((s) =>
      emit('status', s as unknown as Record<string, unknown>),
    );
    const heartbeat = setInterval(() => {
      if (res.writable && !res.writableEnded) res.write(': hb\n\n');
    }, 15_000);

    req.on('close', () => {
      offUpdate();
      offStatus();
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    });
  });

  /**
   * Body: { mode, source, tunnel? }
   * source selects rdk/path/control or prpl/path/control. The optional tunnel
   * pin is retained for gateways that support direct tunnel selection.
   */
  app.post('/api/gateway/path', async (req, res) => {
    const mode = req.body?.mode;
    const source = req.body?.source ?? 'rdk';
    const tunnel = typeof req.body?.tunnel === 'string' && req.body.tunnel.trim()
      ? req.body.tunnel.trim()
      : undefined;
    const validModes = ['auto', 'fiber', '5g', 'tunnel1', 'tunnel2', 'tunnel3', 'tunnel4'];

    if (!validModes.includes(mode)) {
      res.status(400).json({
        error: `mode must be one of: ${validModes.join(', ')} (got ${JSON.stringify(mode)})`,
      });
      return;
    }
    if (source !== 'rdk' && source !== 'prpl') {
      res.status(400).json({
        error: `source must be one of: rdk, prpl (got ${JSON.stringify(source)})`,
      });
      return;
    }

    const result = await ipsecSource.sendPathCommand(source, mode, 6000, tunnel);
    if (result.ok) {
      res.json({ ok: true, mode, source, tunnel, httpStatus: result.httpStatus });
    } else if (result.timedOut) {
      res.status(202).json({
        ok: false,
        mode,
        source,
        tunnel,
        pending: true,
        error: result.error,
      });
    } else {
      res.status(502).json({
        ok: false,
        mode,
        source,
        tunnel,
        error: result.error ?? 'path command failed',
      });
    }
  });

  app.get('/api/aar/snapshot', (_req, res) => {
    res.json(ipsecSource.getAarSnapshot());
  });

  app.get('/api/aar/stream', (req, res) => {
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

    emit('snapshot', ipsecSource.getAarSnapshot() as unknown as Record<string, unknown>);
    const offAar = ipsecSource.onAar((snapshot) =>
      emit('update', snapshot as unknown as Record<string, unknown>),
    );
    const heartbeat = setInterval(() => {
      if (res.writable && !res.writableEnded) res.write(': hb\n\n');
    }, 15_000);

    req.on('close', () => {
      offAar();
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    });
  });
}
