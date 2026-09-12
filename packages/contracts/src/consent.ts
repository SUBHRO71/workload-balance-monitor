import { z } from "zod";
import { entityVersionSchema, isoDateTimeSchema } from "./common";

export const notificationConsentSchema = z.object({
  inApp: z.boolean().default(false), managerEmail: z.boolean().default(false),
  devicePush: z.literal(false).default(false),
}).strict().default({ inApp: false, managerEmail: false, devicePush: false });

export const consentScopesSchema = z.object({
  personalProcessing: z.boolean().default(false), teamAggregation: z.boolean().default(false),
  organizationAggregation: z.boolean().default(false), notifications: notificationConsentSchema,
}).strict();
export const consentRecordSchema = consentScopesSchema.extend({
  entityType: z.literal("CONSENT"), effectiveAt: isoDateTimeSchema,
}).merge(entityVersionSchema);

export const consentSchema = consentScopesSchema;
export type ConsentScopes = z.infer<typeof consentScopesSchema>;
export type ConsentRecord = z.infer<typeof consentRecordSchema>;
