# Control Contracts

Shared TypeScript types and allowlisted translations for motor and alarm-relay
control. Quest and public APIs use logical actions; trusted transports use the
helpers here instead of hand-crafting MQTT topics or relay fields.

The package has no network client and cannot publish to MQTT, AWS, or a PLC.
