/**
 * Lambda: iot-attach-policy
 *
 * Called by the browser after getting Cognito credentials.
 * Attaches the IoT policy to the caller's Cognito identity ID.
 *
 * Environment variables:
 *   IOT_POLICY_NAME — The IoT policy to attach (e.g. "smart-factory-cognito")
 */

import { IoTClient, AttachPolicyCommand, ListTargetsForPolicyCommand } from "@aws-sdk/client-iot";
import { CognitoIdentityClient, GetIdCommand } from "@aws-sdk/client-cognito-identity";

const iotClient = new IoTClient({});
const cognitoClient = new CognitoIdentityClient({});
const POLICY_NAME = process.env.IOT_POLICY_NAME;

export async function handler(event) {
  const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  const { identityId } = body;

  if (!identityId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Missing identityId" }),
    };
  }

  try {
    await iotClient.send(
      new AttachPolicyCommand({
        policyName: POLICY_NAME,
        target: identityId,
      })
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, identityId }),
    };
  } catch (err) {
    // Already attached is fine
    if (err.name === "ResourceAlreadyExistsException") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ok: true, identityId, alreadyAttached: true }),
      };
    }
    console.error("attach-policy error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
