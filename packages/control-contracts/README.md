# Control Contracts

Shared TypeScript types and the single allowlisted translation for motor
control. Quest and public APIs use logical `START` and `STOP` actions; only a
trusted backend or edge adapter should call `toPlcMotorControlMessage`.

The package has no network client and cannot publish to MQTT, AWS, or a PLC.
