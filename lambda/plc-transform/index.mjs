/**
 * Lambda: plc-transform
 *
 * Triggered by IoT Rule:  SELECT * FROM 'plc/data'
 * Pushes raw payload to all connected WebSocket clients via API Gateway.
 *
 * Environment variables:
 *   WS_API_ENDPOINT     — API GW WebSocket endpoint (e.g. "https://xxx.execute-api.us-east-1.amazonaws.com/prod")
 *   CONNECTIONS_TABLE   — DynamoDB table for WS connection IDs (e.g. "ws-connections")
 */

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient, ScanCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient({});
const WS_ENDPOINT = process.env.WS_API_ENDPOINT;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

export async function handler(event) {
  // Get all active WebSocket connections
  const { Items: connections } = await dynamoClient.send(
    new ScanCommand({ TableName: CONNECTIONS_TABLE })
  );

  if (!connections || connections.length === 0) return { statusCode: 200 };

  const apiClient = new ApiGatewayManagementApiClient({ endpoint: WS_ENDPOINT });
  const message = JSON.stringify(event);
  const stale = [];

  await Promise.allSettled(
    connections.map(async (conn) => {
      const id = conn.connectionId.S;
      try {
        await apiClient.send(
          new PostToConnectionCommand({ ConnectionId: id, Data: message })
        );
      } catch (err) {
        if (err.statusCode === 410 || err.$metadata?.httpStatusCode === 410) {
          stale.push(id);
        }
      }
    })
  );

  // Clean up stale connections
  if (stale.length > 0) {
    await Promise.allSettled(
      stale.map((id) =>
        dynamoClient.send(
          new DeleteItemCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId: { S: id } },
          })
        )
      )
    );
  }

  return { statusCode: 200 };
}
