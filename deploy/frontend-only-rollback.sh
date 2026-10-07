#!/usr/bin/env bash
# Restore a backup printed by frontend-only-install.sh. Static files only.
set -Eeuo pipefail

web_root=/var/www/smart-factory
web_parent=/var/www
backup_root=$web_parent/.smart-factory-frontend-backups
backup=${1:?Usage: sudo bash rollback.sh /var/www/.smart-factory-frontend-backups/BACKUP}
if [[ $EUID -ne 0 ]]; then echo 'Run rollback with sudo bash.' >&2; exit 1; fi
backup=$(realpath -e -- "$backup")
[[ "$backup" == "$backup_root"/* && ! -L "$backup_root" && -d "$backup/original" && ! -L "$backup/original" ]] || {
  echo 'Expected an intact backup created by the frontend installer.' >&2; exit 1;
}
[[ $(cat "$backup/web-root.txt") == "$web_root" && -s "$backup/original/index.html" ]] || {
  echo 'The backup does not match this frontend.' >&2; exit 1;
}
[[ -d "$web_root" && ! -L "$web_root" ]] || {
  echo 'Expected the existing frontend directory, not a symlink.' >&2; exit 1;
}
if [[ -n $(find "$web_root" "$backup/original" -type l -print -quit) ]]; then
  echo 'The frontend or backup contains symlinks; refusing an ambiguous restore.' >&2; exit 1;
fi
exec 9> "$web_parent/.smart-factory-frontend.lock"
flock -n 9 || { echo 'Another frontend install or rollback is running.' >&2; exit 1; }
nginx -t

stage=$(mktemp -d "$web_parent/.smart-factory-frontend-stage.XXXXXXXX")
failed_root="$backup/replaced-$(date -u +%Y%m%dT%H%M%SZ)-$$"
old_moved=false
restored=false
cleanup() {
  if [[ -n "$stage" && -d "$stage" && "$stage" == "$web_parent"/.smart-factory-frontend-stage.* ]]; then
    rm -rf -- "$stage"
  fi
}
recover() {
  local code=$?
  trap - ERR INT TERM
  if [[ "$restored" == true && -d "$web_root" ]]; then mv -- "$web_root" "$backup/failed-rollback-$$"; fi
  if [[ "$old_moved" == true && -d "$failed_root" ]]; then mv -- "$failed_root" "$web_root"; fi
  echo 'Rollback failed; the frontend that preceded rollback has been restored.' >&2
  exit "$code"
}
trap cleanup EXIT
trap recover ERR
trap 'false' INT TERM
cp -a -- "$backup/original/." "$stage/"

# Keep newer hashed chunks available to tabs that loaded the newer interface.
# Restore entry documents from the backup; never overlay the newer index.html.
while IFS= read -r -d '' assets; do
  relative=${assets#"$web_root"/}
  mkdir -p -- "$stage/$relative"
  cp -a -- "$assets/." "$stage/$relative/"
done < <(find "$web_root" -type d -name assets -print0)
chown -R --reference="$backup/original" "$stage"
chmod --reference="$backup/original" "$stage"
chmod -R a+rX "$stage"
mv -- "$web_root" "$failed_root"
old_moved=true
mv -- "$stage" "$web_root"
stage=
restored=true
curl --fail --silent --show-error --max-time 10 \
  "http://127.0.0.1/index.html?frontend_rollback=$(date +%s)" \
  | cmp -s - "$web_root/index.html"
trap - ERR INT TERM
echo "Previous frontend restored. Backup retained at $backup. Reload the browser."
