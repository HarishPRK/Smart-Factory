import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseCommandOrigin } from './bridge-command.mjs';

export function mergeControlOrigins(contents, requested) {
  if (!requested.length) throw new Error('Specify at least one dashboard --origin.');
  const origins = new Set();
  const add = (value) => {
    const origin = parseCommandOrigin(value.trim());
    if (!origin) throw new Error('Control origins must be exact HTTP(S) origins without credentials, paths or wildcards.');
    origins.add(origin.origin);
  };
  for (const content of contents) {
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?CONTROL_ALLOWED_ORIGINS\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      let value = match[1].replace(/\s+#.*$/, '').trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      value.split(',').map(part => part.trim()).filter(Boolean).forEach(add);
    }
  }
  requested.forEach(add);
  return `CONTROL_ALLOWED_ORIGINS=${[...origins].join(',')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const contents = [], requested = [];
  const args = process.argv.slice(2);
  try {
    for (let i = 0; i < args.length; i += 2) {
      if (!args[i + 1]) throw new Error('Missing configuration argument.');
      if (args[i] === '--origin') requested.push(args[i + 1]);
      else if (args[i] === '--config') {
        try { contents.push(readFileSync(args[i + 1], 'utf8')); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      } else throw new Error('Unknown configuration argument.');
    }
    process.stdout.write(mergeControlOrigins(contents, requested));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
