# Edge solutions port

Release record: 2026-09-24 (UTC). **Built and staged only; not deployed.**

## Scope and host integration

Connected Enterprise's `pages/ServiceOfferings`, `pages/HardwareAnomalies`, and offerings canvas were ported into `src/integrations/`. **Solution Offerings** and **EA:GLE** cards appear under **Workspaces**. Initial loads at `/service-offerings` and `/hardware-anomalies` open the corresponding `IntegrationModal` through `src/components/Dashboard.tsx`.

The offerings `OfferingNavigation` adapter closes the offerings modal and opens the matching EA:GLE, dynamic path selection, video analytics, or analytics workspace. These are host workspace transitions. The existing immersive modal and fullscreen controls are reused.

This extends the incumbent interface: `.integration-scope`, `src/integrations/design-tokens.css`, and existing integration components remain the visual authority. The canvas measures layout pixels with `clientWidth`/`clientHeight` and maps pointer coordinates back to those pixels to accommodate the dashboard's CSS zoom. The store walkthrough remains an explicitly illustrative concept demonstration; its events and outcomes are not live factory sensor readings.

## Telemetry contract

`server/hardware-metrics-routes.ts` registers `GET /api/hardware-metrics/anomalies`; `server/influxSource.ts` validates the query, requests InfluxDB, and parses the result. Browser requests use the same-origin API. Configure `INFLUX_URL`, `INFLUX_ORG`, `INFLUX_BUCKET`, and `INFLUX_TOKEN` on the server only. The existing upstream is `http://76.187.201.239:8086/api/v2/query`, organization `Capgemini`, bucket `BGW620`; the token must never enter the frontend bundle.

Hardware anomaly queries remain fixed to serial `R95VA4GP000041`. The response retains anomaly flags, reconstruction error, learned thresholds, reason codes, and every tagged connection-tracking series for `conntrack_total`, `conntrack_tcp`, `conntrack_udp`, `conntrack_icmp`, and `conntrack_other`.

For ranges ending at now, `useHardwareAnomalies` polls every 30 seconds while the document is visible and no request is loading, and refreshes when visibility resumes. A failed refresh retains the previous result with an explicit **Cached snapshot** state; an initial failure shows **Source unavailable**. Changing the query range clears the previous range's data.

## Validation and release

The implementation pass completed typechecks, all 17 parser/query tests (`npx vitest run server/influxSource.test.ts --environment node`), and the production build with existing warnings. Desktop screenshots were reviewed in `Connected Enterprise/outputs/edge-solutions-review/factory-{offerings,eagle}-desktop.png`; `design-scan.json` contains `[]`. The review recommendation was **ship for desktop only**, not a mobile approval.

The release is staged at `/home/ec2-user/edge-solutions-20260924`, awaiting renewed AWS credentials or a usable Smart Factory private key. The default AWS credentials returned an invalid security token, and temporary EC2 Instance Connect access expired. Factory production has not received this release: its existing `/api/health` returned HTTP 200, while the new telemetry endpoint returned HTTP 404.

`deploy/install-edge-solutions-release.sh` is prepared for a targeted API/static update, with API health and telemetry checks and retention of old hashed assets for open sessions. Its error rollback restores the previous server entry point, server environment, Nginx configuration, and HTML entry point, then restarts/reloads services. Deployment will record a timestamped backup under `/opt/smart-factory/deploy-backups/`.
