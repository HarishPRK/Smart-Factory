# com.smartfactory.EdgeCommand 1.0.0

This versioned source describes a Greengrass V2 component artifact. Stage the
four repository files listed in `artifact-source.json` in an `edge-command/`
directory, then ZIP the **contents** of that directory so `package.json`,
`package-lock.json`, and `scripts/` are at the archive root. Greengrass exposes
those contents at `{artifacts:decompressedPath}/edge-command`. Do not include
the staging directory itself, the repository `.env`, `node_modules`,
credentials, or any UI files.

The artifact's lockfile is generated from its exact dependency versions. The
recipe runs `npm ci --omit=dev`, so installation fails instead of changing the
dependency graph. Installation copies the immutable artifact source into the
component work directory before npm writes `node_modules`. Node.js 20 or newer
and network access to the configured npm registry are prerequisites during
component installation.

Before creating the component version:

1. Replace only the bucket placeholder in `recipe.yaml`; retain the component
   name, version, artifact key, and exact IPC access-control resource.
2. Build `edge-command.zip` from `artifact-source.json` and upload it to the
   matching S3 key.
3. Create `com.smartfactory.EdgeCommand` version `1.0.0` with the versioned
   recipe. Component versions are immutable; use a new version for later code.
4. Deploy first with the machine de-energized. Verify relay `0` commands and
   PLC telemetry feedback before attempting either relay `1` command.

Greengrass injects its IPC socket path and service token. The runtime detects
both variables and uses `SubscribeToIoTCore` at QoS 1. Do not add AWS access
keys or manually set either IPC variable. The component exits nonzero on IPC
disconnect, stream error, or unexpected stream end so Greengrass can restart
it. `RequiresPrivilege` remains false for installation and execution.

Recipe IPC access control and cloud authorization are separate. The core
device certificate's AWS IoT policy must also allow `iot:Subscribe` on the exact
`topicfilter/plc/control` ARN and `iot:Receive` on the exact `topic/plc/control`
ARN. IPC mode needs no IAM access keys.

The component publishes to local Mosquitto only after a live, non-retained,
strictly allowlisted message. A local QoS 1 PUBACK confirms broker receipt, not
PLC actuation. The SDK models `retain` as optional, so de-energized commissioning
must also confirm Nucleus supplies explicit `false` for live messages; the
runtime intentionally rejects missing retain metadata. Commissioning still
requires PLC output/telemetry verification.
