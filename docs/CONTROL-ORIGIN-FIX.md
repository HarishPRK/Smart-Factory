# Motor command origin fix and fleet chart update

The local command failure came from opening the UI at `127.0.0.1` while the
configured WebSocket bridge is `ws://localhost:9001/`. The bridge now recognizes
`localhost`, `127.0.0.1`, and `::1` as loopback aliases. Unrelated origins,
malformed origins, and spoofed forwarded-host headers remain rejected.

On EC2, the installer explicitly allows `http://3.239.12.96`. This also works
when nginx forwards an internal Host to the bridge. It preserves existing
configured origins, writes a dedicated systemd environment override, backs up
the changed files, and restarts only `cloud-bridge`. It does not change MQTT
topics, IAM policies, E-stop checks, relay payload validation, or RFID rules.
No motor command is sent during installation or verification.

The frontend update restores fleet-wide Wi-Fi RSSI, cumulative data transfer,
connection mix, and health-by-device-type charts alongside the device inspector.
The graphs use received history; transfer is calculated from actual RX/TX
counter changes. All-device traces remain the default.

## Local app

Stop the existing local MQTT bridge with Ctrl+C in its terminal, then run:

```powershell
cd "C:\Users\haris\Projects\Smart-Factory"
npm run mqtt-bridge
```

If you deliberately run the cloud bridge locally instead, restart it with
`npm run cloud-bridge`. Restart the one you use, then reload the browser.
No frontend rebuild is needed for the bridge origin fix in local development.

## Upload the two releases from Windows

Both packages are built locally. These commands use the already-built files:

```powershell
cd "C:\Users\haris\Projects\Smart-Factory"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\upload-frontend-release.ps1 `
  -Destination 'ec2-user@3.239.12.96' `
  -IdentityFile 'C:\Users\haris\Downloads\SmartFactory.pem' `
  -WebRoot '/var/www/smart-factory' `
  -SkipBuild

scp -i "C:\Users\haris\Downloads\SmartFactory.pem" `
  .\dist\releases\smart-factory-control-origin.tar.gz `
  .\dist\releases\smart-factory-control-origin.tar.gz.sha256 `
  ec2-user@3.239.12.96:~/

ssh -i "C:\Users\haris\Downloads\SmartFactory.pem" ec2-user@3.239.12.96
```

Proceed only after both uploads succeed.

## Install inside EC2

```bash
set -euo pipefail
cd "$HOME"

sha256sum -c smart-factory-control-origin.tar.gz.sha256
control_release=$(mktemp -d "$HOME/smart-factory-control.XXXXXXXX")
tar -xzf smart-factory-control-origin.tar.gz -C "$control_release"
(cd "$control_release" && sha256sum --check --strict --quiet SHA256SUMS)
sudo bash "$control_release/install.sh" --origin http://3.239.12.96

sha256sum -c smart-factory-frontend.tar.gz.sha256
frontend_release=$(mktemp -d "$HOME/smart-factory-frontend.XXXXXXXX")
tar -xzf smart-factory-frontend.tar.gz -C "$frontend_release"
(cd "$frontend_release" && sha256sum --check --strict --quiet SHA256SUMS)
sudo bash "$frontend_release/install.sh" --web-root /var/www/smart-factory
```

Use Ctrl+Shift+R on the dashboard to reload and establish a new WebSocket
connection. The installers print their backup and rollback commands.
The control installer restores its prior files if the cloud bridge does not
become ready. A frontend-only deployment does not update this command check.

To rebuild after later source edits:

```powershell
node scripts/package-control-origin-release.mjs
node scripts/package-frontend-release.mjs
```
