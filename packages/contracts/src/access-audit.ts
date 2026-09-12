import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common";

export const accessAuditRecordSchema = z.object({
  entityType: z.literal("ACCESS_AUDIT"),
  id: idSchema,
  orgId: idSchema,
  ownerId: idSchema,
  recipientId: idSchema,
  grantId: idSchema,
  action: z.literal("grant.read"),
  timestamp: isoDateTimeSchema,
}).strict();
export type AccessAuditRecord = z.infer<typeof accessAuditRecordSchema>;
