import { z } from "zod";

export const consentSchema = z.object({
  personalProcessing: z.boolean().default(false),
  teamAggregation: z.boolean().default(false),
  notifications: z.boolean().default(false),
}).strict();

export type ConsentScopes = z.infer<typeof consentSchema>;
