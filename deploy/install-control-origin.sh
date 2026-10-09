#!/usr/bin/env bash
# Update origin recognition only. Never publish a PLC command as a health check.
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo 'Run with sudo.' >&2; exit 1; fi
if [[ $# -ne 2 || $1 != --origin ]]; then echo 'Usage: sudo bash install.sh --origin http://3.239.12.96' >&2; exit 1; fi
origin=$2
release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
bridge=/opt/smart-factory/scripts/bridge-command.mjs
config=/etc/smart-factory/control-origins.env
dropin=/etc/systemd/system/cloud-bridge.service.d/zz-control-origin.conf
test -f "$bridge"
test -f /opt/smart-factory/scripts/cloud-bridge.mjs
systemctl is-active --quiet cloud-bridge
[[ $(systemctl show cloud-bridge --property=WorkingDirectory --value) == /opt/smart-factory ]]
node --check "$release/bridge-command.mjs"
node --check "$release/configure-control-origins.mjs"
(cd "$release" && sha256sum --check --strict --quiet SHA256SUMS)

backup=$(mktemp -d /var/backups/smart-factory-control.XXXXXXXX)
chmod 0700 "$backup"
# The generated file contains only allowed origins, never other environment data.
node "$release/configure-control-origins.mjs" --config /opt/smart-factory/.env --config "$config" --origin "$origin" > "$backup/new-origins.env"
cp -a "$bridge" "$backup/bridge-command.mjs"
if [[ -e $config ]]; then cp -a "$config" "$backup/control-origins.env"; fi
if [[ -e $dropin ]]; then cp -a "$dropin" "$backup/zz-control-origin.conf"; fi

cat > "$backup/rollback.sh" <<'ROLLBACK'
#!/usr/bin/env bash
set -euo pipefail
backup=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cp -a "$backup/bridge-command.mjs" /opt/smart-factory/scripts/bridge-command.mjs
if [[ -f $backup/control-origins.env ]]; then cp -a "$backup/control-origins.env" /etc/smart-factory/control-origins.env; else rm -f /etc/smart-factory/control-origins.env; fi
if [[ -f $backup/zz-control-origin.conf ]]; then cp -a "$backup/zz-control-origin.conf" /etc/systemd/system/cloud-bridge.service.d/zz-control-origin.conf; else rm -f /etc/systemd/system/cloud-bridge.service.d/zz-control-origin.conf; fi
systemctl daemon-reload
systemctl restart cloud-bridge
ROLLBACK
rollback() { trap - ERR; echo "Installation failed; restoring $backup" >&2; bash "$backup/rollback.sh"; exit 1; }
trap rollback ERR
install -d -m 0755 /etc/smart-factory /etc/systemd/system/cloud-bridge.service.d
install -m 0600 "$backup/new-origins.env" "$config"
printf '[Service]\nEnvironmentFile=/etc/smart-factory/control-origins.env\n' > "$dropin"
chmod 0644 "$dropin"
install -m 0644 "$release/bridge-command.mjs" "$bridge"
systemctl daemon-reload
systemctl restart cloud-bridge

ready=false
for attempt in {1..15}; do
  if curl -fsS --max-time 3 http://127.0.0.1:9001/readyz 2>/dev/null | node -e '
    let data=""; process.stdin.on("data", chunk => data += chunk);
    process.stdin.on("end", () => { try { process.exit(JSON.parse(data).ready ? 0 : 1); } catch { process.exit(1); } });'; then ready=true; break; fi
  sleep 2
done
if [[ $ready != true ]]; then echo 'Cloud bridge did not become ready; restoring the previous configuration.' >&2; false; fi
trap - ERR
printf 'Command origin update installed for %s. No motor command was sent.\n' "$origin"
printf 'Reload the dashboard to reconnect. Rollback: sudo bash %q\n' "$backup/rollback.sh"
