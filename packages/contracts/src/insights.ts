import { z } from "zod";
import { dateRangeSchema, entityVersionSchema, idSchema, isoDateTimeSchema } from "./common";

export const evidenceStrengthSchema = z.enum(["limited", "developing", "consistent"]);
export const suggestionCategorySchema = z.enum(["reprioritize", "recovery", "manager_review"]);
export const observationSchema = z.object({
  entityType: z.literal("OBSERVATION"), id: idSchema, orgId: idSchema, ownerId: idSchema,
  range: dateRangeSchema, evidenceRecordIds: z.array(idSchema), ruleVersion: z.string().min(1).max(40),
  evidenceStrength: evidenceStrengthSchema, category: suggestionCategorySchema,
  title: z.string().min(1).max(200), explanation: z.string().min(1).max(1000),
  status: z.enum(["active", "dismissed", "disputed", "corrected"]), generatedAt: isoDateTimeSchema,
}).merge(entityVersionSchema);
export const aggregateMetricSchema = z.object({
  key: z.enum(["meanWeeklyEffort", "meanManageability", "capacityRatio"]), value: z.number().finite(),
  contributorCountBand: z.enum(["5-9", "10-19", "20+"]),
}).strict();
export const aggregateResponseSchema = z.object({
  state: z.enum(["available", "insufficient_contributors", "unsafe_overlap", "invalid", "stale"]),
  range: dateRangeSchema, generatedAt: isoDateTimeSchema.optional(), evidenceStrength: evidenceStrengthSchema,
  metrics: z.array(aggregateMetricSchema).optional(), reason: z.string().max(300).optional(),
}).strict().superRefine((value, context) => {
  if (value.state === "available" && !value.metrics?.length) context.addIssue({ code: "custom", message: "available aggregates require metrics", path: ["metrics"] });
  if (value.state !== "available" && value.metrics !== undefined) context.addIssue({ code: "custom", message: "suppressed aggregates must omit metrics", path: ["metrics"] });
});

export const observationUpdateSchema = z.object({
  status: z.enum(["active", "dismissed", "disputed", "corrected"]),
}).strict();

export const correctionInputSchema = z.object({
  sourceOrObservationId: idSchema,
  disputedVersion: z.number().int().positive().optional(),
  reason: z.string().trim().min(1).max(500),
}).strict();

export const correctionRecordSchema = correctionInputSchema.extend({
  entityType: z.literal("CORRECTION"),
  id: idSchema,
  orgId: idSchema,
  ownerId: idSchema,
  status: z.enum(["pending", "resolved"]).default("resolved"),
}).merge(entityVersionSchema);

export type EvidenceStrength = z.infer<typeof evidenceStrengthSchema>;
export type SuggestionCategory = z.infer<typeof suggestionCategorySchema>;
export type Observation = z.infer<typeof observationSchema>;
export type ObservationUpdate = z.infer<typeof observationUpdateSchema>;
export type CorrectionInput = z.infer<typeof correctionInputSchema>;
export type CorrectionRecord = z.infer<typeof correctionRecordSchema>;
export type AggregateResponse = z.infer<typeof aggregateResponseSchema>;
