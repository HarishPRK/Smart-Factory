/**
 * Lambda: ws-connect / ws-disconnect
 *
 * Handles $connect and $disconnect routes for the API Gateway WebSocket API.
 * Stores/removes connection IDs in DynamoDB.
 *
 * Environment variables:
 *   CONNECTIONS_TABLE — DynamoDB table name (e.g. "ws-connections")
 */

import { DynamoDBClient, PutItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const TABLE = process.env.CONNECTIONS_TABLE;

export async function handler(event) {
  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;

  try {
    if (routeKey === "$connect") {
      await client.send(
        new PutItemCommand({
          TableName: TABLE,
          Item: {
            connectionId: { S: connectionId },
            connectedAt: { N: String(Date.now()) },
          },
        })
      );
    } else if (routeKey === "$disconnect") {
      await client.send(
        new DeleteItemCommand({
          TableName: TABLE,
          Key: { connectionId: { S: connectionId } },
        })
      );
    }

    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error(`${routeKey} error:`, err);
    return { statusCode: 500, body: "Failed" };
  }
}
