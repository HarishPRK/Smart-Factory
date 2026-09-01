import { describe, expect, it } from "vitest";
import {
  commandRequiresAuthorization,
  commandRequiresSafetyCheck,
  createPublishAck,
  createRfidAuthorizationGate,
  isAllowedCommandOrigin,
  isProtectedCommandTopic,
  parseBrowserPublish,
} from "./bridge-command.mjs";

describe("browser MQTT command allowlist", () => {
  it("accepts the exact motor and alarm relay payloads", () => {
    expect(
      parseBrowserPublish(
        JSON.stringify({
          type: "publish",
          requestId: "motor-1",
          topic: "plc/control",
          payload: { boardA_relay_motor: 1 },
        }),
      ),
    ).toEqual({
      ok: true,
      command: {
        requestId: "motor-1",
        topic: "plc/control",
        payload: JSON.stringify({ boardA_relay_motor: 1 }),
      },
    });

    expect(
      parseBrowserPublish(
        JSON.stringify({
          type: "publish",
          requestId: "alarm-1",
          topic: "plc/control",
          payload: { boardA_relay_alarm: 0 },
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  it("rejects arbitrary topics, fields, and non-binary relay values", () => {
    expect(
      parseBrowserPublish(
        JSON.stringify({ topic: "admin/delete", payload: { value: 1 } }),
      ),
    ).toMatchObject({ ok: false });
    expect(
      parseBrowserPublish(
        JSON.stringify({
          topic: "plc/control",
          payload: { boardA_relay_unknown: 1 },
        }),
      ),
    ).toMatchObject({ ok: false });
    expect(
      parseBrowserPublish(
        JSON.stringify({
          topic: "plc/control",
          payload: { boardA_relay_motor: true },
        }),
      ),
    ).toMatchObject({ ok: false });
  });

  it("keeps the legacy toggle command local and exact", () => {
    const frame = JSON.stringify({
      topic: "plc/cmd",
      payload: { deviceId: "photoE", action: "toggle" },
    });

    expect(parseBrowserPublish(frame)).toMatchObject({ ok: false });
    expect(
      parseBrowserPublish(frame, { allowLegacyCommand: true }),
    ).toMatchObject({ ok: true });
    expect(
      parseBrowserPublish(
        JSON.stringify({
          topic: "plc/cmd",
          payload: {
            deviceId: "photoE",
            action: "toggle",
            extra: "not allowed",
          },
        }),
        { allowLegacyCommand: true },
      ),
    ).toMatchObject({ ok: false });
  });

  it("creates correlated publish acknowledgements", () => {
    expect(createPublishAck("command-1", true)).toBe(
      JSON.stringify({
        type: "publish-ack",
        requestId: "command-1",
        ok: true,
      }),
    );
  });

  it("uses the safety gate, not RFID, for plc/control relay commands", () => {
    for (const field of ["boardA_relay_motor", "boardA_relay_alarm"]) {
      for (const value of [0, 1]) {
        const parsed = parseBrowserPublish(
          JSON.stringify({
            topic: "plc/control",
            payload: { [field]: value },
          }),
        );

        expect(parsed.ok).toBe(true);
        if (!parsed.ok) continue;
        expect(commandRequiresAuthorization(parsed.command)).toBe(false);
        expect(commandRequiresSafetyCheck(parsed.command)).toBe(value === 1);
      }
    }

    const legacy = parseBrowserPublish(
      JSON.stringify({
        topic: "plc/cmd",
        payload: { deviceId: "photoE", action: "toggle" },
      }),
      { allowLegacyCommand: true },
    );
    expect(legacy.ok).toBe(true);
    if (legacy.ok) {
      expect(commandRequiresAuthorization(legacy.command)).toBe(true);
      expect(commandRequiresSafetyCheck(legacy.command)).toBe(false);
    }
  });

  it("identifies command topics that the telemetry uplink must never mirror", () => {
    expect(isProtectedCommandTopic("plc/control")).toBe(true);
    expect(isProtectedCommandTopic("plc/control/retry")).toBe(true);
    expect(isProtectedCommandTopic("plc/cmd")).toBe(true);
    expect(isProtectedCommandTopic("plc/data")).toBe(false);
    expect(
      isProtectedCommandTopic("prplHome/McKinney/lineA/plc1/data"),
    ).toBe(false);
  });

  it("requires an RFID rising edge, expires it, and does not extend on a held signal", () => {
    let now = 1_000;
    const gate = createRfidAuthorizationGate({
      windowMs: 5_000,
      now: () => now,
    });

    expect(gate.isAuthorized()).toBe(false);
    gate.observe("plc/data", { boardB_io_push_lock_button: 0 });
    expect(gate.isSafeToEnergize()).toBe(true);
    // A retained/high first sample after restart is not a fresh badge scan.
    gate.observe("prplHome/McKinney/lineA/plc1/data/boardA", {
      boardA_rfid_authorized_user: 1,
    });
    expect(gate.isAuthorized()).toBe(false);
    gate.observe("plc/data", { boardA_rfid_authorized_user: 0 });
    gate.observe("plc/data", { boardA_rfid_authorized_user: 1 });
    expect(gate.isAuthorized()).toBe(true);

    now = 5_500;
    gate.observe("plc/data", { boardA_rfid_authorized_user: 1 });
    now = 6_001;
    expect(gate.isAuthorized()).toBe(false);
    gate.observe("plc/data", { rfid_authorized: "false" });
    gate.observe("plc/data", { rfid_authorized: "true" });
    expect(gate.isAuthorized()).toBe(true);
  });

  it("requires fresh E-stop-clear telemetry before energizing a relay", () => {
    let now = 1_000;
    const gate = createRfidAuthorizationGate({
      telemetryFreshnessMs: 5_000,
      now: () => now,
    });

    expect(gate.isSafeToEnergize()).toBe(false);
    gate.observe("plc/data", { boardB_io_push_lock_button: 0 });
    expect(gate.isSafeToEnergize()).toBe(true);

    gate.observe("plc/data", { system_emergency_stop: 1 });
    expect(gate.isSafeToEnergize()).toBe(false);
    gate.observe("plc/data", { system_emergency_stop: 0 });
    expect(gate.isSafeToEnergize()).toBe(true);

    now = 6_001;
    expect(gate.isSafeToEnergize()).toBe(false);
    gate.observe("plc/data", { boardA_voltage_pot_1: 4.61 });
    expect(gate.isSafeToEnergize()).toBe(false);
    gate.observe("plc/data", { boardB_io_push_lock_button: 0 });
    expect(gate.isSafeToEnergize()).toBe(true);

    gate.observe("plc/data", { system_was_in_emergency_stop_state: 1 });
    expect(gate.isSafeToEnergize()).toBe(false);
    gate.observe("plc/data", { boardA_current_pot: 5.8 });
    expect(gate.isSafeToEnergize()).toBe(false);
    gate.observe("plc/data", { boardB_io_push_lock_button: 0 });
    expect(gate.isSafeToEnergize()).toBe(true);

    gate.invalidate();
    expect(gate.isSafeToEnergize()).toBe(false);
  });

  it("hard-blocks during E-stop and clears on every supported E-stop variant", () => {
    const variants = [
      "boardB_io_push_lock_button",
      "boardA_push_lock_button",
      "push_lock_button",
      "system_in_emergency_stop_state",
      "system_emergency_stop",
      "system_was_in_emergency_stop_state",
    ];

    for (const field of variants) {
      const gate = createRfidAuthorizationGate();
      gate.observe("plc/data", { boardB_io_push_lock_button: 0 });
      gate.observe("plc/data", { rfid_authorized: 0 });
      gate.observe("plc/data", { rfid_authorized: 1 });
      expect(gate.isAuthorized()).toBe(true);
      gate.observe("plc/data", { [field]: 1 });
      expect(gate.isAuthorized()).toBe(false);
    }

    const gate = createRfidAuthorizationGate();
    gate.observe("plc/data", { boardB_io_push_lock_button: 0 });
    gate.observe("plc/data", { rfid_authorized: 0 });
    gate.observe("plc/data", { rfid_authorized: 1 });
    gate.observe("plc/data", { boardB_io_push_lock_button: 1 });
    expect(gate.isAuthorized()).toBe(false);
    gate.observe("plc/data", { rfid_authorized: 0 });
    gate.observe("plc/data", { rfid_authorized: 1 });
    expect(gate.isAuthorized()).toBe(false);
    gate.observe("plc/data", { boardB_io_push_lock_button: 0 });
    gate.observe("plc/data", { rfid_authorized: 0 });
    gate.observe("plc/data", { rfid_authorized: 1 });
    expect(gate.isAuthorized()).toBe(true);
  });

  it("keeps fragmented E-stop fields fail-closed and invalidates on disconnect", () => {
    const gate = createRfidAuthorizationGate();
    gate.observe("plc/data", { boardB_io_push_lock_button: 0 });
    gate.observe("plc/data", { rfid_authorized: 0 });
    gate.observe("plc/data", { rfid_authorized: 1 });
    expect(gate.isAuthorized()).toBe(true);

    gate.observe("plc/data/system", { system_emergency_stop: 1 });
    expect(gate.isAuthorized()).toBe(false);
    // A false value from a different slice cannot clear the active field.
    gate.observe("plc/data/board", { boardB_io_push_lock_button: 0 });
    expect(gate.isAuthorized()).toBe(false);

    gate.observe("plc/data/system", { system_emergency_stop: 0 });
    gate.observe("plc/data", { rfid_authorized: 0 });
    gate.observe("plc/data", { rfid_authorized: 1 });
    expect(gate.isAuthorized()).toBe(true);

    gate.invalidate();
    expect(gate.isAuthorized()).toBe(false);
    gate.observe("plc/data", { rfid_authorized: 0 });
    gate.observe("plc/data", { rfid_authorized: 1 });
    expect(gate.isAuthorized()).toBe(false);
  });

  it("allows command publication only from the dashboard origin", () => {
    expect(
      isAllowedCommandOrigin({
        origin: "https://factory.example.com",
        host: "factory.example.com",
      }),
    ).toBe(true);
    expect(
      isAllowedCommandOrigin({
        origin: "http://localhost:5173",
        host: "localhost:9001",
      }),
    ).toBe(true);
    expect(
      isAllowedCommandOrigin({
        origin: "https://attacker.example",
        host: "factory.example.com",
      }),
    ).toBe(false);
    expect(isAllowedCommandOrigin({ host: "factory.example.com" })).toBe(false);
  });
});
