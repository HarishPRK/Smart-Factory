#!/usr/bin/env node
/** Transfer only EA:GLE settings through SSH stdin; never print/package tokens. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let destination;
let identityFile;
let source = join(project, '.env');
let checkOnly = false;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--help') {
    console.log('Usage: node scripts/upload-eagle-backend-release.mjs --destination USER@HOST --identity-file KEY.pem [--source ENV_FILE]');
    console.log('Use --check to validate local EA:GLE settings without any remote connection.');
    process.exit(0);
  }
  if (args[index] === '--check') { checkOnly = true; continue; }
  if (args[index] === '--destination' && args[index + 1]) { destination = args[++index]; continue; }
  if (args[index] === '--identity-file' && args[index + 1]) { identityFile = resolve(args[++index]); continue; }
  if (args[index] === '--source' && args[index + 1]) { source = resolve(args[++index]); continue; }
  throw new Error('Unknown or incomplete option. Use --help.');
}

function run(command, commandArgs, input) {
  const result = spawnSync(command, commandArgs, {
    cwd: project,
    stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    ...(input === undefined ? {} : { input, encoding: 'utf8' }),
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed; no remote installation was attempted.`);
  }
}

try {
  const env = parse(readFileSync(source));
  const settings = {
    INFLUX_URL: 'http://76.187.202.198:8086',
    INFLUX_ORG: env.INFLUX_ORG?.trim() || 'Capgemini',
    INFLUX_BUCKET: env.INFLUX_BUCKET?.trim() || 'BGW620',
    INFLUX_TOKEN: env.INFLUX_TOKEN?.trim() || '',
  };
  if (Object.values(settings).some((value) => !value || /[\r\n\0"\\]/.test(value))) {
    throw new Error('The local EA:GLE settings are missing or invalid. No token was printed or transferred.');
  }
  if (checkOnly) {
    console.log(JSON.stringify({ url: settings.INFLUX_URL, org: settings.INFLUX_ORG, bucket: settings.INFLUX_BUCKET, tokenPresent: true }));
    process.exit(0);
  }
  if (!destination || !/^[A-Za-z0-9_.-]+@[A-Za-z0-9.-]+$/.test(destination) ||
      !identityFile || !statSync(identityFile).isFile()) {
    throw new Error('Supply a USER@HOST destination and existing identity file. Use --help.');
  }

  run(process.execPath, [join(project, 'scripts/package-eagle-backend-release.mjs')]);
  const archive = join(project, 'dist/releases/smart-factory-eagle-backend.tar.gz');
  const checksum = `${archive}.sha256`;
  const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
  if (readFileSync(checksum, 'utf8').trim() !== `${digest}  smart-factory-eagle-backend.tar.gz`) {
    throw new Error('Backend archive checksum mismatch; nothing was uploaded.');
  }
  run('scp', ['-i', identityFile, archive, checksum, `${destination}:~/`]);
  const receiveSettings = `set -eu
umask 077
temporary=$(mktemp "$HOME/.eagle-influx-settings.XXXXXXXX")
trap 'rm -f -- "$temporary"' EXIT
cat > "$temporary"
chmod 600 "$temporary"
mv -f -- "$temporary" "$HOME/eagle-influx-settings.json"
trap - EXIT`;
  run('ssh', ['-i', identityFile, destination, receiveSettings], `${JSON.stringify(settings)}\n`);
  console.log('Backend archive and protected EA:GLE settings uploaded. The token was sent only through SSH stdin.');
  console.log('Run on EC2:');
  console.log('cd "$HOME"');
  console.log('sha256sum -c smart-factory-eagle-backend.tar.gz.sha256');
  console.log('eagle_release=$(mktemp -d "$HOME/smart-factory-eagle-backend.XXXXXXXX")');
  console.log('tar -xzf smart-factory-eagle-backend.tar.gz -C "$eagle_release"');
  console.log('sudo bash "$eagle_release/install.sh" --influx-settings "$HOME/eagle-influx-settings.json"');
} catch (error) {
  // Errors from filesystem/child tools must not dump configuration contents.
  if (error instanceof Error && /^(The local|Supply|Backend archive|(?:scp|ssh|.*node(?:\.exe)?) failed)/.test(error.message)) {
    console.error(error.message);
  } else {
    console.error('EA:GLE upload preparation failed. Check local settings, key path and SSH access. No token was printed.');
  }
  process.exitCode = 1;
}
