#!/usr/bin/env bash
# Separate, explicit backend environment update; never run by the frontend installer.
set -Eeuo pipefail
umask 077
if [[ $EUID -ne 0 ]]; then echo 'Run this helper with sudo bash.' >&2; exit 1; fi
[[ $# -eq 0 ]] || { echo 'This helper accepts no arguments.' >&2; exit 1; }

app=/opt/smart-factory
backup_parent=/opt
lock=/run/lock/smart-factory-eagle-env.lock
service=smart-factory-server.service
env_file=$app/.env
target=http://76.187.202.198:8086
temporary=
backup=
changed=0

cleanup() { [[ -z "$temporary" || ! -f "$temporary" ]] || rm -f -- "$temporary"; }
trap cleanup EXIT

fail() {
  trap - ERR
  set +e
  echo "$1" >&2
  if [[ $changed -eq 1 ]]; then
    temporary=$(mktemp "$app/.eagle-env-rollback.XXXXXXXX")
    if cp -a -- "$backup/.env" "$temporary" && mv -f -- "$temporary" "$env_file"; then
      temporary=
      if systemctl restart "$service" && systemctl is-active --quiet "$service"; then
        echo 'Previous environment restored and service restarted.' >&2
      else
        echo 'Previous environment restored; check the service restart manually.' >&2
      fi
    else
      echo "Automatic restoration failed. Protected backup: $backup/.env" >&2
    fi
  fi
  exit 1
}
trap 'fail "EA:GLE environment update failed."' ERR

for command in systemctl curl python3 readlink stat cp mv mktemp flock cmp; do
  command -v "$command" >/dev/null || fail "Required command is unavailable: $command"
done
exec 9>"$lock"
flock -n 9 || fail 'Another EA:GLE environment update is running.'
[[ -d "$app" && $(readlink -f -- "$app") == "$app" ]] || fail 'Expected a real /opt/smart-factory directory.'
[[ -f "$env_file" && ! -L "$env_file" ]] || fail 'Expected a regular /opt/smart-factory/.env file.'
[[ $(systemctl show "$service" --property=LoadState --value) == loaded ]] || fail 'The documented backend service is not loaded.'
[[ $(systemctl show "$service" --property=WorkingDirectory --value) == "$app" ]] || fail 'The service WorkingDirectory differs from /opt/smart-factory.'
environment_files=$(systemctl show "$service" --property=EnvironmentFiles --value)
[[ "$environment_files" == "$env_file (ignore_errors=no)" || "$environment_files" == "$env_file (ignore_errors=yes)" ]] || fail 'The service must use only the /opt/smart-factory/.env EnvironmentFile.'
systemctl is-active --quiet "$service" || fail 'The backend service must be active before this update.'

http_status() {
  curl --silent --show-error --connect-timeout 3 --max-time "${2:-20}" \
    --output /dev/null --write-out '%{http_code}' "$1" || true
}
check_telemetry() {
  local status
  status=$(http_status 'http://127.0.0.1:3001/api/hardware-metrics/anomalies?start=-1h&window=1m')
  if [[ $status == 404 ]]; then
    fail 'EA:GLE API route is absent (404); a backend route update is required.'
  fi
  [[ $status == 200 ]] || fail "EA:GLE telemetry check failed (HTTP $status)."
}
[[ $(http_status http://127.0.0.1:3001/api/health 5) == 200 ]] || fail 'Existing backend health check failed; no environment was changed.'

# Add or update only INFLUX_URL, preserving unrelated bytes, owner and permission.
temporary=$(mktemp "$app/.eagle-env-update.XXXXXXXX")
cp -a -- "$env_file" "$temporary"
python3 - "$temporary" "$target" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
content = path.read_bytes()
lines = content.splitlines(keepends=True)
pattern = re.compile(rb'^([ \t]*(?:export[ \t]+)?INFLUX_URL[ \t]*=[ \t]*)([^\r\n]*)(\r?\n)?$')
matches = [(index, pattern.fullmatch(line)) for index, line in enumerate(lines)]
matches = [(index, match) for index, match in matches if match]

def assignment_value(raw):
    value = raw.strip()
    if value.startswith((b'"', b"'")):
        quoted = re.fullmatch(rb"([\"'])(.*?)\1[ \t]*(?:#.*)?", value)
        if not quoted:
            sys.exit('Cannot safely compare repeated INFLUX_URL assignments; no environment was changed.')
        return quoted.group(2)
    return value.split(b'#', 1)[0].strip()

if len(matches) > 1:
    values = {assignment_value(match.group(2)) for _, match in matches}
    if len(values) != 1:
        sys.exit('Conflicting INFLUX_URL assignments; no environment was changed.')

target = sys.argv[2].encode('ascii')
if matches:
    for index, match in matches:
        lines[index] = match.group(1) + target + (match.group(3) or b'')
    updated = b''.join(lines)
else:
    newline_match = re.search(rb'\r?\n', content)
    newline = newline_match.group(0) if newline_match else b'\n'
    separator = newline if content and not content.endswith(b'\n') else b''
    updated = content + separator + b'INFLUX_URL=' + target + newline
path.write_bytes(updated)
PY
if cmp -s -- "$env_file" "$temporary"; then
  check_telemetry
  echo 'EA:GLE already uses the requested address and localhost checks passed; no restart needed.'
  exit 0
fi

backup=$(mktemp -d "$backup_parent/smart-factory-eagle-env.XXXXXXXX")
[[ $(stat -c %a "$backup") == 700 && $(stat -c %u "$backup") == "$EUID" ]] || fail 'Backup directory permissions are unsafe.'
cp -a -- "$env_file" "$backup/.env"
changed=1
mv -f -- "$temporary" "$env_file"
temporary=
systemctl restart "$service"

healthy=0
for attempt in {1..10}; do
  if systemctl is-active --quiet "$service" && [[ $(http_status http://127.0.0.1:3001/api/health 5) == 200 ]]; then
    healthy=1
    break
  fi
  sleep 1
done
[[ $healthy -eq 1 ]] || fail 'Backend health did not recover; rolling back.'
check_telemetry
changed=0
echo "EA:GLE upstream updated and localhost checks passed. Protected backup: $backup/.env"
