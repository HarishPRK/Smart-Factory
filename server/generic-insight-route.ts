import type { Express } from 'express';
import { makeLLM } from './llm.js';
import {
  logAIAudit,
  newAIRequestId,
  sanitizeInsightPayload,
} from './ai-governance.js';

const llm = makeLLM();

/** POST /api/insight — generic Bedrock-Claude analysis for any page.
 *  Body: `{ topic: 'it-devices' | 'ot-devices' | 'connectivity' | 'fleet' | 'app-routing',
 *           data:  <any JSON the page wants analysed> }`
 *  The server picks a topic-appropriate system prompt and streams the response. */
// Style rules common to every topic. Kept in one place so all insight cards
// produce the same crisp output: max 3 bullets, ≤ 20 words each, no preamble,
// no closing sentence, no headers.
const INSIGHT_STYLE = `Style — be ruthlessly brief:
- Exactly 3 bullets, max 20 words each. No more, no less.
- No preamble ("Based on the data…"), no closing sentence, no headers.
- Use **bold** for key terms and \`code\` for IDs / IPs / interface names.
- Don't restate the JSON. Interpret it. If everything is fine, say so in 1 bullet.`;

const INSIGHT_PROMPTS: Record<string, string> = {
  'it-devices': `Senior IT-ops engineer reading an enterprise branch's endpoint inventory.
Focus: offline/degraded endpoints, connection-mix anomalies, security risks.
${INSIGHT_STYLE}`,

  'ot-devices': `Senior OT/IoT engineer reading industrial sensor inventory for a branch.
Focus: safety-critical sensors offline (flag as HIGH), coverage gaps, VLAN issues.
${INSIGHT_STYLE}`,

  'connectivity': `Senior network engineer reading branch WAN health.
Focus: branches at risk, active WAN choice, throughput anomalies.
${INSIGHT_STYLE}`,

  'fleet': `Network-ops manager writing a 3-line CIO-level readout.
Focus: bottom-line health %, biggest fleet risk, capacity trend.
${INSIGHT_STYLE}`,

  'app-routing': `Network architect reading app-aware-routing policies and per-app traffic.
Focus: critical apps off intended path, surprising splits, optimisation wins.
${INSIGHT_STYLE}`,
};


export function registerGenericInsightRoute(app: Express): void {
  app.post('/api/insight', async (req, res) => {
    const startedAt = Date.now();
    const requestId = newAIRequestId();
    res.setHeader('X-AI-Request-ID', requestId);
    if (!llm.client || llm.provider !== 'bedrock') {
      logAIAudit({
        requestId,
        route: '/api/insight',
        useCase: String(req.body?.topic ?? 'unknown'),
        provider: llm.provider,
        model: llm.model,
        outcome: 'blocked',
        startedAt,
        reason: llm.reason ?? 'Bedrock client unavailable',
      });
      res.status(503).json({ error: `LLM not configured (${llm.provider}): ${llm.reason ?? 'unknown'}.` });
      return;
    }

    const topic = req.body?.topic;
    const data  = req.body?.data;
    if (typeof topic !== 'string' || !INSIGHT_PROMPTS[topic]) {
      res.status(400).json({
        error: `Body must include { topic, data }. Topic must be one of: ${Object.keys(INSIGHT_PROMPTS).join(', ')}`,
      });
      return;
    }
    if (data == null) {
      res.status(400).json({ error: 'Body must include { data }.' });
      return;
    }

    // SSE setup (mirrors /api/ask, /api/ipsec/insight)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.socket?.setNoDelay(true);
    res.socket?.setKeepAlive(true);
    const emit = (event: string, payload: Record<string, unknown>) => {
      if (!res.writable || res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`, 'utf8');
    };
    const hb = setInterval(() => {
      if (res.writable && !res.writableEnded) res.write(': hb\n\n');
    }, 15_000);
    res.on('close', () => clearInterval(hb));

    // Minimize and redact before serialization. The model never receives the
    // caller's arbitrary object directly.
    const sanitized = sanitizeInsightPayload(topic, data);
    const dataJson = JSON.stringify(sanitized.value, null, 2);
    const trimmed = dataJson.length > 16_000
      ? dataJson.slice(0, 16_000) + '\n\n…[truncated for brevity]'
      : dataJson;

    const SYSTEM    = INSIGHT_PROMPTS[topic];
    const userBlock = `Here is the latest ${topic.replace('-', ' ')} data from this page:\n\n\`\`\`json\n${trimmed}\n\`\`\`\n\nAnalyse the current state.`;

    try {
      const response = await llm.client.messages.create({
        model: llm.model,
        max_tokens: 260,
        system:   [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: [{ type: 'text', text: userBlock }] }],
      });
      let outputChars = 0;
      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) {
          outputChars += block.text.length;
          emit('chunk', { text: block.text });
        }
      }
      logAIAudit({
        requestId,
        route: '/api/insight',
        useCase: topic,
        provider: llm.provider,
        model: llm.model,
        outcome: 'success',
        startedAt,
        removedFields: sanitized.removedFields,
        inputChars: trimmed.length,
        outputChars,
        usage: response.usage,
      });
      emit('done', {
        usage: response.usage,
        topic,
        governance: { advisoryOnly: true, provider: llm.provider, requestId },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logAIAudit({
        requestId,
        route: '/api/insight',
        useCase: topic,
        provider: llm.provider,
        model: llm.model,
        outcome: 'error',
        startedAt,
        removedFields: sanitized.removedFields,
        reason,
      });
      emit('error', { message: reason, requestId });
    } finally {
      clearInterval(hb);
      if (!res.writableEnded) res.end();
    }
  });
}
