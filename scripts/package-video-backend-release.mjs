#!/usr/bin/env node
/** Package only the missing Dell video backend routes and its local dependencies. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let output = join(project, 'dist/releases/smart-factory-video-backend.tar.gz');
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--help') {
    console.log('Usage: node scripts/package-video-backend-release.mjs [--output FILE.tar.gz]');
    console.log('Packages the Dell video backend routes without rebuilding the frontend or reading environment files.');
    process.exit(0);
  }
  if (args[index] === '--output' && args[index + 1]) {
    output = resolve(args[++index]);
    continue;
  }
  throw new Error(`Unknown or incomplete option: ${args[index]}`);
}
if (!output.endsWith('.tar.gz') || /[\r\n\0]/.test(output)) {
  throw new Error('Output must be a .tar.gz path without control characters.');
}

const sources = [
  ['server/video-routes.ts', 'server/video-routes.ts'],
  ['deploy/install-dell-video-backend.sh', 'install.sh'],
];
const projectRoot = await realpath(project);
for (const [source] of sources) {
  const path = join(project, source);
  const details = await lstat(path);
  if (!details.isFile() || details.isSymbolicLink()) {
    throw new Error(`Release source must be a regular file: ${source}`);
  }
  const child = relative(projectRoot, await realpath(path));
  if (isAbsolute(child) || child === '..' || child.startsWith(`..${sep}`)) {
    throw new Error(`Release source escapes the project: ${source}`);
  }
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: project, stdio: 'pipe', encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status}): ${result.stderr || ''}`);
  }
  return result.stdout || '';
}
const digest = (data) => createHash('sha256').update(data).digest('hex');

const temporaryRoot = await realpath(tmpdir());
const temporary = await mkdtemp(join(temporaryRoot, 'smart-factory-video-backend-'));
try {
  const payload = join(temporary, 'release');
  await mkdir(join(payload, 'server'), { recursive: true });
  for (const [source, destination] of sources) {
    await copyFile(join(project, source), join(payload, destination));
  }
  const files = sources.map(([, destination]) => destination).sort();
  const checksums = [];
  for (const file of files) {
    checksums.push(`${digest(await readFile(join(payload, file)))}  ${file}`);
  }
  await writeFile(join(payload, 'SHA256SUMS'), `${checksums.join('\n')}\n`);

  const stagedArchive = join(temporary, 'smart-factory-video-backend.tar.gz');
  const expected = [...files, 'SHA256SUMS'];
  run('tar', ['-czf', stagedArchive, '-C', payload, ...expected]);
  const entries = run('tar', ['-tzf', stagedArchive]).trim().split(/\r?\n/);
  const allowed = new Set(expected);
  if (entries.length !== expected.length || new Set(entries).size !== expected.length ||
      entries.some((entry) => !allowed.has(entry) || isAbsolute(entry) ||
        entry.split(/[\\/]/).includes('..') || /(^|\/)\.env(?:\.|$)/.test(entry))) {
    throw new Error('Unexpected file or unsafe path found in the generated archive.');
  }

  const archiveHash = digest(await readFile(stagedArchive));
  await mkdir(dirname(output), { recursive: true });
  // Stage beside the final path so publication is a same-directory rename.
  const stagedOutput = `${output}.next`;
  await copyFile(stagedArchive, stagedOutput);
  await rename(stagedOutput, output);
  await writeFile(`${output}.sha256`, `${archiveHash}  ${basename(output)}\n`);
  console.log(`Dell video backend release ready: ${output}`);
  console.log(`Archive checksum: ${output}.sha256`);
  console.log('Contains the Dell video routes and the explicit backend installer.');
  console.log('No environment files, secrets, dependencies or frontend files were packaged.');
  console.log('No remote connection or AWS operation was performed.');
} finally {
  // Resolve and verify the exact temporary directory before recursive removal.
  const resolvedTemporary = await realpath(temporary);
  const child = relative(temporaryRoot, resolvedTemporary);
  if (!child.startsWith('smart-factory-video-backend-') || child.includes(sep) ||
      isAbsolute(child) || child === '..') {
    throw new Error('Refusing to clean an unexpected temporary directory.');
  }
  await rm(resolvedTemporary, { recursive: true, force: true });
}
