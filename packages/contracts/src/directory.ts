import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common";

export const organizationRoleSchema = z.enum(["member", "manager", "hr", "org_admin"]);
export const membershipSchema = z.object({
  orgId: idSchema, userId: idSchema, displayName: z.string().trim().min(1).max(120), email: z.email(),
  roles: z.array(organizationRoleSchema).min(1), status: z.enum(["invited", "active", "inactive"]),
  membershipVersion: z.number().int().positive(),
}).strict();
export const teamAssignmentSchema = z.object({
  orgId: idSchema, teamId: idSchema, userId: idSchema, directManagerId: idSchema.optional(),
  effectiveFrom: isoDateTimeSchema, effectiveTo: isoDateTimeSchema.optional(),
  assignmentVersion: z.number().int().positive(), status: z.enum(["active", "inactive"]),
}).strict();
export const organizationPolicySchema = z.object({
  orgId: idSchema, minimumContributors: z.number().int().min(5).max(100),
  policyVersion: z.number().int().positive(), disclosureGeneration: z.number().int().nonnegative(),
}).strict();

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type TeamAssignment = z.infer<typeof teamAssignmentSchema>;
export type OrganizationPolicy = z.infer<typeof organizationPolicySchema>;
