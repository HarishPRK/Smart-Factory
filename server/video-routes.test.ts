// @vitest-environment node
import express from 'express';
import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { registerVideoRoutes } from './video-routes.js';

let server: Server;
let port: number;

beforeEach(async () => {
  vi.stubEnv('VIDEO_BASE_DELL', '');
  const app = express();
  registerVideoRoutes(app);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function call(path: string, method = 'GET'): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end();
  });
}

type Stream = { id: string; upstream: string; stopUpstream: string | null };

it('resolves every feed and stop to Dell despite obsolete vendor and stream overrides', async () => {
  vi.stubEnv('VIDEO_BASE_NVIDIA', 'http://old-gpu:5000');
  vi.stubEnv('VIDEO_BASE_HAILO', 'http://old-npu:5000');
  vi.stubEnv('VIDEO_UPSTREAM_NV_NANOOWL', 'http://old-feed:5000/nanoowl_feed');
  vi.stubEnv('VIDEO_STOP_UPSTREAM_NV_NANOOWL', 'http://old-stop:5000/stop_nanoowl');
  const outbound = vi.fn();
  vi.stubGlobal('fetch', outbound);
  const result = await call('/api/video');
  expect(result.status).toBe(200);
  const streams = result.body as Stream[];
  expect(streams).toHaveLength(13);
  for (const stream of streams) {
    expect(new URL(stream.upstream).origin).toBe('http://192.168.10.148:5000');
    if (stream.stopUpstream) expect(new URL(stream.stopUpstream).origin).toBe('http://192.168.10.148:5000');
  }
  expect(streams.find((stream) => stream.id === 'ha-fire')).toMatchObject({
    upstream: 'http://192.168.10.148:5000/firedetection_feed',
    stopUpstream: 'http://192.168.10.148:5000/stop_firedetection',
  });
  expect(outbound).not.toHaveBeenCalled();
});

it('uses the single configured Dell base for both feed and stop paths', async () => {
  vi.stubEnv('VIDEO_BASE_DELL', ' http://dell-mesh:5000/// ');
  const streams = (await call('/api/video')).body as Stream[];
  for (const stream of streams) {
    expect(new URL(stream.upstream).origin).toBe('http://dell-mesh:5000');
    if (stream.stopUpstream) expect(new URL(stream.stopUpstream).origin).toBe('http://dell-mesh:5000');
  }
});

it('forwards configured and additional stop APIs to Dell using mocked upstream requests', async () => {
  const outbound = vi.fn().mockImplementation(async () => new Response('{"stopped":true}', {
    headers: { 'content-type': 'application/json' },
  }));
  vi.stubGlobal('fetch', outbound);
  const stops = [
    ['nv-nanoowl', '/stop_nanoowl'],
    ['ha-fire', '/stop_firedetection'],
    ['ha-theft', '/stop_theft_detection'],
    ['ha-pet', '/stop_petmonitor'],
    ['ha-fall', '/stop_falldetection'],
  ];
  for (const [id, path] of stops) {
    expect(await call(`/api/video/${id}/stop`, 'POST')).toEqual({ status: 200, body: { stopped: true } });
    expect(outbound).toHaveBeenLastCalledWith(`http://192.168.10.148:5000${path}`, expect.objectContaining({ method: 'POST' }));
  }
});

it('rejects unknown stop IDs even if an obsolete per-stream override exists', async () => {
  vi.stubEnv('VIDEO_STOP_UPSTREAM_UNKNOWN', 'http://other-host:5000/stop');
  const outbound = vi.fn();
  vi.stubGlobal('fetch', outbound);
  expect((await call('/api/video/unknown/stop', 'POST')).status).toBe(404);
  expect(outbound).not.toHaveBeenCalled();
});
