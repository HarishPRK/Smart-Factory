#!/usr/bin/env bash
# Add the read-only EA:GLE route to the incumbent Smart Factory backend.
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'Run this installer with sudo bash.' >&2; exit 1; }
[[ $# -eq 0 ]] || { echo 'This installer accepts no arguments.' >&2; exit 1; }

app=/opt/smart-factory
backup_parent=/opt
lock=/run/lock/smart-factory-eagle-backend.lock
service=smart-factory-server.service
release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
modules=(hardware-metrics-routes.ts influxSource.ts eagleTelemetry.ts)
temporary=
backup=
changed=0

cleanup() {
  if [[ -n "$temporary" && -d "$temporary" && "$temporary" == "$app"/.eagle-backend-update.* ]]; then
    rm -rf -- "$temporary"
  fi
}
trap cleanup EXIT

fail() {
  trap - ERR
  set +e
  echo "$1" >&2
  if [[ $changed -eq 1 ]]; then
    local restore_failed=0 file
    for file in index.ts "${modules[@]}"; do
      if [[ -f "$backup/server/$file" ]]; then
        cp -a -- "$backup/server/$file" "$temporary/restore-$file" &&
          mv -f -- "$temporary/restore-$file" "$app/server/$file" || restore_failed=1
      else
        rm -f -- "$app/server/$file" || restore_failed=1
      fi
    done
    cp -a -- "$backup/.env" "$temporary/restore-env" &&
      mv -f -- "$temporary/restore-env" "$app/.env" || restore_failed=1
    if [[ $restore_failed -eq 0 ]]; then
      if systemctl restart "$service"; then
        echo 'Previous backend files and environment restored; service restarted.' >&2
      else
        echo 'Previous backend files and environment restored; check the service restart manually.' >&2
      fi
    else
      echo "Automatic restoration failed. Protected backup: $backup" >&2
    fi
  fi
  exit 1
}
trap 'fail "EA:GLE backend update failed."' ERR

for command in systemctl curl python3 node readlink stat cp mv mktemp flock sha256sum; do
  command -v "$command" >/dev/null || fail "Required command is unavailable: $command"
done
exec 9>"$lock"
flock -n 9 || fail 'Another EA:GLE backend update is running.'
[[ -d "$app/server" && $(readlink -f -- "$app") == "$app" &&
   $(readlink -f -- "$app/server") == "$app/server" ]] || fail 'Expected a real /opt/smart-factory/server directory.'
for file in "$app/server/index.ts" "$app/.env" "$app/package.json"; do
  [[ -f "$file" && ! -L "$file" ]] || fail 'Expected regular backend entry, environment and package files.'
done
for file in "${modules[@]}"; do
  [[ ! -L "$app/server/$file" && ( ! -e "$app/server/$file" || -f "$app/server/$file" ) ]] || fail 'An EA:GLE module path is not a regular file.'
  [[ -f "$release/server/$file" && ! -L "$release/server/$file" ]] || fail 'A required EA:GLE release module is missing.'
done
[[ -f "$release/SHA256SUMS" && ! -L "$release/SHA256SUMS" &&
   -f "$release/update-eagle-influx-url.sh" && ! -L "$release/update-eagle-influx-url.sh" ]] || fail 'Release validation files are missing.'
(cd -- "$release" && sha256sum --check --strict --quiet SHA256SUMS) || fail 'Release checksums failed; no backend was changed.'
[[ $(systemctl show "$service" --property=LoadState --value) == loaded ]] || fail 'The documented backend service is not loaded.'
[[ $(systemctl show "$service" --property=WorkingDirectory --value) == "$app" ]] || fail 'The service WorkingDirectory differs from /opt/smart-factory.'
environment_files=$(systemctl show "$service" --property=EnvironmentFiles --value)
[[ "$environment_files" == "$app/.env (ignore_errors=no)" ||
   "$environment_files" == "$app/.env (ignore_errors=yes)" ]] || fail 'The service must use only the /opt/smart-factory/.env EnvironmentFile.'
systemctl is-active --quiet "$service" || fail 'The backend service must be active before this update.'

# Check existing runtime and credentials without printing environment values.
node --input-type=module - "$app" <<'JS'
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const app = process.argv[2];
const stop = (message) => { console.error(message); process.exit(1); };
if (Number(process.versions.node.split('.')[0]) < 18 || typeof fetch !== 'function') {
  stop('Node.js 18 or later with built-in fetch is required; no backend was changed.');
}
try {
  const require = createRequire(`${app}/package.json`);
  require.resolve('express');
  require.resolve('tsx');
  const values = require('dotenv').parse(readFileSync(`${app}/.env`));
  if (!(values.INFLUX_TOKEN || '').trim()) {
    stop('INFLUX_TOKEN is missing from /opt/smart-factory/.env. Configure the existing Connected Enterprise read token on this server, then rerun. No backend was changed.');
  }
} catch {
  stop('Existing Express, tsx and dotenv dependencies must be available; no backend was changed.');
}
JS

http_status() {
  curl --silent --show-error --connect-timeout 3 --max-time "${2:-20}" \
    --output /dev/null --write-out '%{http_code}' "$1" || true
}
[[ $(http_status http://127.0.0.1:3001/api/health 5) == 200 ]] || fail 'Existing backend health check failed; no backend was changed.'

temporary=$(mktemp -d "$app/.eagle-backend-update.XXXXXXXX")
cp -a -- "$app/server/index.ts" "$temporary/index.ts"
python3 - "$temporary/index.ts" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
content = path.read_bytes()
newline = b'\r\n' if b'\r\n' in content else b'\n'
import_pattern = rb'(?m)^[ \t]*import[ \t]+\{[ \t]*registerHardwareMetricsRoutes[ \t]*\}[ \t]+from[ \t]+[\'\"]\./hardware-metrics-routes\.js[\'\"];?[ \t]*\r?$'
call_pattern = rb'(?m)^[ \t]*registerHardwareMetricsRoutes\([ \t]*app[ \t]*\);?[ \t]*\r?$'
imports = list(re.finditer(import_pattern, content))
calls = list(re.finditer(call_pattern, content))
if len(imports) > 1 or len(calls) > 1:
    sys.exit('Repeated EA:GLE route registration; no backend was changed.')
if not imports:
    anchor = list(re.finditer(rb'(?m)^[ \t]*import[ \t]+express[ \t]+from[ \t]+[\'\"]express[\'\"];?[ \t]*\r?$', content))
    if len(anchor) != 1:
        sys.exit('Cannot identify the Express import; no backend was changed.')
    position = anchor[0].end()
    # Consume the original line ending and append one new import line.
    if content[position:position + 1] == b'\n':
        position += 1
    content = content[:position] + b"import { registerHardwareMetricsRoutes } from './hardware-metrics-routes.js';" + newline + content[position:]
if not calls:
    anchor = list(re.finditer(rb'(?m)^[ \t]*registerIpsecRoutes\([ \t]*app[ \t]*\);?[ \t]*\r?$', content))
    if len(anchor) != 1:
        sys.exit('Cannot identify the existing route registration; no backend was changed.')
    position = anchor[0].start()
    content = content[:position] + b'registerHardwareMetricsRoutes(app);' + newline + content[position:]
path.write_bytes(content)
PY

backup=$(mktemp -d "$backup_parent/smart-factory-eagle-backend.XXXXXXXX")
[[ $(stat -c %a "$backup") == 700 && $(stat -c %u "$backup") == "$EUID" ]] || fail 'Backup directory permissions are unsafe.'
mkdir "$backup/server"
cp -a -- "$app/.env" "$backup/.env"
cp -a -- "$app/server/index.ts" "$backup/server/index.ts"
for file in "${modules[@]}"; do
  if [[ -f "$app/server/$file" ]]; then
    cp -a -- "$app/server/$file" "$backup/server/$file"
    cp -a -- "$app/server/$file" "$temporary/$file"
    cat -- "$release/server/$file" > "$temporary/$file"
  else
    cp -- "$release/server/$file" "$temporary/$file"
    chmod 644 "$temporary/$file"
    chown --reference="$app/server/index.ts" "$temporary/$file"
  fi
done
changed=1
for file in "${modules[@]}" index.ts; do
  mv -f -- "$temporary/$file" "$app/server/$file"
done

# Load the new route first, including when INFLUX_URL is already correct.
systemctl restart "$service"
healthy=0
for attempt in {1..15}; do
  if systemctl is-active --quiet "$service" && [[ $(http_status http://127.0.0.1:3001/api/health 5) == 200 ]]; then
    healthy=1
    break
  fi
  sleep 1
done
[[ $healthy -eq 1 ]] || fail 'Backend health did not recover; rolling back.'
# The explicit URL helper updates only INFLUX_URL, restarts if necessary and
# checks the real endpoint. Its failure also triggers this backend rollback.
bash "$release/update-eagle-influx-url.sh"
status=$(http_status 'http://127.0.0.1:3001/api/hardware-metrics/anomalies?start=-1h&window=1m')
[[ $status == 200 ]] || fail "EA:GLE telemetry check failed (HTTP $status); rolling back."
changed=0
echo 'EA:GLE backend route installed and live query check passed.'
echo 'Existing frontend, Nginx, bridge, dependencies and service configuration were untouched.'
echo "Protected backend and environment backup: $backup"
