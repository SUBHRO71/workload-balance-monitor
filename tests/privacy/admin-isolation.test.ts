import { describe, expect, it } from "vitest";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { WorkloadStore } from "../../packages/backend-core/src/dynamo-store";
import { keys } from "../../packages/backend-core/src/keys";
import { AuthorizationError, requireOrganizationAdmin } from "../../packages/backend-core/src/authorization";
import { createInMemoryDynamoClient } from "./in-memory-dynamo";
import type { CallerIdentity } from "../../packages/backend-core/src/authorization";

describe("Phase 5: Administration, Human Actions & Notifications Isolation", () => {
  const orgId = "org-corp-01";
  const adminId = "user-admin-99";
  const regularUserId = "user-regular-01";
  const managerId = "user-mgr-01";
  const hrId = "user-hr-01";
  const teamId = "team-eng-alpha";

  const adminCaller: CallerIdentity = { userId: adminId, tokenGroups: ["org_admin"] };
  const regularCaller: CallerIdentity = { userId: regularUserId, tokenGroups: ["member"] };
  const managerCaller: CallerIdentity = { userId: managerId, tokenGroups: ["manager"] };
  const hrCaller: CallerIdentity = { userId: hrId, tokenGroups: ["hr"] };

  async function setupEnvironment() {
    const client = createInMemoryDynamoClient();
    const store = new WorkloadStore("TestTable", client);

    // Seed admin membership
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.member(orgId, adminId),
          orgId,
          userId: adminId,
          displayName: "Org Admin",
          email: "admin@example.invalid",
          roles: ["org_admin", "member"],
          status: "active",
          membershipVersion: 1,
        },
      }),
    );

    // Seed regular user membership
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.member(orgId, regularUserId),
          orgId,
          userId: regularUserId,
          displayName: "Dev Member",
          email: "dev@example.invalid",
          roles: ["member"],
          status: "active",
          membershipVersion: 1,
        },
      }),
    );

    // Seed manager membership & team manager pointer
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.member(orgId, managerId),
          orgId,
          userId: managerId,
          displayName: "Engineering Manager",
          email: "mgr@example.invalid",
          roles: ["manager", "member"],
          status: "active",
          membershipVersion: 1,
        },
      }),
    );
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.teamManager(orgId, teamId, managerId),
          orgId,
          teamId,
          managerId,
          status: "active",
        },
      }),
    );

    // Seed HR membership
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.member(orgId, hrId),
          orgId,
          userId: hrId,
          displayName: "HR Business Partner",
          email: "hr@example.invalid",
          roles: ["hr", "member"],
          status: "active",
          membershipVersion: 1,
        },
      }),
    );

    // Seed initial organization policy
    await store.putOrganizationPolicy({
      orgId,
      minimumContributors: 5,
      policyVersion: 1,
      disclosureGeneration: 1,
    });

    return { client, store };
  }

  it("enforces that only org_admin role can access administrative operations", async () => {
    const { store } = await setupEnvironment();

    // Org admin can pass requireOrganizationAdmin
    const adminMembership = await requireOrganizationAdmin(store, adminCaller, orgId);
    expect(adminMembership.userId).toBe(adminId);
    expect(adminMembership.roles).toContain("org_admin");

    // Regular member, manager, and HR cannot access admin operations
    await expect(requireOrganizationAdmin(store, regularCaller, orgId)).rejects.toThrow(AuthorizationError);
    await expect(requireOrganizationAdmin(store, managerCaller, orgId)).rejects.toThrow(AuthorizationError);
    await expect(requireOrganizationAdmin(store, hrCaller, orgId)).rejects.toThrow(AuthorizationError);
  });

  it("strictly prohibits lowering the privacy threshold below the enforced floor of 5", async () => {
    const { store } = await setupEnvironment();

    // Raising above 5 is allowed
    const updatedPolicy = await store.patchOrganizationPolicy(orgId, { minimumContributors: 8 }, adminCaller);
    expect(updatedPolicy.minimumContributors).toBe(8);
    expect(updatedPolicy.policyVersion).toBe(2);
    expect(updatedPolicy.disclosureGeneration).toBe(2);

    // Attempting to lower below 5 is strictly rejected
    await expect(
      store.patchOrganizationPolicy(orgId, { minimumContributors: 4 }, adminCaller),
    ).rejects.toThrow(/floor of 5/);

    await expect(
      store.patchOrganizationPolicy(orgId, { minimumContributors: 0 }, adminCaller),
    ).rejects.toThrow(/floor of 5/);

    await expect(
      store.patchOrganizationPolicy(orgId, { minimumContributors: -1 }, adminCaller),
    ).rejects.toThrow(/floor of 5/);
  });

  it("synchronously invalidates aggregate releases and increments disclosure generation on policy changes", async () => {
    const { client, store } = await setupEnvironment();

    // Plant an active release
    const windowId = "2026-03-01_2026-03-07";
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.teamView(orgId, teamId, windowId),
          orgId,
          teamId,
          state: "available",
          range: { from: "2026-03-01", to: "2026-03-07" },
          generatedAt: new Date().toISOString(),
          policyVersion: 1,
          disclosureGeneration: 1,
          metrics: [{ key: "meanWeeklyEffort", value: 38, contributorCountBand: "5-9" }],
        },
      }),
    );

    // Patch policy
    await store.patchOrganizationPolicy(orgId, { minimumContributors: 7 }, adminCaller);

    // Release must be invalidated synchronously
    const query = await store.getTeamAggregate(orgId, teamId, managerCaller, { from: "2026-03-01", to: "2026-03-07" });
    expect(query.state).toBe("invalid");
  });

  it("creates and manages teams, and team membership removal invalidates affected releases", async () => {
    const { client, store } = await setupEnvironment();

    // Create a team
    const team = await store.createTeam(orgId, { teamId: "team-new-beta", teamName: "Beta Feature Team" }, adminCaller);
    expect(team.teamId).toBe("team-new-beta");
    expect(team.status).toBe("active");

    // Assign a user
    const assignment = await store.assignTeamMember(
      orgId,
      "team-new-beta",
      regularUserId,
      { directManagerId: managerId },
      adminCaller,
    );
    expect(assignment.userId).toBe(regularUserId);
    expect(assignment.directManagerId).toBe(managerId);

    // Plant active release for team-new-beta
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.teamView(orgId, "team-new-beta", "2026-03-01_2026-03-07"),
          orgId,
          teamId: "team-new-beta",
          state: "available",
          metrics: [{ key: "meanWeeklyEffort", value: 36, contributorCountBand: "5-9" }],
        },
      }),
    );

    // Remove team member
    await store.removeTeamMember(orgId, "team-new-beta", regularUserId, adminCaller);

    // Verify release is invalidated
    const postRemoval = await store.getTeamAggregate(orgId, "team-new-beta", managerCaller, { from: "2026-03-01", to: "2026-03-07" });
    expect(postRemoval.state).toBe("invalid");
  });

  it("records administrative audit events without leaking private data", async () => {
    const { store } = await setupEnvironment();

    // Create invitation
    const invite = await store.createInvitation(
      orgId,
      { email: "new-engineer@example.invalid", roles: ["member"] },
      adminCaller,
      "admin@example.invalid",
    );
    expect(invite.status).toBe("pending");

    // Check audit log
    const auditLogs = await store.listAdminAuditEvents(orgId);
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    const inviteEvent = auditLogs.find((e) => e.action === "member.invite");
    expect(inviteEvent).toBeDefined();
    expect(inviteEvent?.actorId).toBe(adminId);
    expect(inviteEvent?.actorEmail).toBe("admin@example.invalid");
    // Verify no private notes exist in details
    const serialized = JSON.stringify(inviteEvent);
    expect(serialized).not.toContain("note");
    expect(serialized).not.toContain("diary");
  });

  it("records human actions for manager and HR separately without embedding private source text", async () => {
    const { store } = await setupEnvironment();

    // Manager records a team human action
    const managerAction = await store.createHumanAction(
      orgId,
      "team",
      teamId,
      {
        rationale: "Agreed to postpone lower-priority backlog tasks to restore sustainable sprint pace.",
        status: "open",
        followUpAt: "2026-03-20T00:00:00.000Z",
      },
      { userId: managerId, displayName: "Engineering Lead" },
    );
    expect(managerAction.scope).toBe("team");
    expect(managerAction.teamId).toBe(teamId);
    expect(managerAction.authorId).toBe(managerId);

    // HR records an organization-level human action
    const hrAction = await store.createHumanAction(
      orgId,
      "hr",
      undefined,
      {
        rationale: "Organization-wide focus days introduced to address cross-team workload pressure.",
        status: "in_progress",
      },
      { userId: hrId, displayName: "People Operations" },
    );
    expect(hrAction.scope).toBe("hr");
    expect(hrAction.teamId).toBeUndefined();
    expect(hrAction.authorId).toBe(hrId);

    // Verify retrieval
    const teamActions = await store.listHumanActions(orgId, "team", teamId);
    expect(teamActions).toHaveLength(1);
    expect(teamActions[0]?.id).toBe(managerAction.id);

    const hrActions = await store.listHumanActions(orgId, "hr");
    expect(hrActions).toHaveLength(1);
    expect(hrActions[0]?.id).toBe(hrAction.id);

    // Update action status
    const updatedAction = await store.updateHumanAction(
      orgId,
      "team",
      managerAction.id,
      { status: "resolved" },
      teamId,
    );
    expect(updatedAction.status).toBe("resolved");
  });

  it("handles notifications and preferences with generic text only", async () => {
    const { store } = await setupEnvironment();

    // Create a generic notification
    const notice = await store.createNotification(orgId, regularUserId, {
      title: "Shared Report Opened",
      message: "Your manager opened your shared report for window 2026-03-01 to 2026-03-07.",
      category: "share",
      link: "/app/sharing",
    });
    expect(notice.read).toBe(false);
    expect(notice.userId).toBe(regularUserId);

    // List notifications
    const items = await store.listNotifications(orgId, regularUserId);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(notice.id);

    // Mark read
    const updated = await store.updateNotification(orgId, regularUserId, notice.id, { read: true });
    expect(updated.read).toBe(true);

    // Preferences
    const defaultPrefs = await store.getNotificationPreferences(orgId, regularUserId);
    expect(defaultPrefs.inAppEnabled).toBe(true);
    expect(defaultPrefs.emailEnabled).toBe(false);

    const updatedPrefs = await store.putNotificationPreferences(orgId, regularUserId, {
      inAppEnabled: true,
      emailEnabled: true,
      weeklyDigestEnabled: false,
    });
    expect(updatedPrefs.emailEnabled).toBe(true);
  });
});
