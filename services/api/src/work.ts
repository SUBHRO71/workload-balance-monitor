import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import {
  AuthorizationError,
  requireHr,
  requireRole,
  requireTeamManager,
  WorkloadStore,
} from "@workload/backend-core";
import {
  humanActionInputSchema,
  humanActionUpdateSchema,
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
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    const headerOrgId = event.headers["x-org-id"];
    const orgId = await resolveOrgId(caller.userId, headerOrgId);

    // Manager sharing review
    if (path === "/v1/manager/shares" && method === "GET") {
      const publications = await store.listManagerPublications(orgId, caller);
      return json(200, { items: publications });
    }

    const shareDetailMatch = path.match(/^\/v1\/manager\/shares\/([A-Za-z0-9_-]+)$/);
    if (shareDetailMatch && method === "GET") {
      const grantId = shareDetailMatch[1]!;
      const result = await store.getManagerPublication(orgId, caller, grantId);
      return json(200, result);
    }

    // Manager assigned teams
    if (path === "/v1/manager/teams" && method === "GET") {
      const teams = await store.listManagerTeams(orgId, caller);
      return json(200, { items: teams });
    }

    // Manager team aggregate / trends
    const teamTrendsMatch = path.match(/^\/v1\/manager\/teams\/([A-Za-z0-9_-]+)\/(trends|aggregates)$/);
    if (teamTrendsMatch && method === "GET") {
      const teamId = teamTrendsMatch[1]!;
      const from = event.queryStringParameters?.from ?? event.queryStringParameters?.startDate;
      const to = event.queryStringParameters?.to ?? event.queryStringParameters?.endDate;
      const range = from && to ? { from, to } : undefined;
      const aggregate = await store.getTeamAggregate(orgId, teamId, caller, range);
      return json(200, aggregate);
    }

    // Manager team aggregate observations
    const teamObservationsMatch = path.match(/^\/v1\/manager\/teams\/([A-Za-z0-9_-]+)\/observations$/);
    if (teamObservationsMatch && method === "GET") {
      const teamId = teamObservationsMatch[1]!;
      const aggregate = await store.getTeamAggregate(orgId, teamId, caller);
      const items = [];
      if (aggregate.state === "available") {
        const effortMetric = aggregate.metrics?.find((m) => m.key === "meanWeeklyEffort");
        const manageabilityMetric = aggregate.metrics?.find((m) => m.key === "meanManageability");
        if (effortMetric && effortMetric.value > 40) {
          items.push({
            category: "reprioritize",
            title: "Team average effort is elevated",
            explanation: `Average weekly effort for this team is ${effortMetric.value} hours. Review workload distribution.`,
          });
        }
        if (manageabilityMetric && manageabilityMetric.value < 3) {
          items.push({
            category: "recovery",
            title: "Team manageability rating is low",
            explanation: `Average manageability rating is ${manageabilityMetric.value}/5. Consider team recovery initiatives.`,
          });
        }
      }
      return json(200, { items });
    }

    // HR organization aggregate / trends
    if ((path === "/v1/hr/trends" || path === "/v1/hr/aggregates") && method === "GET") {
      const from = event.queryStringParameters?.from ?? event.queryStringParameters?.startDate;
      const to = event.queryStringParameters?.to ?? event.queryStringParameters?.endDate;
      const range = from && to ? { from, to } : undefined;
      const aggregate = await store.getOrgAggregate(orgId, caller, range);
      return json(200, aggregate);
    }

    // HR organization observations
    if (path === "/v1/hr/observations" && method === "GET") {
      const aggregate = await store.getOrgAggregate(orgId, caller);
      const items = [];
      if (aggregate.state === "available") {
        const effortMetric = aggregate.metrics?.find((m) => m.key === "meanWeeklyEffort");
        if (effortMetric && effortMetric.value > 40) {
          items.push({
            category: "reprioritize",
            title: "Organization average effort is elevated",
            explanation: `Organization-wide average effort is ${effortMetric.value} hours across contributing cohorts.`,
          });
        }
      }
      return json(200, { items });
    }

    // Manager actions
    const teamActionsMatch = path.match(/^\/v1\/manager\/teams\/([A-Za-z0-9_-]+)\/actions$/);
    if (teamActionsMatch) {
      const teamId = teamActionsMatch[1]!;
      await requireTeamManager(store, caller, orgId, teamId);
      if (method === "GET") {
        const items = await store.listHumanActions(orgId, "team", teamId);
        return json(200, { items });
      }
      if (method === "POST") {
        const membership = await requireRole(store, caller, orgId, "manager");
        const input = parseBody(event.body, humanActionInputSchema);
        const created = await store.createHumanAction(orgId, "team", teamId, input, {
          userId: caller.userId,
          displayName: membership.displayName,
        });
        return json(201, created);
      }
    }

    const teamActionDetailMatch = path.match(/^\/v1\/manager\/teams\/([A-Za-z0-9_-]+)\/actions\/([A-Za-z0-9_-]+)$/);
    if (teamActionDetailMatch) {
      const teamId = teamActionDetailMatch[1]!;
      const actionId = teamActionDetailMatch[2]!;
      await requireTeamManager(store, caller, orgId, teamId);
      if (method === "GET") {
        const action = await store.getHumanAction(orgId, "team", actionId, teamId);
        if (!action) return json(404, { code: "NOT_FOUND", message: "Action not found" });
        return json(200, action);
      }
      if (method === "PATCH") {
        const update = parseBody(event.body, humanActionUpdateSchema);
        const updated = await store.updateHumanAction(orgId, "team", actionId, update, teamId);
        return json(200, updated);
      }
    }

    // HR actions
    if (path === "/v1/hr/actions") {
      await requireHr(store, caller, orgId);
      if (method === "GET") {
        const items = await store.listHumanActions(orgId, "hr");
        return json(200, { items });
      }
      if (method === "POST") {
        const membership = await requireHr(store, caller, orgId);
        const input = parseBody(event.body, humanActionInputSchema);
        const created = await store.createHumanAction(orgId, "hr", undefined, input, {
          userId: caller.userId,
          displayName: membership.displayName,
        });
        return json(201, created);
      }
    }

    const hrActionDetailMatch = path.match(/^\/v1\/hr\/actions\/([A-Za-z0-9_-]+)$/);
    if (hrActionDetailMatch) {
      const actionId = hrActionDetailMatch[1]!;
      await requireHr(store, caller, orgId);
      if (method === "GET") {
        const action = await store.getHumanAction(orgId, "hr", actionId);
        if (!action) return json(404, { code: "NOT_FOUND", message: "Action not found" });
        return json(200, action);
      }
      if (method === "PATCH") {
        const update = parseBody(event.body, humanActionUpdateSchema);
        const updated = await store.updateHumanAction(orgId, "hr", actionId, update);
        return json(200, updated);
      }
    }

    return json(404, { code: "NOT_FOUND", message: `Work route ${method} ${path} is not found.` });
  } catch (error) {
    if (error instanceof AuthorizationError) return json(error.statusCode, { code: "FORBIDDEN", message: error.message });
    if (error instanceof Error && error.message.startsWith("Validation failed")) {
      return json(400, { code: "VALIDATION_ERROR", message: error.message });
    }
    console.error("work_request_failed", {
      requestId: event.requestContext.requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown",
    });
    return json(500, { code: "INTERNAL_ERROR", message: "Request failed." });
  }
};
