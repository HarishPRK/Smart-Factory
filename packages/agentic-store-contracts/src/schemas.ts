import { z } from "zod";

const jsonPrimitiveSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);

export const sensorBindingSchema = z.object({
  id: z.string().trim().min(1).max(200),
  storeId: z.string().trim().min(1).max(100),
  sourceId: z.string().trim().min(1).max(200),
  tag: z.string().trim().min(1).max(300),
  entityId: z.string().trim().min(1).max(200),
  property: z.string().trim().min(1).max(200),
  valueType: z.enum(["number", "boolean", "string"]),
  unit: z.string().trim().min(1).max(50).optional(),
  scale: z.number().finite().optional(),
  offset: z.number().finite().optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  staleAfterMs: z.number().int().min(1_000).max(86_400_000).optional(),
  maxSampleAgeMs: z.number().int().min(1_000).max(604_800_000).optional(),
}).strict();

export const sensorBindingsSchema = z.array(sensorBindingSchema).max(10_000);

export const observationBatchSchema = z.object({
  schemaVersion: z.literal("1.0"),
  storeId: z.string().trim().min(1).max(100),
  sourceId: z.string().trim().min(1).max(200),
  sourceSessionId: z.string().trim().min(1).max(200),
  sequence: z.number().int().nonnegative(),
  sampledAt: z.string().datetime(),
  readings: z.array(z.object({
    tag: z.string().trim().min(1).max(300),
    value: jsonPrimitiveSchema,
    quality: z.enum(["GOOD", "UNCERTAIN", "BAD", "STALE"]).optional(),
  })).min(1).max(1_000),
}).strict();

export const decisionReviewRequestSchema = z.object({
  actorId: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2_000).optional(),
}).strict();

export const simulatorControlRequestSchema = z.object({
  action: z.enum(["START", "PAUSE", "RESET"]),
  speed: z.number().min(0.25).max(20).optional(),
}).strict();

export const scenarioStartRequestSchema = z.object({
  durationSeconds: z.number().int().min(5).max(3_600).optional(),
}).strict();

export const agentQuestionRequestSchema = z.object({
  question: z.string().trim().min(1).max(4_000),
  entityIds: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
}).strict();
