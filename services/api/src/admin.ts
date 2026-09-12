import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { AuthorizationError, requireOrganizationAdmin, WorkloadStore } from "@workload/backend-core";
import {
  invitationInputSchema,
  memberUpdateSchema,
  policyPatchSchema,
  teamAssignmentSchema,
  teamInputSchema,
  z,
} from "@workload/contracts";
import { callerFromEvent } from "./identity";
import { json } from "./http";

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error("TABLE_NAME is required");
const store = new WorkloadStore(tableName);

function parseBody<T>(body: string | undefined, schema: z.ZodType<T>): T {
  if (!body) throw new AuthorizationError("Request body is required", 400);
  try {
    const parsed: unknown = JSON.parse(body);
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.issues.map((e) => e.message).join(", ")}`, { cause: error });
    }
    throw error;
  }
}

async function resolveOrgId(callerId: string, headerOrgId?: string): Promise<string> {
  if (headerOrgId) return headerOrgId;
  const memberships = await store.listUserMemberships(callerId);
  if (memberships.length > 0 && memberships[0]?.orgId) return memberships[0].orgId;
  return "default-org";
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const caller = callerFromEvent(event);
    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath.replace(/\/$/, "");
    const headerOrgId = event.headers["x-org-id"];
    const orgId = await resolveOrgId(caller.userId, headerOrgId);

    // Enforce org_admin role boundary
    const adminMembership = await requireOrganizationAdmin(store, caller, orgId);

    // --- Members ---
    if (path === "/v1/admin/members" && method === "GET") {
      const items = await store.listMembers(orgId);
      return json(200, { items });
    }

    const memberMatch = path.match(/^\/v1\/admin\/members\/([A-Za-z0-9_-]+)$/);
    if (memberMatch && method === "PATCH") {
      const userId = memberMatch[1]!;
      const update = parseBody(event.body, memberUpdateSchema);
      const updated = await store.updateMember(orgId, userId, update, caller, adminMembership.email);
      return json(200, updated);
    }

    // --- Invitations ---
    if (path === "/v1/admin/invitations") {
      if (method === "GET") {
        const items = await store.listInvitations(orgId);
        return json(200, { items });
      }
      if (method === "POST") {
        const input = parseBody(event.body, invitationInputSchema);
        const created = await store.createInvitation(orgId, input, caller, adminMembership.email);
        return json(201, created);
      }
    }

    // --- Teams ---
    if (path === "/v1/admin/teams") {
      if (method === "GET") {
        const items = await store.listTeams(orgId);
        return json(200, { items });
      }
      if (method === "POST") {
        const input = parseBody(event.body, teamInputSchema);
        const created = await store.createTeam(orgId, input, caller, adminMembership.email);
        return json(201, created);
      }
    }

    const teamMatch = path.match(/^\/v1\/admin\/teams\/([A-Za-z0-9_-]+)$/);
    if (teamMatch && method === "PATCH") {
      const teamId = teamMatch[1]!;
      const update = parseBody(
        event.body,
        z.object({
          teamName: z.string().trim().min(1).max(120).optional(),
          status: z.enum(["active", "archived"]).optional(),
        }).strict(),
      );
      const updated = await store.updateTeam(orgId, teamId, update, caller, adminMembership.email);
      return json(200, updated);
    }

    // --- Team Member Assignment / Removal ---
    const teamMemberMatch = path.match(/^\/v1\/admin\/teams\/([A-Za-z0-9_-]+)\/members\/([A-Za-z0-9_-]+)$/);
    if (teamMemberMatch) {
      const teamId = teamMemberMatch[1]!;
      const userId = teamMemberMatch[2]!;

      if (method === "PUT") {
        const assignmentInput = parseBody(
          event.body,
          teamAssignmentSchema.pick({ directManagerId: true, effectiveFrom: true, effectiveTo: true }).partial(),
        );
        const assignment = await store.assignTeamMember(orgId, teamId, userId, assignmentInput, caller, adminMembership.email);
        return json(200, assignment);
      }

      if (method === "DELETE") {
        await store.removeTeamMember(orgId, teamId, userId, caller, adminMembership.email);
        return json(200, { success: true, teamId, userId });
      }
    }

    // --- Policies ---
    if (path === "/v1/admin/policies") {
      if (method === "GET") {
        const policy = await store.getOrganizationPolicy(orgId);
        return json(200, policy);
      }
      if (method === "PATCH") {
        const patch = parseBody(event.body, policyPatchSchema);
        const updated = await store.patchOrganizationPolicy(orgId, patch, caller, adminMembership.email);
        return json(200, updated);
      }
    }

    // --- Audit ---
    if (path === "/v1/admin/audit" && method === "GET") {
      const items = await store.listAdminAuditEvents(orgId);
      return json(200, { items });
    }

    return json(404, { code: "NOT_FOUND", message: `Admin route ${method} ${path} is not found.` });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return json(error.statusCode, { code: "FORBIDDEN", message: error.message });
    }
    if (error instanceof Error && error.message.startsWith("Validation failed")) {
      return json(400, { code: "VALIDATION_ERROR", message: error.message });
    }
    console.error("admin_request_failed", {
      requestId: event.requestContext.requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown",
    });
    return json(500, { code: "INTERNAL_ERROR", message: "Request failed." });
  }
};
