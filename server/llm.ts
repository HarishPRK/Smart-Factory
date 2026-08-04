/**
 * Governed LLM client factory. Bedrock is the default and only provider allowed
 * in production. Direct Anthropic is available solely for explicit local
 * development with ALLOW_DIRECT_ANTHROPIC=true.
 *
 * Bedrock supports two auth styles:
 *   1. Traditional SigV4 — AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (+ optional session token)
 *   2. Bedrock API key (bearer token) — looks like "bedrock-api-key-<base64>",
 *      AWS's newer convenience auth introduced in 2025. Decodes server-side
 *      into temporary AWS credentials.
 *
 * Bedrock auth supports either temporary/default-chain AWS credentials or a
 * Bedrock bearer token. Production should use an IAM role/default chain.
 */
import Anthropic from '@anthropic-ai/sdk';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { makeBedrockBearerClient } from './bedrockBearer.js';

export type Provider = 'anthropic' | 'bedrock';

export interface AgentClient {
  messages: {
    create: Anthropic['messages']['create'];
  };
}

export interface LLMSetup {
  provider: Provider;
  client: AgentClient | null;
  model: string;
  authMode?: 'anthropic-api-key' | 'bedrock-api-key' | 'aws-iam' | 'aws-default-chain';
  /** Why client is null, if it is. Surfaced in /api/health and the 503 body. */
  reason?: string;
}

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  bedrock:   'us.anthropic.claude-haiku-4-5-20251001-v1:0',
};

const isBedrockApiKey = (s: string | undefined): s is string =>
  !!s && s.startsWith('bedrock-api-key-');

export function makeLLM(): LLMSetup {
  // ── Find a Bedrock bearer token in any of the conventional env vars ──
  const bedrockBearer =
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
    process.env.AWS_BEDROCK_API_KEY ||
    (isBedrockApiKey(process.env.ANTHROPIC_API_KEY) ? process.env.ANTHROPIC_API_KEY : undefined);

  // ── Pick a provider ──
  // Fail closed: Bedrock is the default. Direct Anthropic requires two explicit
  // local-development switches and is never allowed when NODE_ENV=production.
  const explicit = (process.env.LLM_PROVIDER ?? '').toLowerCase();
  const production = process.env.NODE_ENV === 'production';
  const directAnthropicAllowed =
    !production && process.env.ALLOW_DIRECT_ANTHROPIC === 'true';
  const provider: Provider = explicit === 'anthropic' ? 'anthropic' : 'bedrock';

  if (provider === 'anthropic' && !directAnthropicAllowed) {
    return {
      provider,
      client: null,
      model: process.env.AGENT_MODEL ?? DEFAULT_MODELS.anthropic,
      reason:
        'Direct Anthropic is disabled by governance policy. Use LLM_PROVIDER=bedrock, ' +
        'or explicitly opt in for local development with ALLOW_DIRECT_ANTHROPIC=true.',
    };
  }

  const model = process.env.AGENT_MODEL ?? DEFAULT_MODELS[provider];

  if (provider === 'bedrock') {
    const approvedModels = (process.env.BEDROCK_APPROVED_MODELS ?? DEFAULT_MODELS.bedrock)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!approvedModels.includes(model)) {
      return {
        provider,
        client: null,
        model,
        reason: `Model ${model} is not in BEDROCK_APPROVED_MODELS.`,
      };
    }
    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';

    // ── Bearer token auth (newer: Bedrock API keys) ──
    // @anthropic-ai/bedrock-sdk v0.29 does not reliably honour AWS_BEARER_TOKEN_BEDROCK
    // end-to-end (it still signs with SigV4 against the default credential chain),
    // so we go direct to the Bedrock REST API with a thin fetch wrapper.
    if (bedrockBearer) {
      const client = makeBedrockBearerClient({ region, apiKey: bedrockBearer }) as AgentClient;
      return { provider, client, model, authMode: 'bedrock-api-key' };
    }

    // ── SigV4 auth (explicit access key + secret) ──
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (accessKey && secretKey) {
      const client = new AnthropicBedrock({
        awsRegion: region,
        awsAccessKey: accessKey,
        awsSecretKey: secretKey,
        awsSessionToken: process.env.AWS_SESSION_TOKEN,
      }) as unknown as AgentClient;
      return { provider, client, model, authMode: 'aws-iam' };
    }

    // ── AWS default credential chain (IAM role on EC2/ECS/Lambda, ~/.aws/credentials, SSO) ──
    const client = new AnthropicBedrock({ awsRegion: region }) as unknown as AgentClient;
    return { provider, client, model, authMode: 'aws-default-chain' };
  }

  // ────── Anthropic direct API ──────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { provider, client: null, model, reason: 'ANTHROPIC_API_KEY not set' };
  }
  // Defense in depth — if we got here with a Bedrock-shaped key, refuse.
  if (isBedrockApiKey(apiKey)) {
    return {
      provider, client: null, model,
      reason:
        'ANTHROPIC_API_KEY contains a Bedrock API key (starts with "bedrock-api-key-"). ' +
        'Set LLM_PROVIDER=bedrock and AWS_REGION, or rename the env var to AWS_BEARER_TOKEN_BEDROCK.',
    };
  }
  const client = new Anthropic({ apiKey });
  return { provider, client, model, authMode: 'anthropic-api-key' };
}
