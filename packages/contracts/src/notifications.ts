import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common";

export const notificationCategorySchema = z.enum(["share", "observation", "policy", "reminder", "system"]);

export const notificationRecordSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  userId: idSchema,
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(1000),
  category: notificationCategorySchema,
  read: z.boolean(),
  link: z.string().trim().min(1).max(500).optional(),
  createdAt: isoDateTimeSchema,
}).strict();

export const notificationUpdateSchema = z.object({
  read: z.boolean(),
}).strict();

export const notificationPreferencesSchema = z.object({
  inAppEnabled: z.boolean().default(true),
  emailEnabled: z.boolean().default(false),
  weeklyDigestEnabled: z.boolean().default(false),
}).strict();

export type NotificationCategory = z.infer<typeof notificationCategorySchema>;
export type NotificationRecord = z.infer<typeof notificationRecordSchema>;
export type NotificationUpdate = z.infer<typeof notificationUpdateSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
