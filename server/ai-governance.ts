import { randomUUID } from 'node:crypto';

export const AI_DATA_POLICY_VERSION = '2026-07-28';

const MAX_TEXT_CHARS = 16_000;
const BLOCKED_KEYS = new Set([
  'accesskey',
  'accesskeyid',
  'awsaccesskeyid',
  'awssecretaccesskey',
  'credential',
  'hostname',
  'ip',
  'ipaddress',
  'ipv4address',
  'ipv6address',
  'mac',
  'password',
  'primwanip',
  'secret',
  'secretaccesskey',
  'secwanip',
  'serial',
  'serialnumber',
  'ssid',
  'token',
]);

const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface Sanitized<T> {
  value: T;
  removedFields: string[];
}

export function redactSensitiveText(raw: unknown, maxChars = MAX_TEXT_CHARS): Sanitized<string> {
  let value = typeof raw === 'string' ? raw.slice(0, maxChars) : '';
  const removedFields = new Set<string>();

  const replace = (pattern: RegExp, label: string) => {
    value = value.replace(pattern, () => {
      removedFields.add(label);
      return `[REDACTED_${label.toUpperCase()}]`;
    });
  };

  replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, 'aws_access_key');
  replace(/\bbedrock-api-key-[A-Za-z0-9._~+/=-]+\b/g, 'bedrock_api_key');
  replace(/\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g, 'mac');
  replace(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, 'ipv4');

  return { value, removedFields: [...removedFields] };
}

function sanitizeUnknown(
  input: unknown,
  path: string,
  removedFields: Set<string>,
  depth: number,
): unknown {
  if (depth > 8) {
    removedFields.add(`${path}.[depth-limit]`);
    return '[TRUNCATED]';
  }
  if (input == null || typeof input === 'boolean') return input;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (typeof input === 'string') {
    const redacted = redactSensitiveText(input, 2_000);
    for (const field of redacted.removedFields) removedFields.add(`${path}.${field}`);
    return redacted.value;
  }
  if (Array.isArray(input)) {
    return input.slice(0, 100).map((item, index) =>
      sanitizeUnknown(item, `${path}[${index}]`, removedFields, depth + 1));
  }
  if (typeof input !== 'object') return String(input);

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>).slice(0, 100)) {
    const fieldPath = path ? `${path}.${key}` : key;
    const normalizedKey = normalizeKey(key);
    const gatewayIdentityName =
      normalizedKey === 'name' && normalizeKey(path).endsWith('metricsgateway');
    if (BLOCKED_KEYS.has(normalizedKey) || gatewayIdentityName) {
      removedFields.add(fieldPath);
      continue;
    }
    output[key] = sanitizeUnknown(value, fieldPath, removedFields, depth + 1);
  }
  return output;
}

export function sanitizeStructuredData<T = unknown>(input: unknown): Sanitized<T> {
  const removedFields = new Set<string>();
  return {
    value: sanitizeUnknown(input, '', removedFields, 0) as T,
    removedFields: [...removedFields],
  };
}

export function sanitizeInsightPayload(topic: string, input: unknown): Sanitized<unknown> {
  if (topic === 'it-devices' || topic === 'ot-devices') {
    const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const devices = Array.isArray(source.devices) ? source.devices : [];
    const minimized = {
      domain: source.domain,
      total: source.total,
      counts: source.counts,
      devices: devices.slice(0, 100).map((raw, index) => {
        const device = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        return {
          pseudonym: `device-${index + 1}`,
          kind: device.kind,
          status: device.status,
          connection: device.conn,
          connectedForHours: device.connectedForHours,
        };
      }),
    };
    return {
      value: sanitizeStructuredData(minimized).value,
      removedFields: ['devices[].id', 'devices[].name', 'devices[].ip', 'devices[].mac'],
    };
  }

  if (topic === 'app-routing') {
    const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const policies = Array.isArray(source.policies) ? source.policies : [];
    return sanitizeStructuredData({
      totals: source.totals,
      categories: source.categories,
      policies: policies.slice(0, 100).map((raw) => {
        const policy = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        return {
          app: policy.app,
          category: policy.category,
          slaClass: policy.slaClass,
          preferredPath: policy.preferredPath,
          backupPath: policy.backupPath,
          hitsPerMin: policy.hitsPerMin,
          throughputMbps: policy.throughputMbps,
          enabled: policy.enabled,
        };
      }),
    });
  }

  return sanitizeStructuredData(input);
}

export function sanitizeIpsecSnapshot(input: unknown): Sanitized<unknown> {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const gatewayMap = source.gateways && typeof source.gateways === 'object'
    ? source.gateways as Record<string, unknown>
    : {};
  const removedFields = new Set<string>(['gateways.[gateway-name]']);
  const gateways = Object.values(gatewayMap).slice(0, 20).map((raw, index) => {
    const sanitized = sanitizeStructuredData(raw);
    for (const field of sanitized.removedFields) removedFields.add(`gateways[${index}].${field}`);
    return {
      pseudonym: `gateway-${index + 1}`,
      state: sanitized.value,
    };
  });

  return {
    value: { gateways, receivedAt: source.receivedAt },
    removedFields: [...removedFields],
  };
}

export interface AIAuditEvent {
  requestId: string;
  route: string;
  useCase: string;
  provider: string;
  model: string;
  outcome: 'success' | 'blocked' | 'fallback' | 'error';
  startedAt: number;
  sourceTimestamp?: number;
  removedFields?: string[];
  inputChars?: number;
  outputChars?: number;
  usage?: unknown;
  reason?: string;
}

export const newAIRequestId = () => randomUUID();

export function logAIAudit(event: AIAuditEvent): void {
  const record = {
    event: 'ai.invocation',
    policyVersion: AI_DATA_POLICY_VERSION,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - event.startedAt,
    advisoryOnly: true,
    ...event,
    removedFields: [...new Set(event.removedFields ?? [])].sort(),
  };
  // Structured metadata only. Raw prompts and model responses are deliberately excluded.
  // eslint-disable-next-line no-console
  console.info(JSON.stringify(record));
}
