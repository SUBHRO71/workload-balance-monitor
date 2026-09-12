import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common";

export const humanActionStatusSchema = z.enum(["open", "in_progress", "resolved", "dismissed"]);
export const humanActionScopeSchema = z.enum(["team", "hr"]);
export const humanActionReferenceTypeSchema = z.enum(["observation", "share", "aggregate"]);

export const humanActionInputSchema = z.object({
  rationale: z.string().trim().min(1).max(2000),
  status: humanActionStatusSchema.default("open"),
  followUpAt: isoDateTimeSchema.optional(),
  referenceType: humanActionReferenceTypeSchema.optional(),
  referenceId: idSchema.optional(),
}).strict();

export const humanActionUpdateSchema = z.object({
  rationale: z.string().trim().min(1).max(2000).optional(),
  status: humanActionStatusSchema.optional(),
  followUpAt: isoDateTimeSchema.optional(),
}).strict();

export const humanActionRecordSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  scope: humanActionScopeSchema,
  teamId: idSchema.optional(),
  authorId: idSchema,
  authorName: z.string().trim().min(1).max(120),
  rationale: z.string().trim().min(1).max(2000),
  status: humanActionStatusSchema,
  followUpAt: isoDateTimeSchema.optional(),
  referenceType: humanActionReferenceTypeSchema.optional(),
  referenceId: idSchema.optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
}).strict();

export type HumanActionStatus = z.infer<typeof humanActionStatusSchema>;
export type HumanActionScope = z.infer<typeof humanActionScopeSchema>;
export type HumanActionReferenceType = z.infer<typeof humanActionReferenceTypeSchema>;
export type HumanActionInput = z.infer<typeof humanActionInputSchema>;
export type HumanActionUpdate = z.infer<typeof humanActionUpdateSchema>;
export type HumanActionRecord = z.infer<typeof humanActionRecordSchema>;
