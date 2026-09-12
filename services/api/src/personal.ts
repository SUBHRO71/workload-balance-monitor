import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { AuthorizationError, WorkloadStore } from "@workload/backend-core";
import {
  acceptInvitationInputSchema,
  checkInInputSchema,
  checkInUpdateSchema,
  consentScopesSchema,
  correctionInputSchema,
  deletionRequestSchema,
  exportRequestSchema,
  notificationPreferencesSchema,
  notificationUpdateSchema,
  observationUpdateSchema,
  privateItemInputSchema,
  privateItemUpdateSchema,
  profileUpdateSchema,
  sharingGrantInputSchema,
  taskInputSchema,
  taskUpdateSchema,
  workloadPreferencesUpdateSchema,
  z,
} from "@workload/contracts";
import { callerFromEvent } from "./identity";
import { json } from "./http";

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error("TABLE_NAME is required");
const store = new WorkloadStore(tableName);

function parseBody<T>(body: string | undefined, schema: z.ZodType<T>): T {
  if (!body) throw new AuthorizationError("Request body is required", 401);
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

    // Profile & Memberships
    if (path === "/v1/me" && method === "GET") {
      const memberships = await store.listUserMemberships(caller.userId);
      return json(200, {
        userId: caller.userId,
        memberships: memberships.map(({ orgId, displayName, roles, status, membershipVersion }) => ({
          orgId, displayName, roles, status, membershipVersion,
        })),
      });
    }

    if (path === "/v1/me/profile" && method === "PATCH") {
      const update = parseBody(event.body, profileUpdateSchema);
      const updated = await store.updateProfile(orgId, caller.userId, update.displayName);
      return json(200, updated);
    }

    // Preferences
    if (path === "/v1/me/preferences") {
      if (method === "GET") {
        const preferences = await store.getPreferences(orgId, caller.userId);
        return json(200, preferences);
      }
      if (method === "PATCH") {
        const update = parseBody(event.body, workloadPreferencesUpdateSchema);
        const updated = await store.putPreferences(orgId, caller.userId, update);
        return json(200, updated);
      }
    }

    // Consent
    if (path === "/v1/me/consent") {
      if (method === "GET") {
        const consent = await store.getConsent(orgId, caller.userId);
        return json(200, consent);
      }
      if (method === "PUT") {
        const scopes = parseBody(event.body, consentScopesSchema);
        const updated = await store.putConsent(orgId, caller.userId, scopes);
        return json(200, updated);
      }
    }

    // Dashboard
    if (path === "/v1/me/dashboard" && method === "GET") {
      const consent = await store.getConsent(orgId, caller.userId);
      if (!consent.personalProcessing) {
        return json(200, {
          state: "consent_required",
          message: "Personal processing is disabled. Enable consent in Settings to view trends.",
          tasks: [], checkIns: [], points: [], insights: [],
        });
      }
      const trends = await store.getPersonalTrends(orgId, caller.userId);
      const { items: recentTasks } = await store.listTasks(orgId, caller.userId, 10);
      const { items: recentCheckIns } = await store.listCheckIns(orgId, caller.userId, 5);
      return json(200, {
        state: "available",
        recentTasks,
        recentCheckIns,
        points: trends.points,
        evidenceStrength: trends.evidenceStrength,
        insights: trends.insights,
        preferences: trends.preferences,
      });
    }

    // Tasks CRUD
    if (path === "/v1/me/tasks") {
      if (method === "GET") {
        const limit = event.queryStringParameters?.limit ? Number(event.queryStringParameters.limit) : 50;
        const cursor = event.queryStringParameters?.cursor;
        const result = await store.listTasks(orgId, caller.userId, limit, cursor);
        return json(200, result);
      }
      if (method === "POST") {
        const input = parseBody(event.body, taskInputSchema);
        const idempotencyKey = event.headers?.["idempotency-key"] ?? event.headers?.["Idempotency-Key"];
        if (!idempotencyKey) throw new AuthorizationError("Idempotency-Key header is required", 400);
        const created = await store.createTask(orgId, caller.userId, input, idempotencyKey);
        return json(201, created);
      }
    }

    const taskMatch = path.match(/^\/v1\/me\/tasks\/([A-Za-z0-9_-]+)$/);
    if (taskMatch) {
      const taskId = taskMatch[1]!;
      if (method === "GET") {
        const task = await store.getTask(orgId, caller.userId, taskId);
        if (!task) return json(404, { code: "NOT_FOUND", message: "Task not found" });
        return json(200, task);
      }
      if (method === "PATCH") {
        const update = parseBody(event.body, taskUpdateSchema);
        const updated = await store.updateTask(orgId, caller.userId, taskId, update);
        return json(200, updated);
      }
      if (method === "DELETE") {
        await store.deleteTask(orgId, caller.userId, taskId);
        return json(200, { ok: true });
      }
    }

    // Check-ins CRUD
    if (path === "/v1/me/check-ins") {
      if (method === "GET") {
        const limit = event.queryStringParameters?.limit ? Number(event.queryStringParameters.limit) : 50;
        const cursor = event.queryStringParameters?.cursor;
        const result = await store.listCheckIns(orgId, caller.userId, limit, cursor);
        return json(200, result);
      }
      if (method === "POST") {
        const input = parseBody(event.body, checkInInputSchema);
        const idempotencyKey = event.headers?.["idempotency-key"] ?? event.headers?.["Idempotency-Key"];
        if (!idempotencyKey) throw new AuthorizationError("Idempotency-Key header is required", 400);
        const created = await store.createCheckIn(orgId, caller.userId, input, idempotencyKey);
        return json(201, created);
      }
    }

    const checkInMatch = path.match(/^\/v1\/me\/check-ins\/([A-Za-z0-9_-]+)$/);
    if (checkInMatch) {
      const checkInId = checkInMatch[1]!;
      if (method === "GET") {
        const checkIn = await store.getCheckIn(orgId, caller.userId, checkInId);
        if (!checkIn) return json(404, { code: "NOT_FOUND", message: "Check-in not found" });
        return json(200, checkIn);
      }
      if (method === "PATCH") {
        const update = parseBody(event.body, checkInUpdateSchema);
        const updated = await store.updateCheckIn(orgId, caller.userId, checkInId, update);
        return json(200, updated);
      }
      if (method === "DELETE") {
        await store.deleteCheckIn(orgId, caller.userId, checkInId);
        return json(200, { ok: true });
      }
    }

    // Private Items CRUD
    if (path === "/v1/me/private-items") {
      if (method === "GET") {
        const limit = event.queryStringParameters?.limit ? Number(event.queryStringParameters.limit) : 50;
        const cursor = event.queryStringParameters?.cursor;
        const result = await store.listPrivateItems(orgId, caller.userId, limit, cursor);
        return json(200, result);
      }
      if (method === "POST") {
        const input = parseBody(event.body, privateItemInputSchema);
        const created = await store.createPrivateItem(orgId, caller.userId, input);
        return json(201, created);
      }
    }

    const itemMatch = path.match(/^\/v1\/me\/private-items\/([A-Za-z0-9_-]+)$/);
    if (itemMatch) {
      const itemId = itemMatch[1]!;
      if (method === "GET") {
        const item = await store.getPrivateItem(orgId, caller.userId, itemId);
        if (!item) return json(404, { code: "NOT_FOUND", message: "Private item not found" });
        return json(200, item);
      }
      if (method === "PATCH") {
        const update = parseBody(event.body, privateItemUpdateSchema);
        const updated = await store.updatePrivateItem(orgId, caller.userId, itemId, update);
        return json(200, updated);
      }
      if (method === "DELETE") {
        await store.deletePrivateItem(orgId, caller.userId, itemId);
        return json(200, { ok: true });
      }
    }

    // Trends & Observations
    if (path === "/v1/me/trends" && method === "GET") {
      const trends = await store.getPersonalTrends(orgId, caller.userId);
      return json(200, trends);
    }

    if (path === "/v1/me/observations" && method === "GET") {
      const observations = await store.listObservations(orgId, caller.userId);
      return json(200, { items: observations });
    }

    const obsMatch = path.match(/^\/v1\/me\/observations\/([A-Za-z0-9_-]+)$/);
    if (obsMatch) {
      const obsId = obsMatch[1]!;
      if (method === "GET") {
        const obs = await store.getObservation(orgId, caller.userId, obsId);
        if (!obs) return json(404, { code: "NOT_FOUND", message: "Observation not found" });
        return json(200, obs);
      }
      if (method === "PATCH") {
        const update = parseBody(event.body, observationUpdateSchema);
        const updated = await store.updateObservationStatus(orgId, caller.userId, obsId, update.status);
        return json(200, updated);
      }
    }

    if (path === "/v1/me/corrections" && method === "POST") {
      const input = parseBody(event.body, correctionInputSchema);
      const created = await store.createCorrection(orgId, caller.userId, input);
      return json(201, created);
    }

    // Shares
    if (path === "/v1/me/shares/preview" && method === "POST") {
      const input = parseBody(event.body, sharingGrantInputSchema);
      const preview = await store.createSharePreview(orgId, caller.userId, input);
      return json(200, preview);
    }

    if (path === "/v1/me/shares") {
      if (method === "GET") {
        const grants = await store.listOwnerGrants(orgId, caller.userId);
        return json(200, { items: grants });
      }
      if (method === "POST") {
        const input = parseBody(event.body, sharingGrantInputSchema);
        const result = await store.createSharingGrant(orgId, caller.userId, input);
        return json(201, result);
      }
    }

    const shareMatch = path.match(/^\/v1\/me\/shares\/([A-Za-z0-9_-]+)$/);
    if (shareMatch) {
      const grantId = shareMatch[1]!;
      if (method === "GET") {
        const grant = await store.getGrant(orgId, grantId);
        if (!grant || grant.ownerId !== caller.userId) return json(404, { code: "NOT_FOUND", message: "Share not found" });
        const publication = await store.getPublication(orgId, grantId, 1);
        return json(200, { grant, publication });
      }
      if (method === "DELETE") {
        const revoked = await store.revokeGrant(orgId, caller.userId, grantId);
        return json(200, revoked);
      }
    }

    const revokeMatch = path.match(/^\/v1\/me\/shares\/([A-Za-z0-9_-]+)\/revoke$/);
    if (revokeMatch && method === "POST") {
      const grantId = revokeMatch[1]!;
      const revoked = await store.revokeGrant(orgId, caller.userId, grantId);
      return json(200, revoked);
    }

    // Accept Invitation
    if ((path === "/v1/invitations/accept" || path === "/v1/me/invitations/accept") && method === "POST") {
      const input = parseBody(event.body, acceptInvitationInputSchema);
      const emailClaim = event.requestContext.authorizer?.jwt?.claims?.email;
      const userEmail = typeof emailClaim === "string" && emailClaim ? emailClaim : `${caller.userId}@example.invalid`;
      const membership = await store.acceptInvitation(orgId, input, { userId: caller.userId, email: userEmail });
      return json(200, membership);
    }

    // Notifications
    if (path === "/v1/me/notifications" && method === "GET") {
      const items = await store.listNotifications(orgId, caller.userId);
      return json(200, { items });
    }

    const notifMatch = path.match(/^\/v1\/me\/notifications\/([A-Za-z0-9_-]+)$/);
    if (notifMatch && method === "PATCH") {
      const noticeId = notifMatch[1]!;
      const update = parseBody(event.body, notificationUpdateSchema);
      const updated = await store.updateNotification(orgId, caller.userId, noticeId, update);
      return json(200, updated);
    }

    // Notification Preferences
    if (path === "/v1/me/notification-preferences") {
      if (method === "GET") {
        const prefs = await store.getNotificationPreferences(orgId, caller.userId);
        return json(200, prefs);
      }
      if (method === "PUT") {
        const input = parseBody(event.body, notificationPreferencesSchema);
        const updated = await store.putNotificationPreferences(orgId, caller.userId, input);
        return json(200, updated);
      }
    }

    // Exports
    if (path === "/v1/me/exports" && method === "POST") {
      const input = event.body ? parseBody(event.body, exportRequestSchema) : { scope: "all" as const };
      const job = await store.createExportJob(orgId, caller.userId, input);
      return json(202, job);
    }

    const exportDownloadMatch = path.match(/^\/v1\/me\/exports\/([A-Za-z0-9_-]+)\/download$/);
    if (exportDownloadMatch && method === "GET") {
      const exportId = exportDownloadMatch[1]!;
      const downloadResult = await store.getExportDownload(orgId, caller.userId, exportId);
      return json(200, downloadResult);
    }

    // Deletion Requests
    if (path === "/v1/me/deletion-requests" && method === "POST") {
      const input = parseBody(event.body, deletionRequestSchema);
      const job = await store.createDeletionJob(orgId, caller.userId, input);
      return json(202, job);
    }

    // Jobs
    const jobMatch = path.match(/^\/v1\/me\/jobs\/([A-Za-z0-9_-]+)$/);
    if (jobMatch && method === "GET") {
      const jobId = jobMatch[1]!;
      const job = await store.getJob(orgId, caller.userId, jobId);
      if (!job) return json(404, { code: "NOT_FOUND", message: "Job not found" });
      return json(200, job);
    }

    return json(404, { code: "NOT_FOUND", message: `Personal route ${method} ${path} is not found.` });
  } catch (error) {
    if (error instanceof AuthorizationError) return json(error.statusCode, { code: "FORBIDDEN", message: error.message });
    if (error instanceof Error && error.message.startsWith("Validation failed")) {
      return json(400, { code: "VALIDATION_ERROR", message: error.message });
    }
    console.error("personal_request_failed", {
      requestId: event.requestContext.requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown",
    });
    return json(500, { code: "INTERNAL_ERROR", message: "Request failed." });
  }
};
