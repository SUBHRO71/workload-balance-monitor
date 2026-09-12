import { describe, expect, it } from "vitest";
import type { AuthorizationStore } from "../../packages/backend-core/src/index";
import { AuthorizationError, requireManagerPublication, requireRole } from "../../packages/backend-core/src/index";
import type { Membership, SharingGrant, TeamAssignment } from "../../packages/contracts/src/index";

const member = (userId: string, roles: Membership["roles"]): Membership => ({ orgId: "org-1", userId, displayName: userId, email: `${userId}@example.invalid`, roles, status: "active", membershipVersion: 1 });
const assignment: TeamAssignment = { orgId: "org-1", teamId: "team-1", userId: "owner-1", directManagerId: "manager-1", effectiveFrom: "2026-01-01T00:00:00.000Z", assignmentVersion: 2, status: "active" };
const memberships = new Map([["manager-1", member("manager-1", ["manager"])], ["hr-1", member("hr-1", ["hr"])]]);
const store: AuthorizationStore = {
  getMembership: async (_orgId, userId) => memberships.get(userId),
  getActiveAssignmentsForUser: async (_orgId, userId) => userId === "owner-1" ? [assignment] : [],
  isManagerOfTeam: async (_orgId, teamId, managerId) => teamId === "team-1" && managerId === "manager-1",
};
const grant: SharingGrant = {
  entityType: "SHARING_GRANT", id: "grant-1", orgId: "org-1", ownerId: "owner-1", recipientManagerId: "manager-1",
  range: { from: "2026-01-01", to: "2026-01-31" }, expiresAt: "2027-01-01T00:00:00.000Z",
  selections: [{ recordType: "task", recordId: "task-1", recordVersion: 1, fields: ["title"] }],
  status: "active", gateGeneration: 1, assignmentVersion: 2, schemaVersion: 1, version: 1,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("authorization gates", () => {
  it("does not let HR satisfy the manager role", async () => {
    await expect(requireRole(store, { userId: "hr-1", tokenGroups: ["manager"] }, "org-1", "manager")).rejects.toBeInstanceOf(AuthorizationError);
  });
  it("requires recipient, active relationship, matching assignment version, and expiry", async () => {
    await expect(requireManagerPublication(store, { userId: "manager-1", tokenGroups: [] }, grant, new Date("2026-02-01"))).resolves.toBeUndefined();
    await expect(requireManagerPublication(store, { userId: "hr-1", tokenGroups: [] }, grant, new Date("2026-02-01"))).rejects.toBeInstanceOf(AuthorizationError);
    await expect(requireManagerPublication(store, { userId: "manager-1", tokenGroups: [] }, grant, new Date("2028-01-01"))).rejects.toBeInstanceOf(AuthorizationError);
  });
});
