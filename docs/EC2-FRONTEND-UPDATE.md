# Frontend-only update on the existing EC2 host

This release contains the new dashboard, Classic UI toggle, digital twins and
static widgets. Both interfaces use the existing PLC provider and live EC2 data
source. Switching UI changes presentation, not the connection or device state.

The updated New UI also includes a vertical UNS hierarchy chart and compact tree
views, search, topic activity and payload inspection. UNS discovers only the
`prplHome/#` factory namespace (`prplHome` contains a lowercase letter **l**).
The `meter/data` topic remains exclusive to the separate Smart Meter and does
not appear in UNS. PLC Analytics includes interactive
received-data trends, distributions and nominal comparisons, with a clearly
labeled illustrative preview for the one-hour analog trend when genuine
historian data is unavailable. The package builds
the current local files, including uncommitted changes; it does not depend on a
commit, push or `git pull` on EC2.

New UI telemetry, the in-twin sensor monitor and machine inspection use received
PLC values only. Missing inputs stay unavailable; retained readings become
`Last received` after 15 seconds without a matching channel update. Received
histories contain actual receipts, and unrelated board packets do not refresh
a silent meter. The separate one-hour analog trend preview varies only inside
Analytics and identifies its source as `hourly-preview` in CSV exports and code.
It never changes PLC telemetry, stores, equipment alarms, digital channels or
shift comparisons. Other received series retain their actual values. Factory
motion remains an explicitly modeled visualization.

The PLC panel retains three-column square instruments with distinct channel
colors and dimensional micro visualizations. LangGraph now uses a topic-based
investigation workspace, structured answers and a persistent multiline composer.
Its progress indicators follow actual request acceptance and response state.
New UI LoRaWAN details open in a large centered dialog with device instruments
and trend comparison based only on real received packets.

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
.\scripts\upload-frontend-release.ps1 `
  -Destination 'ec2-user@3.239.12.96' `
  -IdentityFile 'C:\path\to\your-key.pem' `
  -WebRoot '/var/www/smart-factory'
```

Replace the key path with your EC2 key and use your actual SSH login if it differs
from `ec2-user`. Confirm that `/var/www/smart-factory` is the existing frontend
root; the script deliberately refuses another path. The wrapper builds and
checks the archive, then uploads only the archive and checksum to your login's
home directory. It prints the EC2 commands below, but does not run them remotely.

The build typechecks the host and Smart Meter and creates:

- `dist/releases/smart-factory-frontend.tar.gz`
- `dist/releases/smart-factory-frontend.tar.gz.sha256`

The release ignores development `.env` settings and inherited `VITE_*` variables.
It uses live PLC and meter connections through same-origin `/ws`, LangGraph
through `/langgraph`, and the existing same-origin `/api` integrations. It reads
only the public `VITE_SITEWISE_API_URL` and exact `VITE_METER_TOPIC` from
`.env.production`; the public SiteWise endpoint is preserved when configured.
No `.env` file or credentials are included. An optional explicit public SiteWise
endpoint can be supplied to the wrapper as
`-SiteWiseApi 'https://YOUR-PUBLIC-ENDPOINT'`.

To build without uploading, use the existing packaging script:

```powershell
node scripts/package-frontend-release.mjs
```

To upload that already-built release, add `-SkipBuild` to the wrapper command.
Use that option only after rebuilding for your latest local source changes.

If PowerShell blocks the script because of execution policy, use a separate
process without changing your saved policy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\upload-frontend-release.ps1 `
  -Destination 'ec2-user@3.239.12.96' `
  -IdentityFile 'C:\path\to\your-key.pem' `
  -WebRoot '/var/www/smart-factory'
```

## 2. Run after logging into EC2

These commands assume the current Nginx frontend root is
`/var/www/smart-factory`, `/ws` already reaches the existing bridge, and the
existing `/api` and `/langgraph` proxies remain configured. The installer checks
the explicit web root, current Nginx configuration and a matching served entry
document before replacing files. It refuses
a symlinked web root or public files rather than guessing where to install.

```bash
set -euo pipefail
cd "$HOME"
sha256sum -c smart-factory-frontend.tar.gz.sha256
release_dir=$(mktemp -d "$HOME/smart-factory-frontend.XXXXXXXX")
tar -xzf smart-factory-frontend.tar.gz -C "$release_dir"
cd "$release_dir"
sha256sum --check --strict --quiet SHA256SUMS
sudo bash install.sh --web-root /var/www/smart-factory
```

No `git pull`, `npm install` or `npm run build` is needed on EC2. The installer
validates checksums, stages the static files alongside the existing web root,
preserves the previous frontend, switches directories, then checks that Nginx
serves the installed entry document. If that final check fails, it restores the
previous frontend automatically.

## Separate EA:GLE upstream update

The frontend installer does not change the EC2 backend environment. To apply
the requested EA:GLE address, run the separate helper explicitly from the
extracted release directory after the frontend installation:

```bash
sudo bash update-eagle-influx-url.sh
```

The source helper is `deploy/update-eagle-influx-url.sh`. It requires the existing
active `smart-factory-server.service`, `WorkingDirectory=/opt/smart-factory` and
the single `EnvironmentFile=/opt/smart-factory/.env` entry (with or without the
systemd optional-file prefix `-`). The helper requires the file to exist. It backs up that file in a
root-only `/opt/smart-factory-eagle-env.*` directory outside the frontend web
root, preserves its owner and permissions, changes only `INFLUX_URL` to
`http://76.187.202.198:8086`, and restarts the backend service. A missing
`INFLUX_URL` is added using the file's newline style. Identical repeated
assignments are updated together; conflicting assignments are rejected before
the environment changes. It does not install
server code, dependencies or proxy configuration.

If the frontend already installed but an older helper reported
`Expected exactly one INFLUX_URL assignment`, upload only the corrected helper
from the Windows project directory:

```powershell
scp -i 'C:\path\to\your-key.pem' .\deploy\update-eagle-influx-url.sh ec2-user@3.239.12.96:~/update-eagle-influx-url.sh
```

Then run on EC2:

```bash
sudo bash "$HOME/update-eagle-influx-url.sh"
```

The earlier assignment check failed before writing the environment. There is
no need to reinstall or roll back the successfully installed frontend.

The helper checks localhost port 3001 at `/api/health` and
`/api/hardware-metrics/anomalies?start=-1h&window=1m` without displaying credentials
or telemetry responses. A failed restart or check restores the previous
environment and restarts the service. A 404 means this server lacks the EA:GLE
route and needs a backend route update; changing the address alone cannot add
that route. Keep the protected backup path printed by the helper.

### Recovery when the EA:GLE API returns 404

A successful frontend release does not add backend routes. A 404 from localhost
port 3001 at `/api/hardware-metrics/anomalies` means the incumbent Smart Factory
backend needs the read-only EA:GLE route. Connected Enterprise's separate
backend can already serve this data without this route being present in Smart
Factory.

The targeted recovery package contains only `hardware-metrics-routes.ts`,
`influxSource.ts`, `eagleTelemetry.ts`, the installer, and the explicit URL
helper. It adds the route import and registration to the deployed entry point,
preserving its other routes and environment loading. It does not replace the
whole backend entry point with the local version. Existing dependencies,
frontend files, Nginx, systemd configuration and the cloud bridge remain intact.

Build and upload from Windows PowerShell:

```powershell
node scripts/package-eagle-backend-release.mjs
scp -i 'C:\path\to\your-key.pem' .\dist\releases\smart-factory-eagle-backend.tar.gz .\dist\releases\smart-factory-eagle-backend.tar.gz.sha256 ec2-user@3.239.12.96:~/
```

Then run on EC2:

```bash
set -euo pipefail
cd "$HOME"
sha256sum -c smart-factory-eagle-backend.tar.gz.sha256
eagle_release=$(mktemp -d "$HOME/smart-factory-eagle-backend.XXXXXXXX")
tar -xzf smart-factory-eagle-backend.tar.gz -C "$eagle_release"
sudo bash "$eagle_release/install.sh"
```

The installer validates the existing service, Node.js 18 or later, installed
Express/tsx/dotenv, release checksums and a nonempty `INFLUX_TOKEN` in the existing
`/opt/smart-factory/.env`. If the token is missing, use `sudoedit` to configure
the existing Connected Enterprise server-side read token in that file and rerun
the installer. Preserve the other environment settings; never put the token in
the frontend or paste it into chat. Org and bucket settings remain unchanged
(the source defaults are `Capgemini` and `BGW620`).

Before replacing any source, it creates a root-only backup of the existing
entry point, any replaced EA:GLE modules, and environment. It loads the added
route, runs the explicit URL helper, and verifies both health and a successful
real query. A failed update restores all those files and the original
environment and restarts the previous backend. Modules that did not previously
exist are removed during rollback. The installer prints the protected backup
path after success. Reload EA:GLE in the browser after it completes.

## 3. Verify in the browser

### Dell Video Analytics update

Every video feed and configured stop API now uses one Dell inference host,
`http://192.168.10.148:5000`. The optional `VIDEO_BASE_DELL` setting controls this
shared base. Old `VIDEO_BASE_NVIDIA`, `VIDEO_BASE_HAILO`, `VIDEO_UPSTREAM_*` and
`VIDEO_STOP_UPSTREAM_*` settings are ignored. Known feed/stop endpoint paths and
historical stream IDs are preserved; stop endpoints without an existing mapping
are not invented. Both UI choices show the single Dell group.

Rebuild the two packages locally after source changes:

```powershell
node scripts/package-video-backend-release.mjs
node scripts/package-frontend-release.mjs
```

Upload both generated archives, their `.sha256` files, and
`deploy/install-dell-video-update.sh` to the EC2 login's home directory. Then run:

```bash
sudo bash "$HOME/install-dell-video-update.sh"
```

This validates both releases, installs only the video backend module and its
additive route registration, restarts the existing backend, and verifies that
the `/api/video` listing resolves all configured feed/stop URLs to the requested
Dell host. Backend failures restore the previous entry point/module. It then
runs the existing frontend-only installer for the Dell labels. The video update
does not depend on Influx credentials or run the EA:GLE helper. Environment
files, Nginx, systemd configuration and the cloud bridge remain untouched.
The listing check does not establish network reachability or start/stop an
inference pipeline. EC2 needs an existing network path to the Dell LAN host.

Reload `http://3.239.12.96`, then switch between **New UI** and **Classic UI**.
Confirm both show matching real PLC readings and digital states, the connection
is live, and the Smart Meter opens its own visualization. The UI choice is
remembered only in that browser. The factory animation may still be modeled;
that does not turn modeled values into live PLC readings.

Open **UNS Explorer** and verify its vertical chart and compact tree discover the
same received `prplHome/#` topics, without Smart Meter topics. Search a topic,
expand its branch and inspect its actual payload.
Open **PLC Analytics** and verify received series match telemetry. When genuine
one-hour analog history is unavailable, verify the fluctuating one-hour trace
appears under **Sensor trends**. Its CSV source remains `hourly-preview`; it does
not populate live telemetry or trigger machine alarms. Digital channels, shift
comparisons and other unavailable history retain their received-data or
unavailable state.

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
