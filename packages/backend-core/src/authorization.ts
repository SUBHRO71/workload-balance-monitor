import type { Membership, OrganizationRole, SharingGrant, TeamAssignment } from "@workload/contracts";
import { isGrantReadable } from "./keys";

export class AuthorizationError extends Error {
  readonly statusCode: 400 | 401 | 403 | 404 | 409;
  constructor(message: string, statusCode: 400 | 401 | 403 | 404 | 409 = 403) {
    super(message); this.name = "AuthorizationError"; this.statusCode = statusCode;
  }
}

export interface CallerIdentity { userId: string; tokenGroups: string[] }
export interface AuthorizationStore {
  getMembership(orgId: string, userId: string): Promise<Membership | undefined>;
  getActiveAssignmentsForUser(orgId: string, userId: string): Promise<TeamAssignment[]>;
  isManagerOfTeam(orgId: string, teamId: string, managerId: string): Promise<boolean>;
}

export function callerFromJwtClaims(claims: Record<string, unknown>): CallerIdentity {
  const userId = claims.sub;
  if (typeof userId !== "string" || !userId) throw new AuthorizationError("Authenticated subject is missing", 401);
  const rawGroups = claims["cognito:groups"];
  let tokenGroups: string[] = [];
  if (Array.isArray(rawGroups)) {
    tokenGroups = rawGroups.filter((value): value is string => typeof value === "string");
  } else if (typeof rawGroups === "string" && rawGroups) {
    try { const parsed: unknown = JSON.parse(rawGroups); tokenGroups = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [rawGroups]; }
    catch { tokenGroups = rawGroups.split(",").map((value) => value.trim()).filter(Boolean); }
  }
  return { userId, tokenGroups };
}

export function requireOwner(caller: CallerIdentity, ownerId: string): void {
  if (caller.userId !== ownerId) throw new AuthorizationError("Resource is not available", 404);
}

export async function requireRole(store: AuthorizationStore, caller: CallerIdentity, orgId: string, role: OrganizationRole): Promise<Membership> {
  const membership = await store.getMembership(orgId, caller.userId);
  if (!membership || membership.status !== "active" || !membership.roles.includes(role)) throw new AuthorizationError("Organization role is not available");
  return membership;
}

export async function requireAssignedManager(store: AuthorizationStore, caller: CallerIdentity, orgId: string, ownerId: string): Promise<TeamAssignment> {
  await requireRole(store, caller, orgId, "manager");
  const assignments = await store.getActiveAssignmentsForUser(orgId, ownerId);
  const match = assignments.find((assignment) => assignment.status === "active" && assignment.directManagerId === caller.userId);
  if (!match) throw new AuthorizationError("Shared publication is not available", 404);
  return match;
}

export async function requireManagerPublication(
  store: AuthorizationStore, caller: CallerIdentity, grant: SharingGrant, now = new Date(),
): Promise<void> {
  if (grant.recipientManagerId !== caller.userId || !isGrantReadable(grant, now)) throw new AuthorizationError("Shared publication is not available", 404);
  const assignment = await requireAssignedManager(store, caller, grant.orgId, grant.ownerId);
  if (assignment.assignmentVersion !== grant.assignmentVersion) throw new AuthorizationError("Shared publication is no longer available", 404);
}

export async function requireTeamManager(store: AuthorizationStore, caller: CallerIdentity, orgId: string, teamId: string): Promise<void> {
  await requireRole(store, caller, orgId, "manager");
  if (!(await store.isManagerOfTeam(orgId, teamId, caller.userId))) {
    throw new AuthorizationError("Team is not available", 404);
  }
}

export const requireHr = (store: AuthorizationStore, caller: CallerIdentity, orgId: string) => requireRole(store, caller, orgId, "hr");
export const requireOrganizationAdmin = (store: AuthorizationStore, caller: CallerIdentity, orgId: string) => requireRole(store, caller, orgId, "org_admin");
