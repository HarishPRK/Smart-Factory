# PLC namespace migration

The PLC and UNS subscription is now `prplInnovationHub/#`. Both browser
transports and both UNS interfaces exclude the former `prplHome` root.
The local MQTT bridge, EC2 cloud bridge, edge republisher and SiteWise ingest
defaults have been updated. Existing meter, LoRaWAN and command topics remain
separate.

UNS labels topic depths as **Location → Site → Area → Line → Cell → Equipment**.
For example, `prplInnovationHub/McKinney/production/lineA/cell1/plc1/data/boardA`
contains six hierarchy levels followed by the data group and published topic.
These labels describe actual received path segments. The UI does not rename
segments or create missing areas, cells, equipment or messages. The publisher
must supply the desired hierarchy.

## Deployment order

1. Ensure the publisher sends to `prplInnovationHub/...`, with the same sensor
   payload keys. This application does not rewrite the publisher's topic.
2. Permit the EC2 bridge identity to subscribe to
   `arn:aws:iot:us-east-1:841019700679:topicfilter/prplInnovationHub/*` and receive
   `topic/prplInnovationHub` and `topic/prplInnovationHub/*`. The checked-in
   `deploy/smart-factory-ec2-policy.json` includes the new subscription resource;
   its existing receive policy already covers these topics. The factory edge
   publisher also needs publish permission for the new namespace. See
   `deploy/EC2_CLOUD_BRIDGE.md`. No AWS policy has been changed automatically.
3. Deploy the updated `scripts/cloud-bridge.mjs` **and**
   `scripts/bridge-command.mjs` to the EC2 checkout. The second file keeps RFID
   authorization and E-stop observation aligned with the new telemetry root;
   it does not change actuator command topics or validation.
4. Review `/opt/smart-factory/.env` and any systemd overrides. If `CLOUD_TOPICS`
   is set, replace the old factory entry with `prplInnovationHub/#`, preserving
   the other topic entries. Without an override the new default is
   `prplInnovationHub/#,plc/#,lorawan/#`.
5. Restart the bridge after deploying those files and configuration:

   ```bash
   sudo systemctl restart cloud-bridge
   sudo systemctl --no-pager --full status cloud-bridge
   sudo journalctl -u cloud-bridge -n 50 --no-pager
   ```

   Verify successful subscription to `prplInnovationHub/#` and received messages.
   A permission failure requires the IAM change in step 2, not a UI change.
6. If used, deploy the updated `scripts/edge-republish.mjs` on the factory host,
   `scripts/mqtt-bridge.mjs` on the local bridge, and `scripts/sitewise-ingest.mjs`
   on the historian host. Existing `EDGE_TOPICS` and `PLC_TOPIC` overrides must
   also switch to the new namespace before restarting their owning processes.
   A deployed Lambda IoT rule must use the new topic filter too; the source
   comment in `lambda/plc-transform/index.mjs` shows the updated prefix.
7. Build/upload/install the frontend using `docs/EC2-FRONTEND-UPDATE.md`, then
   reload and check actual PLC readings, UNS discovery, and both UI versions.

The frontend-only release deliberately does not install bridge files, change
environment variables, restart services, publish telemetry, or update IAM.
