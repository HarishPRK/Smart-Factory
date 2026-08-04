# Smart Factory AI Data Governance Baseline

Policy version: 2026-07-28

## Scope

This baseline applies to factory chat, predictive-analysis explanations, device
insights, IPsec insights, application-routing insights, and the AI route advisor.

## Approved production provider

- Provider: Amazon Bedrock only.
- Approved model: `us.anthropic.claude-haiku-4-5-20251001-v1:0`.
- Geography: US cross-Region inference profile.
- Production behavior: fail closed if Bedrock or the approved model is unavailable.
- Direct Anthropic is restricted to an explicit non-production developer opt-in.
- The external LangGraph assistant remains a separate, explicitly labeled
  advisory trust boundary and sends data only after a user submits a prompt.

## Data classification

| Data | Classification |
| --- | --- |
| PLC readings, alarms, OEE, machine state | Confidential operational |
| IPsec, device inventory, routing and topology | Restricted network/OT |
| User prompts and conversations | Confidential |
| AI recommendations, scores and summaries | Same classification as source |
| AWS/API credentials | Secret |

## Data minimization

- Device names, stable IDs, IPs, MACs, hostnames, SSIDs and serial numbers are
  removed before AI invocation.
- Device and route-advisor identities use request-local pseudonyms.
- Free text is checked for AWS access keys, Bedrock keys, IPv4 addresses and
  MAC addresses before it is sent and before a response is returned.
- Generic insight payloads are transformed server-side; arbitrary caller JSON
  is never sent directly to the model.

## Invocation and human oversight

- Page insights require an explicit **Analyze** action and do not auto-run.
- AI output is advisory only and cannot directly control PLCs or equipment.
- Route recommendations are deterministically validated before display.
- The UI identifies Bedrock, source type/freshness where available, and the
  advisory-only status.

## Audit and retention

- Every governed request produces a structured `ai.invocation` metadata event.
- Events include policy version, request ID, use case, provider, model, outcome,
  duration, removed-field names, token usage when available, and source
  timestamp when available.
- Raw prompts, telemetry and model responses are deliberately excluded from
  application audit logs.
- Browser conversation state is session-only.
- Bedrock invocation-content logging is an AWS account setting and must not be
  enabled without an approved encrypted destination and explicit retention.

## Credential policy

- `.env` is local-only and removed from Git tracking.
- Repository examples contain blank credentials only.
- Production deployments must use IAM roles or temporary credentials.
- The access key previously committed to Git must be rotated after confirming
  every external consumer that still depends on it.

## Change control

Changes to the provider, model, approved geography, prompt data schema,
guardrails, retention or autonomous capabilities require governance review and
an update to this document's policy version.
