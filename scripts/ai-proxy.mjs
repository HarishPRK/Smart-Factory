/**
 * AI Chat Proxy — bridges browser to Claude API.
 *
 * Usage:  npm run ai-proxy
 * Reads ANTHROPIC_API_KEY from .env automatically.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import http from "http";

// Load .env from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envFile = readFileSync(resolve(__dirname, "../.env"), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch { /* .env not found, rely on system env */ }

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("[ai-proxy] ANTHROPIC_API_KEY is required. Set it as an environment variable.");
  process.exit(1);
}

const PORT = Number(process.env.AI_PORT ?? 9002);
const client = new Anthropic({ apiKey: API_KEY });

const SYSTEM_PROMPT = `You are an AI assistant embedded in the Capgemini Digital Factory dashboard. You have real-time access to PLC (Programmable Logic Controller) sensor data from the factory floor.

Your role:
- Answer questions about current factory status, sensor readings, and machine health
- Explain what sensor values mean and whether they are normal
- Provide recommendations when values are out of range
- Help operators understand alerts and take appropriate action
- Be concise and use factory/industrial terminology

When given PLC data context, analyze it and reference specific values in your answers. Keep responses short (2-4 sentences) unless the user asks for detail.`;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/chat") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  try {
    const { messages, plcContext } = JSON.parse(body);

    // Inject PLC data as the first user-assistant exchange for context
    const contextMessages = [];
    if (plcContext) {
      contextMessages.push({
        role: "user",
        content: `Here is the current live PLC data from the factory:\n\n${plcContext}\n\nUse this data to answer my following questions.`,
      });
      contextMessages.push({
        role: "assistant",
        content: "I can see the live PLC data. I'm ready to help you with any questions about the factory status.",
      });
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [...contextMessages, ...messages],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ reply: text }));
  } catch (err) {
    console.error("[ai-proxy] Error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`[ai-proxy] Claude AI proxy listening on http://localhost:${PORT}/chat`);
});
