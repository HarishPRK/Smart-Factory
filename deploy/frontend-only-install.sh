#!/usr/bin/env bash
# Static frontend only. Run with sudo after extracting the checked release.
set -Eeuo pipefail

release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
web_root=/var/www/smart-factory
web_parent=/var/www
requested_web_root=
while [[ $# -gt 0 ]]; do
  case $1 in
    --web-root)
      [[ $# -ge 2 ]] || { echo 'Missing value for --web-root.' >&2; exit 1; }
      requested_web_root=$2
      shift 2
      ;;
    --help)
      echo 'Usage: sudo bash install.sh --web-root /var/www/smart-factory'
      echo 'Updates only the existing static frontend at that documented Nginx root.'
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done
[[ "$requested_web_root" == "$web_root" ]] || {
  echo 'Confirm the current Nginx root, then pass --web-root /var/www/smart-factory.' >&2
  echo 'This installer deliberately refuses other frontend paths.' >&2
  exit 1
}
backup_root=$web_parent/.smart-factory-frontend-backups
stage=
backup=
old_moved=false
new_installed=false

if [[ $EUID -ne 0 ]]; then echo 'Run this installer with sudo bash.' >&2; exit 1; fi
for command in sha256sum flock curl nginx cmp; do
  command -v "$command" >/dev/null || { echo "Required command missing: $command" >&2; exit 1; }
done
[[ -d "$web_root" && ! -L "$web_root" && -s "$web_root/index.html" ]] || {
  echo "Expected the existing frontend directory at $web_root (not a symlink)." >&2; exit 1;
}
if [[ -n $(find "$web_root" -type l -print -quit) ]]; then
  echo 'The existing frontend contains symlinks; use a directory-based release before installing.' >&2; exit 1;
fi
[[ ! -L "$backup_root" ]] || { echo 'The backup directory must not be a symlink.' >&2; exit 1; }
exec 9> "$web_parent/.smart-factory-frontend.lock"
flock -n 9 || { echo 'Another frontend install or rollback is running.' >&2; exit 1; }

[[ -s "$release/SHA256SUMS" && -s "$release/frontend/index.html" ]] || {
  echo 'The release is incomplete. Extract the entire frontend archive first.' >&2; exit 1;
}
(cd "$release" && sha256sum --check --strict --quiet SHA256SUMS)
echo 'Release checksums verified.'
if [[ -n $(find "$release/frontend" -type l -print -quit) ]]; then
  echo 'The frontend payload must not contain symlinks.' >&2; exit 1;
fi
if [[ -n $(find "$release/frontend" -type f \( -name '.env' -o -name '.env.*' -o -name '*.pem' \) -print -quit) ]]; then
  echo 'The frontend payload contains a forbidden environment or key file.' >&2; exit 1;
fi
nginx -t

# Confirm this Nginx route serves the existing frontend before any file moves.
# A valid nginx.conf alone does not prove its selected server uses this root.
curl --fail --silent --show-error --max-time 10 \
  "http://127.0.0.1/index.html?frontend_preflight=$(date +%s)" \
  | cmp -s - "$web_root/index.html" || {
    echo 'Nginx does not serve the selected existing entry document on loopback port 80.' >&2
    echo 'No frontend files were changed. Check the active root/server configuration first.' >&2
    exit 1
  }

cleanup() {
  if [[ -n "$stage" && -d "$stage" && "$stage" == "$web_parent"/.smart-factory-frontend-stage.* ]]; then
    rm -rf -- "$stage"
  fi
}
restore_on_error() {
  local code=$?
  trap - ERR INT TERM
  echo 'Frontend installation failed; restoring the previous frontend.' >&2
  if [[ "$new_installed" == true && -d "$web_root" ]]; then
    mv -- "$web_root" "$backup/failed-frontend"
  fi
  if [[ "$old_moved" == true && -d "$backup/original" ]]; then
    mv -- "$backup/original" "$web_root"
  fi
  echo "Release diagnostics: ${backup:-no files changed}" >&2
  exit "$code"
}
trap cleanup EXIT
trap restore_on_error ERR
trap 'false' INT TERM

install -d -m 0700 "$backup_root"
backup=$(mktemp -d "$backup_root/$(date -u +%Y%m%dT%H%M%SZ).XXXXXXXX")
stage=$(mktemp -d "$web_parent/.smart-factory-frontend-stage.XXXXXXXX")

# Preserve existing widgets, deployment-specific public files and old hashed
# assets so already-open browser tabs can still request their original chunks.
cp -a -- "$web_root/." "$stage/"
cp -a -- "$release/frontend/." "$stage/"
chown -R --reference="$web_root" "$stage"
chmod --reference="$web_root" "$stage"
chmod -R a+rX "$stage"
cp -- "$release/release.json" "$backup/release.json"
cp -- "$release/rollback.sh" "$backup/rollback.sh"
printf '%s\n' "$web_root" > "$backup/web-root.txt"

# Both renames stay on the web root's filesystem. No service restart or Nginx
# reload is needed: the existing server serves the replacement static files.
mv -- "$web_root" "$backup/original"
old_moved=true
mv -- "$stage" "$web_root"
stage=
new_installed=true

curl --fail --silent --show-error --max-time 10 \
  "http://127.0.0.1/index.html?frontend_release=$(date +%s)" \
  | cmp -s - "$web_root/index.html"

trap - ERR INT TERM
echo 'Frontend updated. Backend, bridge, proxy configuration and services were untouched.'
echo "Backup: $backup"
echo 'Rollback command:'
printf 'sudo bash %q %q\n' "$backup/rollback.sh" "$backup"
echo 'Reload the browser and verify both UI choices show the same live telemetry.'
