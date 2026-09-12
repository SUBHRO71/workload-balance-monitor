import { z } from "zod";
import { entityVersionSchema, idSchema, isoDateSchema, isoDateTimeSchema, sourceSchema } from "./common";

export const effortSchema = z.object({ value: z.number().finite().positive().max(10000), unit: z.enum(["hours", "points"]) }).strict();
export const taskStatusSchema = z.enum(["planned", "in_progress", "blocked", "done", "cancelled"]);
export const taskPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(200), workDate: isoDateSchema, effort: effortSchema,
  status: taskStatusSchema.default("planned"), priority: taskPrioritySchema.optional(), dueAt: isoDateTimeSchema.optional(),
}).strict();
export const taskRecordSchema = taskInputSchema.extend({
  entityType: z.literal("TASK"), id: idSchema, orgId: idSchema, ownerId: idSchema, source: sourceSchema,
}).merge(entityVersionSchema);
export const checkInInputSchema = z.object({
  checkInDate: isoDateSchema, manageability: z.number().int().min(1).max(5),
  privateNote: z.string().trim().max(2000).optional(),
}).strict();
export const checkInRecordSchema = checkInInputSchema.extend({
  entityType: z.literal("CHECKIN"), id: idSchema, orgId: idSchema, ownerId: idSchema, source: sourceSchema,
}).merge(entityVersionSchema);
export const workloadPreferencesSchema = z.object({
  timezone: z.string().trim().min(1).max(100), weeklyCapacity: effortSchema.optional(),
  workdays: z.array(z.number().int().min(1).max(7)).max(7).default([]),
  preferredCheckInDay: z.number().int().min(1).max(7).optional(),
}).strict();

export const taskUpdateSchema = taskInputSchema.partial().extend({ expectedVersion: z.number().int().positive().optional() });
export const checkInUpdateSchema = checkInInputSchema.partial().extend({ expectedVersion: z.number().int().positive().optional() });
export const workloadPreferencesUpdateSchema = workloadPreferencesSchema.partial();

export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type TaskRecord = z.infer<typeof taskRecordSchema>;
export type CheckInInput = z.infer<typeof checkInInputSchema>;
export type CheckInUpdate = z.infer<typeof checkInUpdateSchema>;
export type CheckInRecord = z.infer<typeof checkInRecordSchema>;
export type WorkloadPreferences = z.infer<typeof workloadPreferencesSchema>;
export type WorkloadPreferencesUpdate = z.infer<typeof workloadPreferencesUpdateSchema>;
