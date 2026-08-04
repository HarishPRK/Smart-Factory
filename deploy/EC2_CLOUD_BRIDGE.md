# EC2 Cloud Bridge — Live Data to a Remote-Hosted Dashboard

Get factory PLC telemetry to an EC2-hosted dashboard in ~50 ms (measured), with
no Lambda, no certs, and no per-message compute. Every hop is a persistent
connection.

```
FACTORY LAN                         AWS us-east-1
PLC → Mosquitto → edge-republish ──(SigV4 publish)──▶ IoT Core
                                                         │
                                          (SigV4 subscribe, intra-region ~1-5ms)
                                                         ▼
                                       EC2: cloud-bridge ──WS──▶ nginx ──▶ browser
                                            + serves React bundle
```

Three moving parts:
1. **Factory:** `npm run edge-republish` — mirrors local `plc/#` + `lorawan/#` up to IoT Core.
2. **EC2:** `npm run cloud-bridge` — subscribes IoT Core, fans out to browsers over WS (port 9001, proxied as `/ws` by nginx).
3. **EC2:** nginx serves the static dashboard and proxies `/ws` → cloud-bridge.

---

## Step 1 — IAM permissions

These use SigV4, so authorization is via **IAM policies**, not IoT cert
policies.

**EC2 instance role** (preferred over static keys — attach to the instance):
```json
{ "Version": "2012-10-17", "Statement": [
  { "Effect": "Allow", "Action": "iot:Connect",
    "Resource": "arn:aws:iot:us-east-1:841019700679:client/cloud-bridge-*" },
  { "Effect": "Allow", "Action": "iot:Subscribe",
    "Resource": [
      "arn:aws:iot:us-east-1:841019700679:topicfilter/plc/*",
      "arn:aws:iot:us-east-1:841019700679:topicfilter/lorawan/*" ] },
  { "Effect": "Allow", "Action": "iot:Receive",
    "Resource": "arn:aws:iot:us-east-1:841019700679:topic/*" }
] }
```

**Factory edge identity** (the IAM user whose keys are in the factory `.env`):
```json
{ "Version": "2012-10-17", "Statement": [
  { "Effect": "Allow", "Action": "iot:Connect",
    "Resource": "arn:aws:iot:us-east-1:841019700679:client/edge-republish-*" },
  { "Effect": "Allow", "Action": "iot:Publish",
    "Resource": [
      "arn:aws:iot:us-east-1:841019700679:topic/plc/*",
      "arn:aws:iot:us-east-1:841019700679:topic/lorawan/*" ] }
] }
```
The latency probe already proved Publish/Subscribe work on `plc/*`, so your
current IAM policy may already cover this.

## Step 2 — Factory side

On the machine that can reach the local broker (`192.168.10.254`):
```bash
npm ci
npm run edge-republish
```
You should see `Connected to AWS IoT Core — ready to republish` and periodic
`forwarded=… dropped=…` lines. Keep it running (use pm2 / a Windows service /
systemd as appropriate).

## Step 3 — EC2 side

Follow [EC2_SETUP.md](EC2_SETUP.md) Steps 1–3 first (security group, nginx,
deploy the updated `nginx.conf` which now includes the `/ws` proxy). Then:

```bash
# Node 20+ on the instance
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# App + deps
cd /opt && sudo git clone <your-repo> smart-factory && cd smart-factory
sudo npm ci

# Run cloud-bridge as a service
sudo tee /etc/systemd/system/cloud-bridge.service >/dev/null <<'EOF'
[Unit]
Description=Smart Factory cloud-bridge (IoT Core -> WebSocket)
After=network-online.target
[Service]
WorkingDirectory=/opt/smart-factory
ExecStart=/usr/bin/node scripts/cloud-bridge.mjs
Restart=always
Environment=AWS_REGION=us-east-1
# If NOT using an instance role, also set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY here.
[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now cloud-bridge
sudo journalctl -u cloud-bridge -f      # should show "Subscribed to plc/#"
```

### Optional GW Operational Twin live overlay

The embedded Twin uses a separate read-only SSE bridge so its DeviceInfo
samples never enter or reshape the existing `/ws` factory stream. Install the
repository's `deploy/gateway-twin-bridge.service` after copying
`scripts/gateway-twin-bridge.mjs` to the EC2 checkout:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gateway-twin-bridge
sudo journalctl -u gateway-twin-bridge -f
```

The nginx config exposes it at `/api/gateway-logs/stream`; the EC2 role needs
only `iot:Subscribe` on `topicfilter/prplos/deviceinfo/*` in addition to its
existing factory permissions. `iot:Receive` remains read-only.

## Step 4 — Build & deploy the frontend

The frontend talks to the cloud-bridge through nginx's `/ws`. Build with:
```bash
# .env.production (or env at build time)
VITE_PLC_MODE=mosquitto
VITE_MQTT_BRIDGE_URL=ws://<EC2-PUBLIC-DNS>/ws
```
Then `npm run build` and deploy `dist/` to `/var/www/smart-factory` (the
existing `deploy.sh` does this).

> `MosquittoPLCService` already understands the `{ topic, payload, publishedAt }`
> envelope the cloud-bridge sends — no frontend code changes needed.

## Step 5 — Verify latency end-to-end

Open the dashboard, then the browser devtools console:
```
[latency:mosquitto] window n=10 avg=51ms p50=49ms p95=68ms …
__plcLatency.summary()
```
Because the edge stamps `_bridgeTs` at publish time and the cloud-bridge passes
it through as `publishedAt`, this number is the **true factory → IoT Core → EC2
→ your browser** latency.

---

## Recommended hardening

- **TLS:** the base setup serves `http` / `ws`. For production remote access put
  HTTPS on nginx (ACM + ALB, or certbot) and switch the build to
  `VITE_MQTT_BRIDGE_URL=wss://<host>/ws`. Browsers require `wss` from an `https`
  page (mixed-content rule).
- **Instance role over static keys:** prefer an EC2 instance role so no AWS keys
  live on the box. The cloud-bridge's `AwsCredentialsProvider.newDefault()`
  picks the role up automatically.
- **Rotate the factory key:** the long-term `AKIA…` key in the factory `.env`
  should be rotated and scoped to just the `iot:Connect`/`iot:Publish` above.
```
