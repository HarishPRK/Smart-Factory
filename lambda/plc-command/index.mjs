/**
 * Lambda: plc-command
 *
 * Triggered by: API Gateway REST  POST /command
 * Body:         { "deviceId": "motor_fan", "action": "toggle" }
 *
 * Updates the IoT Core Device Shadow desired state, which delivers
 * a delta to the PLC via MQTT.
 *
 * Environment variables:
 *   THING_NAME  — IoT Core Thing name (e.g. "smart-factory-plc")
 */

import { IoTDataPlaneClient, UpdateThingShadowCommand } from "@aws-sdk/client-iot-data-plane";

const iotClient = new IoTDataPlaneClient({});
const THING_NAME = process.env.THING_NAME;

export async function handler(event) {
  console.log("plc-command received:", JSON.stringify(event));

  const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  const { deviceId, action } = body;

  if (!deviceId || !action) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Missing deviceId or action" }),
    };
  }

  // Build the desired state update based on the command
  let desiredState = {};

  if (deviceId === "motor_fan" && action === "toggle") {
    // We set a toggle flag — the PLC reads this from the shadow delta
    // and flips the relay accordingly
    desiredState = { motor_fan_toggle: Date.now() };
  } else {
    desiredState = { [deviceId]: { action } };
  }

  try {
    await iotClient.send(
      new UpdateThingShadowCommand({
        thingName: THING_NAME,
        payload: JSON.stringify({
          state: { desired: desiredState },
        }),
      })
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("Shadow update failed:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Shadow update failed" }),
    };
  }
}
