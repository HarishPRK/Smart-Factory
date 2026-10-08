#!/usr/bin/env bash
# Add the Dell Video Analytics routes to the incumbent Smart Factory backend.
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'Run this installer with sudo bash.' >&2; exit 1; }
[[ $# -eq 0 ]] || { echo 'This installer accepts no arguments.' >&2; exit 1; }

app=/opt/smart-factory
backup_parent=/opt
lock=/run/lock/smart-factory-dell-video-backend.lock
service=smart-factory-server.service
release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
modules=(video-routes.ts)
temporary=
backup=
changed=0

cleanup() {
  if [[ -n "$temporary" && -d "$temporary" && "$temporary" == "$app"/.dell-video-backend-update.* ]]; then
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
    if [[ $restore_failed -eq 0 ]]; then
      if systemctl restart "$service"; then
        echo 'Previous backend files restored; service restarted.' >&2
      else
        echo 'Previous backend files restored; check the service restart manually.' >&2
      fi
    else
      echo "Automatic restoration failed. Protected backup: $backup" >&2
    fi
  fi
  exit 1
}
trap 'fail "Dell Video Analytics backend update failed."' ERR

for command in systemctl curl python3 node readlink stat cp mv mktemp flock sha256sum; do
  command -v "$command" >/dev/null || fail "Required command is unavailable: $command"
done
exec 9>"$lock"
flock -n 9 || fail 'Another Dell Video Analytics backend update is running.'
[[ -d "$app/server" && $(readlink -f -- "$app") == "$app" &&
   $(readlink -f -- "$app/server") == "$app/server" ]] || fail 'Expected a real /opt/smart-factory/server directory.'
for file in "$app/server/index.ts" "$app/package.json"; do
  [[ -f "$file" && ! -L "$file" ]] || fail 'Expected regular backend entry and package files.'
done
for file in "${modules[@]}"; do
  [[ ! -L "$app/server/$file" && ( ! -e "$app/server/$file" || -f "$app/server/$file" ) ]] || fail 'A Dell Video Analytics module path is not a regular file.'
  [[ -f "$release/server/$file" && ! -L "$release/server/$file" ]] || fail 'A required Dell Video Analytics release module is missing.'
done
[[ -f "$release/SHA256SUMS" && ! -L "$release/SHA256SUMS" ]] || fail 'Release validation files are missing.'
(cd -- "$release" && sha256sum --check --strict --quiet SHA256SUMS) || fail 'Release checksums failed; no backend was changed.'
[[ $(systemctl show "$service" --property=LoadState --value) == loaded ]] || fail 'The documented backend service is not loaded.'
[[ $(systemctl show "$service" --property=WorkingDirectory --value) == "$app" ]] || fail 'The service WorkingDirectory differs from /opt/smart-factory.'
systemctl is-active --quiet "$service" || fail 'The backend service must be active before this update.'

# Check the existing runtime without loading environment values.
node --input-type=module - "$app" <<'JS'
import { createRequire } from 'node:module';
const app = process.argv[2];
const stop = (message) => { console.error(message); process.exit(1); };
if (Number(process.versions.node.split('.')[0]) < 18 || typeof fetch !== 'function') {
  stop('Node.js 18 or later with built-in fetch is required; no backend was changed.');
}
try {
  const require = createRequire(`${app}/package.json`);
  require.resolve('express');
  require.resolve('tsx');
} catch {
  stop('Existing Express and tsx dependencies must be available; no backend was changed.');
}
JS

http_status() {
  curl --silent --show-error --connect-timeout 3 --max-time "${2:-20}" \
    --output /dev/null --write-out '%{http_code}' "$1" || true
}
[[ $(http_status http://127.0.0.1:3001/api/health 5) == 200 ]] || fail 'Existing backend health check failed; no backend was changed.'

temporary=$(mktemp -d "$app/.dell-video-backend-update.XXXXXXXX")
cp -a -- "$app/server/index.ts" "$temporary/index.ts"
python3 - "$temporary/index.ts" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
content = path.read_bytes()
newline = b'\r\n' if b'\r\n' in content else b'\n'
import_pattern = rb'(?m)^[ \t]*import[ \t]+\{[ \t]*registerVideoRoutes[ \t]*\}[ \t]+from[ \t]+[\'\"]\./video-routes\.js[\'\"];?[ \t]*\r?$'
call_pattern = rb'(?m)^[ \t]*registerVideoRoutes\([ \t]*app[ \t]*\);?[ \t]*\r?$'
imports = list(re.finditer(import_pattern, content))
calls = list(re.finditer(call_pattern, content))
if len(imports) > 1 or len(calls) > 1:
    sys.exit('Repeated Dell Video Analytics route registration; no backend was changed.')
if not imports:
    anchor = list(re.finditer(rb'(?m)^[ \t]*import[ \t]+express[ \t]+from[ \t]+[\'\"]express[\'\"];?[ \t]*\r?$', content))
    if len(anchor) != 1:
        sys.exit('Cannot identify the Express import; no backend was changed.')
    position = anchor[0].end()
    # Consume the original line ending and append one new import line.
    if content[position:position + 1] == b'\n':
        position += 1
    content = content[:position] + b"import { registerVideoRoutes } from './video-routes.js';" + newline + content[position:]
if not calls:
    anchor = list(re.finditer(rb'(?m)^[ \t]*registerIpsecRoutes\([ \t]*app[ \t]*\);?[ \t]*\r?$', content))
    if len(anchor) != 1:
        sys.exit('Cannot identify the existing route registration; no backend was changed.')
    position = anchor[0].start()
    content = content[:position] + b'registerVideoRoutes(app);' + newline + content[position:]
path.write_bytes(content)
PY

backup=$(mktemp -d "$backup_parent/smart-factory-dell-video-backend.XXXXXXXX")
[[ $(stat -c %a "$backup") == 700 && $(stat -c %u "$backup") == "$EUID" ]] || fail 'Backup directory permissions are unsafe.'
mkdir "$backup/server"
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

# Load the updated video routes while preserving other backend integrations.
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
curl --fail --silent --show-error --connect-timeout 3 --max-time 10 \
  --output "$temporary/video-config.json" http://127.0.0.1:3001/api/video
python3 - "$temporary/video-config.json" <<'PY'
import json
from pathlib import Path
import sys
from urllib.parse import urlsplit

streams = json.loads(Path(sys.argv[1]).read_text())
if not isinstance(streams, list) or len(streams) != 13:
    sys.exit('Unexpected Video Analytics configuration; rolling back.')
for stream in streams:
    for key in ('upstream', 'stopUpstream'):
        value = stream.get(key)
        if value is None and key == 'stopUpstream':
            continue
        if not isinstance(value, str):
            sys.exit('Missing Dell video URL; rolling back.')
        parsed = urlsplit(value)
        if (parsed.scheme, parsed.netloc) != ('http', '192.168.10.148:5000'):
            sys.exit('Video URLs do not point to the requested Dell host. Check VIDEO_BASE_DELL; rolling back.')
PY
changed=0
echo 'Dell video routes installed; configured feed and stop URLs verified.'
echo 'Existing frontend, Nginx, bridge, dependencies and service configuration were untouched.'
echo "Protected backend backup: $backup"
