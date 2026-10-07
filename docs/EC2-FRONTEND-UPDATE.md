# Frontend-only update on the existing EC2 host

This release contains the new dashboard, Classic UI toggle, digital twins and
static widgets. Both interfaces use the existing PLC provider and live EC2 data
source. Switching UI changes presentation, not the connection or device state.

New UI telemetry, the in-twin sensor monitor and machine inspection use received
PLC values only. Missing inputs stay unavailable; retained readings become
`Last received` after 15 seconds without a matching channel update. Histories
contain actual receipts, and unrelated board packets do not refresh a silent
meter. Factory motion remains an explicitly modeled visualization.

The PLC panel retains three-column square instruments with distinct channel
colors and dimensional micro visualizations. LangGraph now uses a topic-based
investigation workspace, structured answers and a persistent multiline composer.
Its progress indicators follow actual request acceptance and response state.

New UI now highlights threshold breaches with machine/tower lights, a cell
boundary and hall wash. Configured stop effects pause the illustrated line;
recovery resumes its animation. Maintenance is explicitly a simulated exterior
inspection, not a worker dispatch or automatic alarm reset. No hardware commands
are sent by this response. The offline-only pressure-fault preview is under
Display settings → Simulation tools and is unavailable with live PLC input.

The installer replaces only `/var/www/smart-factory`. It keeps existing public
files, widgets and prior hashed assets, and creates a timestamped backup outside
the web root. It does not upload or edit server code, environment files, IoT
policies, Nginx configuration, systemd services or the cloud bridge. No service
restart is needed. Do not use the broader `deploy.sh` for this update.

## 1. Build and upload from your Windows computer

Run in PowerShell from the project directory after local changes are complete:

```powershell
node scripts/package-frontend-release.mjs
```

The build typechecks the host and Smart Meter and creates:

- `dist/releases/smart-factory-frontend.tar.gz`
- `dist/releases/smart-factory-frontend.tar.gz.sha256`

The release ignores development `.env` settings and inherited `VITE_*` variables.
It uses live PLC and meter connections through same-origin `/ws`, LangGraph
through `/langgraph`, and the existing same-origin `/api` integrations. It reads
only the public `VITE_SITEWISE_API_URL` and exact `VITE_METER_TOPIC` from
`.env.production`; the public SiteWise endpoint is preserved when configured.
No `.env` file or credentials are included. An optional explicit public SiteWise
endpoint can be supplied with `--sitewise-api https://YOUR-PUBLIC-ENDPOINT`.

Replace the key path below with your EC2 key. `ec2-user` follows the existing
deployment scripts; use your actual SSH login if different.

```powershell
scp -i "C:\path\to\your-key.pem" .\dist\releases\smart-factory-frontend.tar.gz .\dist\releases\smart-factory-frontend.tar.gz.sha256 ec2-user@3.239.12.96:~/
```

## 2. Run after logging into EC2

These commands assume the current Nginx frontend root is
`/var/www/smart-factory`, `/ws` already reaches the existing bridge, and the
existing `/api` and `/langgraph` proxies remain configured. The installer checks
the web root and current Nginx configuration before replacing files. It refuses
a symlinked web root or public files rather than guessing where to install.

```bash
cd "$HOME"
sha256sum -c smart-factory-frontend.tar.gz.sha256
release_dir="$HOME/smart-factory-frontend-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -m 700 "$release_dir"
tar -xzf smart-factory-frontend.tar.gz -C "$release_dir"
cd "$release_dir"
sha256sum --check --quiet SHA256SUMS
sudo bash install.sh
```

No `git pull`, `npm install` or `npm run build` is needed on EC2. The installer
validates checksums, stages the static files alongside the existing web root,
preserves the previous frontend, switches directories, then checks that Nginx
serves the installed entry document. If that final check fails, it restores the
previous frontend automatically.

## 3. Verify in the browser

Reload `http://3.239.12.96`, then switch between **New UI** and **Classic UI**.
Confirm both show matching real PLC readings and digital states, the connection
is live, and the Smart Meter opens its own visualization. The UI choice is
remembered only in that browser. The factory animation may still be modeled;
that does not turn modeled values into live PLC readings.

Do not click motor, relay or emergency commands just to verify the visual
deployment. Read-only telemetry and UI switching are sufficient for this check.

## Rollback

The installer prints a command containing the actual backup path. Copy and run
that exact command, for example:

```bash
sudo bash /var/www/.smart-factory-frontend-backups/BACKUP/rollback.sh /var/www/.smart-factory-frontend-backups/BACKUP
```

Rollback restores the old entry documents and static content while retaining
newer hashed assets for tabs that already loaded the new UI. It keeps the backup,
changes no backend or proxy settings, and checks the restored Nginx response.
Reload the browser afterwards. Keep the printed backup until the new release
has been accepted.
