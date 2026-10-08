#!/usr/bin/env bash
# Run beside the two uploaded release archives and their checksum files.
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'Run with sudo bash.' >&2; exit 1; }
[[ $# -eq 0 ]] || { echo 'This installer accepts no arguments.' >&2; exit 1; }
release_home=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
stage=
cleanup() {
  if [[ -n "$stage" && -d "$stage" && "$stage" == /opt/smart-factory-dell-video-release.* &&
        $(readlink -f -- "$stage") == "$stage" ]]; then
    rm -rf -- "$stage"
  fi
}
trap cleanup EXIT
cd -- "$release_home"
for kind in video-backend frontend; do
  archive="smart-factory-$kind.tar.gz"
  [[ -f "$archive" && ! -L "$archive" && -f "$archive.sha256" && ! -L "$archive.sha256" ]] || {
    echo "Upload $archive and its checksum alongside this installer." >&2
    exit 1
  }
  sha256sum --check --strict "$archive.sha256"
done
stage=$(mktemp -d /opt/smart-factory-dell-video-release.XXXXXXXX)
for kind in video-backend frontend; do
  mkdir "$stage/$kind"
  tar -xzf "smart-factory-$kind.tar.gz" -C "$stage/$kind"
  (cd -- "$stage/$kind" && sha256sum --check --strict --quiet SHA256SUMS)
done
bash "$stage/video-backend/install.sh"
bash "$stage/frontend/install.sh" --web-root /var/www/smart-factory
echo 'Dell video backend and updated frontend installed. Reload Video Analytics.'
