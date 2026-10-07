#!/usr/bin/env bash
set -euo pipefail
kind="${1:?store or factory}"
stage="${2:?absolute staging directory}"
case "$kind" in
  store) app=/home/ec2-user/Project_QSR; web=/home/ec2-user/frontend_app/build; service=qsr-routing-api; port=3010; nginx=/etc/nginx/conf.d/qsr.conf ;;
  factory) app=/opt/smart-factory; web=/var/www/smart-factory; service=smart-factory-server; port=3001; nginx=/etc/nginx/conf.d/smart-factory.conf ;;
  *) exit 2 ;;
esac
backup="$app/deploy-backups/edge-solutions-$(date -u +%Y%m%dT%H%M%SZ)"
sudo mkdir -p "$backup"
sudo chmod 700 "$backup"
sudo cp -a "$app/server/index.ts" "$backup/server-index.ts"
if sudo test -f "$app/.env"; then
  sudo cp -a "$app/.env" "$backup/server.env"
else
  sudo install -m 0600 /dev/null "$backup/server.env"
fi
sudo cp -a "$nginx" "$backup/nginx.conf"
sudo cp -a "$web/index.html" "$backup/index.html"
rollback() {
  echo "Release failed; restoring previous API, environment, Nginx and HTML."
  sudo cp -a "$backup/server-index.ts" "$app/server/index.ts"
  sudo cp -a "$backup/server.env" "$app/.env"
  sudo cp -a "$backup/nginx.conf" "$nginx"
  sudo cp -a "$backup/index.html" "$web/index.html"
  sudo systemctl restart "$service"
  sudo nginx -t && sudo systemctl reload nginx
}
trap rollback ERR
tar -xzf "$stage/release.tar.gz" -C "$stage"
sudo install -m 0644 "$stage/server/"*.ts "$app/server/"
sudo python3 - "$app" "$nginx" "$kind" "$stage/influx.env" <<'PY'
from pathlib import Path
import sys
app, nginx, kind, config = sys.argv[1:]
entry=Path(app)/'server/index.ts'
s=entry.read_text()
if "from './hardware-metrics-routes.js'" not in s:
    assert "import express from 'express';" in s
    s=s.replace("import express from 'express';", "import express from 'express';\nimport { registerHardwareMetricsRoutes } from './hardware-metrics-routes.js';")
    assert 'registerIpsecRoutes(app);' in s
    s=s.replace('registerIpsecRoutes(app);','registerHardwareMetricsRoutes(app);\nregisterIpsecRoutes(app);')
    entry.write_text(s)
env=Path(app)/'.env'
s='\n'.join(line for line in (env.read_text() if env.exists() else '').splitlines() if not line.startswith('INFLUX_'))
env.write_text(s+'\n'+Path(config).read_text())
env.chmod(0o600)
if kind == 'store':
    p=Path(nginx); s=p.read_text()
    if 'location = /api/hardware-metrics/anomalies' not in s:
        anchor='    location /socket.io/ {'
        assert anchor in s
        s=s.replace(anchor, '''    # Read-only EA:GLE telemetry, using server-only InfluxDB credentials.
    location = /api/hardware-metrics/anomalies {
        proxy_pass http://127.0.0.1:3010;
        proxy_set_header Host $host;
        proxy_cache off;
        proxy_read_timeout 30s;
    }

'''+anchor)
        p.write_text(s)
PY
service_user=$(systemctl show "$service" --property=User --value)
sudo chown "${service_user:-root}" "$app/.env"
sudo nginx -t
sudo systemctl restart "$service"
curl --fail --silent --show-error --retry 15 --retry-connrefused --retry-delay 1 "http://127.0.0.1:$port/api/health" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:$port/api/hardware-metrics/anomalies?start=-1h&window=1m" > "$stage/telemetry-check.json"
python3 - "$stage/telemetry-check.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
assert isinstance(d.get('points'),list) and isinstance(d.get('conntrack'),list)
print('Live API verified:', {k:len(d[k]) for k in ['points','reasonCodes','conntrack']})
PY
# Keep old hashed assets available for already-open sessions. Never touch widgets.
sudo cp -a "$stage/frontend/." "$web/"
sudo find "$web" -maxdepth 1 -type f -name 'capgemini.jpg' -exec chmod 644 {} +
sudo cp "$stage/index.html" "$web/index.html.next"
sudo chmod 644 "$web/index.html.next"
sudo mv "$web/index.html.next" "$web/index.html"
sudo systemctl reload nginx
trap - ERR
rm -f "$stage/influx.env"
echo "Deployment complete. Rollback: $backup"
