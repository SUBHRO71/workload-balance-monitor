import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { AuthorizationError, WorkloadStore } from "@workload/backend-core";
import { callerFromEvent } from "./identity";
import { json } from "./http";

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error("TABLE_NAME is required");
const store = new WorkloadStore(tableName);

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const caller = callerFromEvent(event);
    if (event.requestContext.http.method === "GET" && event.rawPath.endsWith("/v1/me")) {
      const memberships = await store.listUserMemberships(caller.userId);
      return json(200, { userId: caller.userId, memberships: memberships.map(({ orgId, displayName, roles, status, membershipVersion }) => ({ orgId, displayName, roles, status, membershipVersion })) });
    }
    return json(503, { code: "NOT_IMPLEMENTED", message: "This personal API route is not implemented in Phase 1." });
  } catch (error) {
    if (error instanceof AuthorizationError) return json(error.statusCode, { code: "FORBIDDEN", message: error.message });
    console.error("personal_request_failed", { requestId: event.requestContext.requestId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return json(500, { code: "INTERNAL_ERROR", message: "Request failed." });
  }
};
