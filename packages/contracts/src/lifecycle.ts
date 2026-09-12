import { z } from "zod";
import { entityVersionSchema, idSchema, isoDateTimeSchema } from "./common";
import { consentRecordSchema } from "./consent";
import { correctionRecordSchema, observationSchema } from "./insights";
import { notificationRecordSchema } from "./notifications";
import { privateItemRecordSchema } from "./private-item";
import { sharingGrantSchema } from "./sharing";
import { checkInRecordSchema, taskRecordSchema, workloadPreferencesSchema } from "./workload";

export const exportScopeSchema = z.enum(["all", "personal_records", "tasks", "checkins", "shares"]);
export type ExportScope = z.infer<typeof exportScopeSchema>;

export const exportRequestSchema = z.object({
  scope: exportScopeSchema.default("all"),
}).strict();
export type ExportRequest = z.infer<typeof exportRequestSchema>;

export const deletionScopeSchema = z.enum(["all", "personal_records", "shares"]);
export type DeletionScope = z.infer<typeof deletionScopeSchema>;

export const deletionRequestSchema = z.object({
  scope: deletionScopeSchema.default("all"),
  confirmed: z.literal(true),
}).strict();
export type DeletionRequest = z.infer<typeof deletionRequestSchema>;

export const jobKindSchema = z.enum(["export", "delete", "retention_cleanup"]);
export type JobKind = z.infer<typeof jobKindSchema>;

export const jobStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const lifecycleJobRecordSchema = z.object({
  entityType: z.literal("JOB"),
  id: idSchema,
  orgId: idSchema,
  ownerId: idSchema,
  kind: jobKindSchema,
  status: jobStatusSchema,
  scope: z.string(),
  expiresAt: isoDateTimeSchema,
  s3Key: z.string().optional(),
  downloadUrl: z.string().optional(),
  error: z.string().optional(),
}).merge(entityVersionSchema);
export type LifecycleJobRecord = z.infer<typeof lifecycleJobRecordSchema>;

export const ownerExportDataSchema = z.object({
  exportId: idSchema,
  generatedAt: isoDateTimeSchema,
  orgId: idSchema,
  userId: idSchema,
  metadata: z.object({
    version: z.number().int(),
    schemaVersion: z.literal(1),
    notice: z.string(),
    downloadExpiresAt: isoDateTimeSchema,
  }),
  preferences: workloadPreferencesSchema.optional(),
  consent: consentRecordSchema.optional(),
  tasks: z.array(taskRecordSchema),
  checkIns: z.array(checkInRecordSchema),
  privateItems: z.array(privateItemRecordSchema),
  observations: z.array(observationSchema),
  corrections: z.array(correctionRecordSchema),
  grants: z.array(sharingGrantSchema),
  notifications: z.array(notificationRecordSchema),
});
export type OwnerExportData = z.infer<typeof ownerExportDataSchema>;
