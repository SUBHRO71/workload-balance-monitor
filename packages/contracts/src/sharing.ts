import { z } from "zod";
import { dateRangeSchema, entityVersionSchema, idSchema, isoDateTimeSchema } from "./common";

export const taskShareFieldSchema = z.enum(["title", "workDate", "effort", "status", "priority", "dueAt"]);
export const checkInShareFieldSchema = z.enum(["checkInDate", "manageability"]);
export const summaryShareFieldSchema = z.enum(["weeklyEffort", "manageabilityTrend", "evidenceStrength"]);
export const shareSelectionSchema = z.discriminatedUnion("recordType", [
  z.object({ recordType: z.literal("task"), recordId: idSchema, recordVersion: z.number().int().positive(), fields: z.array(taskShareFieldSchema).min(1) }).strict(),
  z.object({ recordType: z.literal("check_in"), recordId: idSchema, recordVersion: z.number().int().positive(), fields: z.array(checkInShareFieldSchema).min(1) }).strict(),
  z.object({ recordType: z.literal("summary"), recordId: idSchema, recordVersion: z.number().int().positive(), fields: z.array(summaryShareFieldSchema).min(1) }).strict(),
]);
export const sharingGrantInputSchema = z.object({
  recipientManagerId: idSchema, range: dateRangeSchema, expiresAt: isoDateTimeSchema,
  selections: z.array(shareSelectionSchema).min(1).max(100),
}).strict();
export const sharingGrantSchema = sharingGrantInputSchema.extend({
  entityType: z.literal("SHARING_GRANT"), id: idSchema, orgId: idSchema, ownerId: idSchema,
  status: z.enum(["active", "expired", "revoked", "invalidated"]), gateGeneration: z.number().int().nonnegative(),
  assignmentVersion: z.number().int().positive(),
}).merge(entityVersionSchema);
export const publicationSchema = z.object({
  entityType: z.literal("PUBLICATION"), grantId: idSchema, publicationVersion: z.number().int().positive(),
  orgId: idSchema, ownerId: idSchema, recipientManagerId: idSchema, range: dateRangeSchema,
  expiresAt: isoDateTimeSchema,
  selectedValues: z.array(z.object({ selection: shareSelectionSchema, values: z.record(z.string(), z.unknown()) }).strict()).min(1),
}).merge(entityVersionSchema);

export type TaskShareField = z.infer<typeof taskShareFieldSchema>;
export type CheckInShareField = z.infer<typeof checkInShareFieldSchema>;
export type SummaryShareField = z.infer<typeof summaryShareFieldSchema>;
export type ShareSelection = z.infer<typeof shareSelectionSchema>;
export type SharingGrantInput = z.infer<typeof sharingGrantInputSchema>;
export type SharingGrant = z.infer<typeof sharingGrantSchema>;
export type Publication = z.infer<typeof publicationSchema>;
