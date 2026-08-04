import type { Express } from 'express';
import { makeLLM } from './llm.js';
import {
  logAIAudit,
  newAIRequestId,
  redactSensitiveText,
} from './ai-governance.js';

const llm = makeLLM();

const SYSTEM_PROMPT = `You are an advisory assistant for an industrial smart-factory dashboard.
Use only the supplied operational context. Clearly state when data is missing or stale.
Never claim to have executed a command or changed equipment. Safety-critical actions require
an authorized operator and the site's documented procedure. Keep ordinary answers concise.`;

interface IncomingMessage {
  role?: unknown;
  content?: unknown;
}

export function registerFactoryAIRoute(app: Express): void {
  app.post('/api/factory-ai/chat', async (req, res) => {
    const startedAt = Date.now();
    const requestId = newAIRequestId();
    res.setHeader('X-AI-Request-ID', requestId);

    if (!llm.client || llm.provider !== 'bedrock') {
      logAIAudit({
        requestId,
        route: '/api/factory-ai/chat',
        useCase: 'factory-advisory',
        provider: llm.provider,
        model: llm.model,
        outcome: 'blocked',
        startedAt,
        reason: llm.reason ?? 'Bedrock client unavailable',
      });
      res.status(503).json({ error: `Governed Bedrock AI is unavailable: ${llm.reason ?? 'not configured'}` });
      return;
    }

    const incoming = Array.isArray(req.body?.messages)
      ? req.body.messages.slice(-20) as IncomingMessage[]
      : [];
    const removedFields: string[] = [];
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const message of incoming) {
      if (message.role !== 'user' && message.role !== 'assistant') continue;
      const sanitized = redactSensitiveText(message.content, 4_000);
      removedFields.push(...sanitized.removedFields.map((field) => `messages.${field}`));
      if (sanitized.value.trim()) {
        messages.push({ role: message.role, content: sanitized.value });
      }
    }
    const context = redactSensitiveText(req.body?.plcContext, 12_000);
    removedFields.push(...context.removedFields.map((field) => `plcContext.${field}`));

    if (messages.length === 0) {
      res.status(400).json({ error: 'At least one non-empty user or assistant message is required.' });
      return;
    }

    const governedMessages = context.value
      ? [
          {
            role: 'user' as const,
            content: `Current approved factory context:\n\n${context.value}`,
          },
          {
            role: 'assistant' as const,
            content: 'I will use this context only for an advisory response.',
          },
          ...messages,
        ]
      : messages;

    try {
      const response = await llm.client.messages.create({
        model: llm.model,
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: governedMessages,
      });
      const rawReply = response.content
        .map((block) => block.type === 'text' ? block.text : '')
        .join('');
      const reply = redactSensitiveText(rawReply, 8_000);
      removedFields.push(...reply.removedFields.map((field) => `response.${field}`));

      logAIAudit({
        requestId,
        route: '/api/factory-ai/chat',
        useCase: 'factory-advisory',
        provider: llm.provider,
        model: llm.model,
        outcome: 'success',
        startedAt,
        removedFields,
        inputChars: context.value.length + messages.reduce((sum, message) => sum + message.content.length, 0),
        outputChars: reply.value.length,
        usage: response.usage,
      });
      res.json({
        reply: reply.value,
        governance: {
          advisoryOnly: true,
          provider: llm.provider,
          model: llm.model,
          requestId,
          removedFields: [...new Set(removedFields)],
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logAIAudit({
        requestId,
        route: '/api/factory-ai/chat',
        useCase: 'factory-advisory',
        provider: llm.provider,
        model: llm.model,
        outcome: 'error',
        startedAt,
        removedFields,
        reason,
      });
      res.status(502).json({ error: 'Bedrock advisory request failed.', requestId });
    }
  });
}
