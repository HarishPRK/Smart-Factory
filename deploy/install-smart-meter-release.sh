#!/usr/bin/env bash
# Run on the existing EC2 host after the operator applies the additive IAM policy.
set -euo pipefail

release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
widget=/var/www/smart-factory/widgets/aituzero-meter
bridge=/opt/smart-factory/scripts/cloud-bridge.mjs
helpers=(meter-wire.mjs meter-protobuf.mjs meter-energy.mjs)
if [[ $EUID -ne 0 ]]; then echo 'Run this installer with sudo.' >&2; exit 1; fi
test -d "$widget"
test -f "$bridge"
test -f /opt/smart-factory/scripts/bridge-command.mjs
test -s "$release/widget/index.html"
test -s "$release/cloud-bridge.mjs"
for helper in "${helpers[@]}"; do test -s "$release/$helper"; done
node --check "$release/cloud-bridge.mjs"
for helper in "${helpers[@]}"; do node --check "$release/$helper"; done
# Keep accumulated totals outside the release and preserve them across upgrades.
if [[ ! -d /opt/smart-factory/.local-data ]]; then
  install -d -o ec2-user -g ec2-user -m 0750 /opt/smart-factory/.local-data
fi
sudo -u ec2-user test -w /opt/smart-factory/.local-data
if [[ -e /opt/smart-factory/.local-data/meter-energy.json ]]; then
  sudo -u ec2-user test -w /opt/smart-factory/.local-data/meter-energy.json
fi
systemctl is-active --quiet cloud-bridge

backup=$(mktemp -d /var/backups/smart-meter-live.XXXXXXXX)
stage=$(mktemp -d /var/www/smart-factory/widgets/.meter-stage.XXXXXXXX)
cp -a "$bridge" "$backup/cloud-bridge.mjs"
for helper in "${helpers[@]}"; do
  if [[ -f "/opt/smart-factory/scripts/$helper" ]]; then cp -a "/opt/smart-factory/scripts/$helper" "$backup/$helper"; fi
done
# Preserve prior hashed assets for already-open browser sessions.
cp -a "$widget/." "$stage/"
cp -a "$release/widget/." "$stage/"
chown -R --reference="$widget" "$stage"
chmod -R a+rX "$stage"

rollback() {
  trap - ERR
  echo "Meter installation failed; restoring from $backup" >&2
  if [[ -d "$backup/original-widget" ]]; then
    if [[ -d "$widget" ]]; then mv "$widget" "$backup/failed-widget"; fi
    mv "$backup/original-widget" "$widget"
  fi
  cp -a "$backup/cloud-bridge.mjs" "$bridge"
  for helper in "${helpers[@]}"; do
    if [[ -f "$backup/$helper" ]]; then
      cp -a "$backup/$helper" "/opt/smart-factory/scripts/$helper"
    elif [[ -f "/opt/smart-factory/scripts/$helper" ]]; then
      mv "/opt/smart-factory/scripts/$helper" "$backup/failed-$helper"
    fi
  done
  systemctl restart cloud-bridge || true
  exit 1
}
trap rollback ERR
mv "$widget" "$backup/original-widget"
mv "$stage" "$widget"
cp "$release/cloud-bridge.mjs" "$bridge"
for helper in "${helpers[@]}"; do install -m 0644 "$release/$helper" "/opt/smart-factory/scripts/$helper"; done
systemctl restart cloud-bridge

ready=false
for attempt in {1..15}; do
  if curl -fsS --max-time 3 http://127.0.0.1:9001/readyz | node -e '
    let data = "";
    process.stdin.on("data", chunk => data += chunk);
    process.stdin.on("end", () => {
      try { const state = JSON.parse(data); process.exit(state.ready && state.meterSubscribed && !state.meterEnergyError ? 0 : 1); }
      catch { process.exit(1); }
    });'; then
    ready=true
    break
  fi
  sleep 2
done
if [[ $ready != true ]]; then
  echo 'Meter subscription is not ready. Check IAM permissions and bridge logs.' >&2
  false
fi
curl -fsS --max-time 5 --output /dev/null http://127.0.0.1/widgets/aituzero-meter/
trap - ERR
echo "Installed live meter. Backup: $backup"
echo 'Open the dashboard meter and verify a recent Last reading time and device values.'
echo 'Rollback, if needed:'
printf 'sudo cp -a %q/. %q/\n' "$backup/original-widget" "$widget"
printf 'sudo cp -a %q %q\n' "$backup/cloud-bridge.mjs" "$bridge"
for helper in "${helpers[@]}"; do
  if [[ -f "$backup/$helper" ]]; then
    printf 'sudo cp -a %q %q\n' "$backup/$helper" "/opt/smart-factory/scripts/$helper"
  fi
done
echo 'sudo systemctl restart cloud-bridge'
