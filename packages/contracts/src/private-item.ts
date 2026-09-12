import { z } from "zod";
import { entityVersionSchema, idSchema, isoDateTimeSchema } from "./common";

export const privateItemTypeSchema = z.enum(["note", "personal_goal", "leave_detail", "personal_deadline", "reminder", "commitment", "other"]);
const base = z.object({ type: privateItemTypeSchema, title: z.string().trim().min(1).max(200), content: z.string().trim().max(5000).optional() });
export const privateItemInputSchema = z.discriminatedUnion("lifecycle", [
  base.extend({ lifecycle: z.literal("ongoing") }).strict(),
  base.extend({ lifecycle: z.literal("one_time"), eventEndAt: isoDateTimeSchema }).strict(),
]);
const stored = { entityType: z.literal("PRIVATE_ITEM"), id: idSchema, orgId: idSchema, ownerId: idSchema };
export const privateItemRecordSchema = z.discriminatedUnion("lifecycle", [
  base.extend({ ...stored, lifecycle: z.literal("ongoing") }).merge(entityVersionSchema),
  base.extend({ ...stored, lifecycle: z.literal("one_time"), eventEndAt: isoDateTimeSchema, deleteAfter: isoDateTimeSchema }).merge(entityVersionSchema),
]);

export const privateItemUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().max(5000).optional(),
  eventEndAt: isoDateTimeSchema.optional(),
}).strict();

export type PrivateItemInput = z.infer<typeof privateItemInputSchema>;
export type PrivateItemUpdate = z.infer<typeof privateItemUpdateSchema>;
export type PrivateItemRecord = z.infer<typeof privateItemRecordSchema>;
