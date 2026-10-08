#!/usr/bin/env node
/** Build a static-only EC2 release without loading local development secrets. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile, copyFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { build } from 'vite';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let output = resolve(project, 'dist/releases/smart-factory-frontend.tar.gz');
let sitewiseOverride;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--help') {
    console.log('Usage: node scripts/package-frontend-release.mjs [--output FILE.tar.gz] [--sitewise-api HTTPS_URL]');
    console.log('Builds the dashboard and meter for the existing EC2 /ws, /api and /langgraph routes.');
    process.exit(0);
  }
  if (args[i] === '--output' && args[i + 1]) { output = resolve(args[++i]); continue; }
  if (args[i] === '--sitewise-api' && args[i + 1]) { sitewiseOverride = args[++i]; continue; }
  throw new Error(`Unknown or incomplete option: ${args[i]}`);
}
if (!output.endsWith('.tar.gz')) throw new Error('Output must end in .tar.gz.');

// Read only these existing PUBLIC frontend settings. dotenv.parse does not
// populate process.env; no other .env/.env.production variables are passed on.
let production = {};
try { production = parse(await readFile(join(project, '.env.production'))); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const sitewiseApi = (sitewiseOverride ?? production.VITE_SITEWISE_API_URL ?? '').trim();
if (sitewiseApi) {
  let url;
  try { url = new URL(sitewiseApi); }
  catch { throw new Error('The configured public SiteWise endpoint is not a valid URL.'); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      host === 'localhost' || host === '::1' || host === '0.0.0.0' || host.endsWith('.local') ||
      (host.includes(':') && /^(?:fc|fd|fe[89ab])/i.test(host)) ||
      /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)) {
    throw new Error('SiteWise must be a public HTTPS endpoint without credentials, query parameters or fragments.');
  }
}
const meterTopic = (production.VITE_METER_TOPIC || 'meter/data').trim();
if (!/^[A-Za-z0-9_./:-]{1,256}$/.test(meterTopic) || meterTopic.includes('..')) {
  throw new Error('The production meter topic must be an exact MQTT topic, without wildcards.');
}
const publicEnv = {
  VITE_PLC_MODE: 'mosquitto',
  VITE_MQTT_BRIDGE_URL: '',
  VITE_PLC_DEBUG: 'false',
  VITE_METER_TRANSPORT: 'websocket',
  VITE_METER_URL: '',
  VITE_METER_TOPIC: meterTopic,
  VITE_LANGGRAPH_API_BASE: '/langgraph',
  VITE_AI_PROXY_URL: '/api/factory-ai',
  ...(sitewiseApi ? { VITE_SITEWISE_API_URL: sitewiseApi } : {}),
};
for (const key of Object.keys(process.env)) {
  if (key.startsWith('VITE_') || key === 'BASE_PATH') delete process.env[key];
}
Object.assign(process.env, publicEnv);
process.env.NODE_ENV = 'production';

function run(command, commandArgs, capture = false) {
  const result = spawnSync(command, commandArgs, {
    cwd: project, env: process.env, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}).${capture ? ` ${result.stderr || ''}` : ''}`);
  return result.stdout || '';
}
async function filesAt(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlink is not allowed in a frontend release: ${name}`);
    if (entry.isDirectory()) files.push(...await filesAt(join(directory, entry.name), name));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Unexpected file type: ${name}`);
  }
  return files.sort();
}
const digest = (data) => createHash('sha256').update(data).digest('hex');

const temporaryRoot = await realpath(tmpdir());
const temporary = await mkdtemp(join(temporaryRoot, 'smart-factory-frontend-'));
try {
  const payload = join(temporary, 'release');
  const frontend = join(payload, 'frontend');
  const emptyEnv = join(temporary, 'empty-env');
  await mkdir(emptyEnv);
  await mkdir(payload);

  console.log('Checking dashboard and Smart Meter types...');
  run(process.execPath, [join(project, 'node_modules/typescript/bin/tsc'), '-b']);
  run(process.execPath, [join(project, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', 'smart-meter-widget/tsconfig.json']);
  console.log('Building the EC2 frontend with live same-origin transports...');
  await build({ root: project, configFile: join(project, 'vite.config.ts'), envDir: emptyEnv, mode: 'frontend-release', base: '/', build: { outDir: frontend, emptyOutDir: true, sourcemap: false } });
  // Override the checked-in development widget build with the release-mode one.
  await build({ configFile: join(project, 'smart-meter-widget/vite.config.ts'), envDir: emptyEnv, mode: 'frontend-release', build: { outDir: join(frontend, 'widgets/aituzero-meter'), emptyOutDir: true, sourcemap: false } });

  const releaseId = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const commit = run('git', ['rev-parse', 'HEAD'], true).trim();
  const dirty = Boolean(run('git', ['status', '--porcelain'], true).trim());
  const index = join(frontend, 'index.html');
  await writeFile(index, `${await readFile(index, 'utf8')}\n<!-- Smart Factory frontend release ${releaseId} -->\n`);
  await copyFile(join(project, 'deploy/frontend-only-install.sh'), join(payload, 'install.sh'));
  await copyFile(join(project, 'deploy/frontend-only-rollback.sh'), join(payload, 'rollback.sh'));
  await writeFile(join(payload, 'release.json'), `${JSON.stringify({
    releaseId, builtAt: new Date().toISOString(), sourceCommit: commit, includesUncommittedChanges: dirty,
    scope: 'static frontend only', plcTransport: 'mosquitto /ws', meterTransport: 'websocket /ws',
    meterTopic, langgraphBase: '/langgraph', sitewiseConfigured: Boolean(sitewiseApi),
  }, null, 2)}\n`);
  await writeFile(join(payload, 'README.txt'), 'Run sha256sum -c SHA256SUMS, then sudo bash install.sh --web-root /var/www/smart-factory on the existing EC2 host.\nConfirm that this is the active Nginx frontend root before installation.\nNo Node.js, npm, backend update, bridge restart or Nginx configuration change is required.\nThe installer prints the backup path and exact rollback command. See docs/EC2-FRONTEND-UPDATE.md in the source checkout.\n');
  const files = await filesAt(payload);
  for (const file of files) {
    if (/(^|\/)\.env(?:\.|$)/.test(file) || /\.pem$/i.test(file) || /^(?:server|src|node_modules)\//.test(file)) {
      throw new Error(`Forbidden file in static release: ${file}`);
    }
  }
  const checksums = [];
  for (const file of files) checksums.push(`${digest(await readFile(join(payload, file)))}  ${file}`);
  await writeFile(join(payload, 'SHA256SUMS'), `${checksums.join('\n')}\n`);
  await mkdir(dirname(output), { recursive: true });
  const stagedArchive = join(temporary, 'smart-factory-frontend.tar.gz');
  run('tar', ['-czf', stagedArchive, '-C', payload, 'frontend', 'install.sh', 'rollback.sh', 'release.json', 'README.txt', 'SHA256SUMS']);
  const entries = run('tar', ['-tzf', stagedArchive], true).trim().split(/\r?\n/);
  if (entries.some((entry) => isAbsolute(entry) || entry.split(/[\\/]/).includes('..') || /(^|\/)\.env(?:\.|$)/.test(entry))) {
    throw new Error('Unexpected unsafe path found in generated archive.');
  }
  const archiveHash = digest(await readFile(stagedArchive));
  // Copy the verified archive next to the final path, then replace it with a
  // same-directory rename so a failed build never overwrites a good release.
  const stagedOutput = `${output}.next`;
  await copyFile(stagedArchive, stagedOutput);
  await rename(stagedOutput, output);
  await writeFile(`${output}.sha256`, `${archiveHash}  ${output.split(/[\\/]/).at(-1)}\n`);
  console.log(`\nRelease ready: ${output}`);
  console.log(`Archive checksum: ${output}.sha256`);
  console.log(`Static files: ${files.length}; SiteWise public endpoint: ${sitewiseApi ? 'preserved' : 'not configured'}.`);
  console.log('No remote connection or AWS operation was performed.');
} finally {
  // Delete only the verified temporary directory created by this invocation.
  const resolvedTemporary = await realpath(temporary);
  const child = relative(temporaryRoot, resolvedTemporary);
  if (!child.startsWith(`smart-factory-frontend-`) || child.includes(sep) || isAbsolute(child) || child === '..') {
    throw new Error('Refusing to clean an unexpected temporary directory.');
  }
  await rm(resolvedTemporary, { recursive: true, force: true });
}
