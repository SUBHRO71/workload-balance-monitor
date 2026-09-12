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

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
}).strict();

export const invitationInputSchema = z.object({
  email: z.string().email(),
  roles: z.array(organizationRoleSchema).min(1),
  teamId: idSchema.optional(),
  directManagerId: idSchema.optional(),
}).strict();

export const invitationRecordSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  email: z.string().email(),
  roles: z.array(organizationRoleSchema).min(1),
  teamId: idSchema.optional(),
  directManagerId: idSchema.optional(),
  status: z.enum(["pending", "accepted", "revoked", "expired"]),
  expiresAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
}).strict();

export const acceptInvitationInputSchema = z.object({
  invitationId: idSchema,
  displayName: z.string().trim().min(1).max(120),
}).strict();

export const teamInputSchema = z.object({
  teamId: idSchema,
  teamName: z.string().trim().min(1).max(120),
}).strict();

export const teamRecordSchema = z.object({
  orgId: idSchema,
  teamId: idSchema,
  teamName: z.string().trim().min(1).max(120),
  status: z.enum(["active", "archived"]),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
}).strict();

export const memberUpdateSchema = z.object({
  roles: z.array(organizationRoleSchema).min(1).optional(),
  status: z.enum(["invited", "active", "inactive"]).optional(),
}).strict();

export const policyPatchSchema = z.object({
  minimumContributors: z.number().int().min(5).max(100).optional(),
}).strict();

export const adminAuditRecordSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  actorId: idSchema,
  actorEmail: z.string().optional(),
  action: z.string(),
  targetId: idSchema,
  details: z.record(z.string(), z.unknown()),
  timestamp: isoDateTimeSchema,
}).strict();

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type TeamAssignment = z.infer<typeof teamAssignmentSchema>;
export type OrganizationPolicy = z.infer<typeof organizationPolicySchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type InvitationInput = z.infer<typeof invitationInputSchema>;
export type InvitationRecord = z.infer<typeof invitationRecordSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationInputSchema>;
export type TeamInput = z.infer<typeof teamInputSchema>;
export type TeamRecord = z.infer<typeof teamRecordSchema>;
export type MemberUpdate = z.infer<typeof memberUpdateSchema>;
export type PolicyPatch = z.infer<typeof policyPatchSchema>;
export type AdminAuditRecord = z.infer<typeof adminAuditRecordSchema>;

