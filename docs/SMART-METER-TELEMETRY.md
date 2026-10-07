# Enable live Aituzero meter telemetry

The protobuf and power-display release was installed by the user through EC2 Instance Connect on 2026-10-02. The uploaded archive passed its SHA-256 check. The installer reported success, with backup `/var/backups/smart-meter-live.zP1My2XC`, and its final readiness response reported `ready`, `awsReady`, `subscriptionsReady` and `meterSubscribed` all true. The transient localhost connection error happened during the bridge restart; a later readiness attempt succeeded. The installer does not change IAM or account settings.

An independent check of the public deployment returned HTTP 200 for the dashboard and widget. The widget entry document, main JavaScript and CSS matched the tested local release. No `meter/data` packets arrived during a 35-second public WebSocket observation, so live hardware power remains unverified until the publisher sends fresh readings. The local binary fixture previously verified decoding and calculation end to end.

## Accumulated-energy update (prepared, not yet deployed)

The user requested persistent totals that keep counting with the browser closed. The new release adds that counter to the existing bridge and changes the twin's main register to accumulated import Wh/kWh. Active power stays in watts. Additional values include apparent and non-active power, average/peak import draw, AC cycle period, frequency deviation, observed time and excluded gaps.

Open [`deploy/install-meter-energy-update.sh`](../deploy/install-meter-energy-update.sh), copy the entire file, and paste into the existing EC2 Instance Connect terminal. This update is built for the installed watts release. It checks the original file hashes, reconstructs the tested new files, then runs the application installer with backup and automatic rollback. It briefly restarts `cloud-bridge`; no IAM, account configuration or new AWS resource is involved. A repeat application preserves accumulated totals.

The energy state is `/opt/smart-factory/.local-data/meter-energy.json`, owned by the existing service user `ec2-user`. It starts at zero with the first new reading; it cannot recover earlier consumption. Each valid interval adds estimated energy using the average of its two power readings. Intervals over 15 seconds, reconnect gaps and invalid readings are excluded. Totals are saved after each packet and survive browser closure and server restarts. Corrupt state is never silently reset. A write error is visible in the widget and `/readyz` as `meterEnergyError`.

After installation, check `/readyz` for `meterEnergyError: null`, then refresh the dashboard. The import counter should rise on successive readings when power is positive. Close/reopen the widget to check the total is preserved. The snapshot export includes units, totals, start time, observed duration and persistence status. Full behavior is documented in the widget README.

## What is ready

- The widget defaults to the live factory bridge and filters the exact `meter/data` topic.
- The cloud bridge subscribes to that topic on the supplied AWS IoT endpoint, alongside existing factory topics.
- Binary `metering.MeterData` is decoded using the four `double` fields in [`proto/meter.proto`](../proto/meter.proto): voltage (1), frequency (2), power factor (3), current (4).
- The bridge preserves binary bytes as base64 with `encoding: "protobuf"`; the browser decodes and maps them. Legacy JSON remains supported.
- Active power is calculated from matching single-phase voltage, current and power factor. The telemetry card and default trend show watts; the new 3D register shows accumulated import Wh/kWh.
- Missing measurements stay unavailable; simulation cannot fill gaps.
- Automatic reconnect, stale readings, history, the 3D register and JSON export use the same validated data.

## AWS steps for you

**If `meter/data` already reaches your deployed bridge, no AWS permission or IoT configuration change is needed for protobuf.** Install the application release below. The following permission steps are only for an initial setup or a rejected subscription.

1. In **EC2 → Instances**, select the instance hosting `3.239.12.96`. Open its **Security → IAM role**. The repository deployment identifies this instance as `i-04217238dfcdcbd78`; verify this matches your deployment.
2. In that role, add an inline policy named `SmartFactoryMeterRead`, using [`deploy/smart-meter-read-policy.json`](../deploy/smart-meter-read-policy.json). This adds only:
   - `iot:Subscribe` on `arn:aws:iot:us-east-1:841019700679:topicfilter/meter/data`.
   - `iot:Receive` on `arn:aws:iot:us-east-1:841019700679:topic/meter/data`.
   The account ID comes from the repository's existing deployment policy; verify it in your console. If the bridge uses a different IAM identity, apply the policy to that identity instead. Do not create browser access keys.
3. Preserve existing permissions. The bridge already needs `iot:Connect` for `client/cloud-bridge-*`; the checked-in full EC2 policy already contains it. That policy also already allows receive on `topic/*`, so the new receive statement is redundant for that exact role but makes the additive meter policy self-contained. No new publish permission, Cognito pool, IoT rule, certificate or public port is required.
4. Keep the physical meter publishing raw protobuf on exact topic `meter/data` in `us-east-1` at the given endpoint. Use the supplied schema with matching RMS voltage/current and power factor. Publish at least every 10 seconds; the screenshot's roughly 6-second interval is appropriate. Fresh publications should have retain disabled. This schema has no timestamp, so retained snapshots cannot establish freshness and are rejected by the widget.

The distinction between `topicfilter` for Subscribe and `topic` for Receive follows [AWS's policy examples](https://docs.aws.amazon.com/iot/latest/developerguide/pub-sub-policy.html). The existing server's SigV4 IAM authentication follows [AWS's authorization matrix](https://docs.aws.amazon.com/iot/latest/developerguide/iot-authorization.html).

## Apply the watts correction to the installed release

A subsequent live check on 2026-10-02 confirmed that the browser currently receives JSON on `meter/data`. The original release required an extra model flag on JSON packets, which left active power blank even when voltage, current and power factor were present. The corrected widget derives power for either format and shows watts. An observed packet of 123.599998 V, 0.279 A and PF 0.909 calculates to **31.35 W**. Actual readings change with the meter. The user screenshot confirmed this watts correction was installed. The accumulated-energy release above is the next update.

Open [`deploy/install-meter-watts-patch.sh`](../deploy/install-meter-watts-patch.sh), copy its entire contents, and paste into the existing EC2 Instance Connect terminal. No S3 upload is needed. The patch verifies the installed version, reconstructs the exact tested assets, backs up the old files, and atomically switches the widget entry document. On HTTP verification failure it restores the original entry. Re-running an already installed patch verifies its assets and makes no further changes. Unknown versions are rejected before writes. This updates only the static widget; no bridge restart, AWS API call, account or IAM change occurs.

After **Installed meter watts update**, refresh the dashboard with Ctrl+Shift+R. Power updates with each reading; it is not a cumulative counter. Energy accumulates in Wh or kWh. Current is shown to three decimal places so the displayed input better matches the power calculation.

## Install the prepared application release

The local release archive is `dist/smart-meter-energy-release.tgz`, with a SHA-256 file alongside it. It contains the widget, updated cloud bridge, `meter-wire.mjs` helper, schema reference, additive meter policy, rollout guide and installer. It excludes unrelated application changes and contains no credentials. Both bridge and widget must be updated: the old bridge converts protobuf bytes to text, losing the original payload.

Use your existing SSH method to copy it to the host. From a terminal on your computer (replace only the SSH key path):

```sh
scp -i /path/to/existing-key.pem dist/smart-meter-energy-release.tgz ec2-user@3.239.12.96:/tmp/smart-meter-energy-release.tgz
ssh -i /path/to/existing-key.pem ec2-user@3.239.12.96
```

Then on EC2, with existing meter permissions or after applying the initial IAM policy:

```sh
mkdir -p /tmp/smart-meter-live-release
tar -xzf /tmp/smart-meter-energy-release.tgz -C /tmp/smart-meter-live-release
sudo bash /tmp/smart-meter-live-release/install.sh
```

The installer validates the expected paths and existing bridge, backs up the widget, bridge and any previous binary helper, installs the release, restarts only `cloud-bridge`, and requires the bridge's existing `/readyz` endpoint to report `meterSubscribed: true` and factory readiness. On failure it restores the previous files automatically. It does not modify IAM, .env, the host dashboard, unrelated server code or nginx. Existing nginx already proxies `/ws`. Restarting the shared bridge briefly interrupts the factory stream; choose a suitable moment. The repository nginx config also includes a meter entry-document no-cache rule for your next routine config rollout; it is not required for the data path.

If you use EC2 Instance Connect or Systems Manager instead of SSH, upload the archive through your existing release process and run the same EC2 extraction/install commands. This release was installed by the user through EC2 Instance Connect after the local AWS CLI credentials and default SSH identity failed authentication.

## Verify live data

```sh
sudo journalctl -u cloud-bridge -n 60 --no-pager
curl -fsS http://127.0.0.1:9001/readyz
```

Look for `Subscribed to meter/data`, and `"meterSubscribed":true`. Subscription permission alone does not prove messages are arriving: reload the dashboard (hard refresh if needed), open its meter widget and verify **Live meter data**, a recent **Last reading** time, and all four values matching the publisher's decoded readings. Check that the active-power card equals `voltage × current × power_factor` W, and that the main energy register increases on successive fresh readings. The default electrical trend should be Active power. It must show dashes for unavailable energy, temperature and alarm information. Interrupting the feed should mark the last reading stale after 15 seconds and fresh publications should restore it. Do not publish the console's default greeting as a measurement; the parser correctly rejects it.

## Derived values

The new protobuf payload includes current, enabling single-phase active power: `V × I × PF` W. Both JSON and protobuf now use the agreed single-phase measurement model, so the publisher does not need an extra field. The UI labels power calculated and displays watts to two decimal places. For example, the local binary test fixture uses 124.5 V, 10 A and PF 0.901: 1,121.745 W, displayed as **1,121.75 W**. Actual UI values follow the live feed.

Never double voltage or assume a single leg's result represents both split-phase legs. The calculation assumes voltage and current measure the same single-phase circuit. Current utilization uses current / the reference 200 A rating. Proto3 omitted doubles mean zero; this schema cannot distinguish an absent measurement from a measured zero. Legacy JSON still preserves missing fields as unavailable. There is no existing power-score formula in this widget. Accumulated energy is calculated by the bridge from fresh observed intervals. Reported device registers, reactive power, pulse rate, temperatures and fault status remain unavailable unless supported by the publisher.

Complete payload details are in [the widget README](../smart-meter-widget/README.md).
