import { z } from "zod";

export const idSchema = z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/);
export const isoDateSchema = z.iso.date();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const entityVersionSchema = z.object({
  schemaVersion: z.literal(1), version: z.number().int().positive(),
  createdAt: isoDateTimeSchema, updatedAt: isoDateTimeSchema,
});
export const sourceSchema = z.enum(["user", "synthetic"]);
export const pageRequestSchema = z.object({
  cursor: z.string().max(2048).optional(), limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export const dateRangeSchema = z.object({ from: isoDateSchema, to: isoDateSchema }).strict()
  .refine(({ from, to }) => from <= to, { message: "from must be on or before to", path: ["to"] });

export type DateRange = z.infer<typeof dateRangeSchema>;
