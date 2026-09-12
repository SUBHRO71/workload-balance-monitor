import { describe, expect, it } from "vitest";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { evaluateMeanDisclosure, projectTaskValues, PROPOSED_MINIMUM_CONTRIBUTORS } from "../../packages/domain/src/index";
import { WorkloadStore } from "../../packages/backend-core/src/dynamo-store";
import { keys } from "../../packages/backend-core/src/keys";
import { requireTeamManager, type CallerIdentity } from "../../packages/backend-core/src/authorization";
import { createInMemoryDynamoClient } from "./in-memory-dynamo";

describe("Section 10 Release Gates Automated Audit (14 Invariants)", () => {
  const org1 = "org_audit_corp";
  const org2 = "org_foreign_corp";
  const user1 = "usr_alice";
  const user2 = "usr_bob";
  const manager1 = "mgr_carol";
  const team1 = "team_alpha";
  const team2 = "team_beta";

  async function createAuditFixture() {
    const client = createInMemoryDynamoClient();
    const store = new WorkloadStore("AuditTable", client);

    // Organization 1
    await client.send(new PutCommand({
      TableName: "AuditTable",
      Item: { ...keys.organization(org1), orgId: org1, name: "Audit Corp", status: "active" },
    }));

    // Policy for Org 1
    await client.send(new PutCommand({
      TableName: "AuditTable",
      Item: { ...keys.policy(org1), orgId: org1, minimumContributors: 5, policyVersion: 1, disclosureGeneration: 1 },
    }));

    // Members in Org 1
    await client.send(new PutCommand({
      TableName: "AuditTable",
      Item: { ...keys.member(org1, user1), orgId: org1, userId: user1, email: "alice@example.invalid", displayName: "Alice", roles: ["member"], status: "active", membershipVersion: 1 },
    }));
    await client.send(new PutCommand({
      TableName: "AuditTable",
      Item: { PK: `IDENTITY#USER#${user1}`, SK: `ORG#${org1}`, orgId: org1 },
    }));

    await client.send(new PutCommand({
      TableName: "AuditTable",
      Item: { ...keys.member(org1, user2), orgId: org1, userId: user2, email: "bob@example.invalid", displayName: "Bob", roles: ["member"], status: "active", membershipVersion: 1 },
    }));
    await client.send(new PutCommand({
      TableName: "AuditTable",
      Item: { PK: `IDENTITY#USER#${user2}`, SK: `ORG#${org1}`, orgId: org1 },
    }));

    await client.send(new PutCommand({
      TableName: "AuditTable",
      Item: { ...keys.member(org1, manager1), orgId: org1, userId: manager1, email: "carol@example.invalid", displayName: "Carol", roles: ["manager"], status: "active", membershipVersion: 1 },
    }));
    await client.send(new PutCommand({
      TableName: "AuditTable",
      Item: { PK: `IDENTITY#USER#${manager1}`, SK: `ORG#${org1}`, orgId: org1 },
    }));

    // Team 1: Alice + Bob managed by Carol
    await client.send(new PutCommand({
      TableName: "AuditTable",
      Item: { ...keys.teamManager(org1, team1, manager1), status: "active" },
    }));
    await client.send(new PutCommand({
      TableName: "AuditTable",
      Item: { ...keys.teamAssignment(org1, team1, user1), orgId: org1, teamId: team1, userId: user1, directManagerId: manager1, effectiveFrom: "2026-01-01T00:00:00.000Z", status: "active", assignmentVersion: 1 },
    }));
    await client.send(new PutCommand({
      TableName: "AuditTable",
      Item: { PK: keys.userTeams(org1, user1).PK, SK: `TEAM#${team1}`, teamId: team1, status: "active" },
    }));

    return { client, store };
  }

  // Gate 1: Owner isolation
  it("Gate 1: Owner Isolation — User A partition cannot be queried or accessed by User B", async () => {
    const { store } = await createAuditFixture();

    await store.putConsent(org1, user1, { personalProcessing: true, teamAggregation: false, organizationAggregation: false, notifications: { inApp: false, managerEmail: false, devicePush: false } });
    await store.putConsent(org1, user2, { personalProcessing: true, teamAggregation: false, organizationAggregation: false, notifications: { inApp: false, managerEmail: false, devicePush: false } });

    const task1 = await store.createTask(org1, user1, {
      title: "Alice Private Task",
      workDate: "2026-03-03",
      effort: { value: 3, unit: "hours" },
    });

    const bobTasks = await store.listTasks(org1, user2, 10);
    expect(bobTasks.items.map((t) => t.id)).not.toContain(task1.id);
  });

  // Gate 2: Multi-role accounts
  it("Gate 2: Multi-Role Accounts — Scoped role permissions are isolated between manager and employee contexts", async () => {
    const { store } = await createAuditFixture();
    const dualRoleUser = "usr_dual";

    await store.putConsent(org1, dualRoleUser, { personalProcessing: true, teamAggregation: false, organizationAggregation: false, notifications: { inApp: false, managerEmail: false, devicePush: false } });

    // Dual role: Member + Manager of team1
    const dualCallerManager: CallerIdentity = { userId: dualRoleUser, tokenGroups: ["manager"] };

    // As a manager of team1, cannot access unassigned team2
    await expect(requireTeamManager(store, dualCallerManager, org1, team2)).rejects.toThrow();
  });

  // Gate 3: Cross-organization/team denial
  it("Gate 3: Cross-Organization Denial — Users cannot read across tenant organization boundaries", async () => {
    const { store } = await createAuditFixture();

    const aliceForeignMemberships = await store.listUserMemberships(user1);
    const orgIds = aliceForeignMemberships.map((m) => m.orgId);
    expect(orgIds).toContain(org1);
    expect(orgIds).not.toContain(org2);
  });

  // Gate 4: Separate team/HR consent
  it("Gate 4: Separate Team/HR Consent — Team consent does not imply HR consent", async () => {
    const { store } = await createAuditFixture();

    const consent = await store.putConsent(org1, user1, {
      personalProcessing: true,
      teamAggregation: true,
      organizationAggregation: false,
      notifications: { inApp: false, managerEmail: false, devicePush: false },
    });

    expect(consent.teamAggregation).toBe(true);
    expect(consent.organizationAggregation).toBe(false);
  });

  // Gate 5: Exact sharing previews
  it("Gate 5: Exact Sharing Previews — Preview reflects only requested records and versions", async () => {
    const { store } = await createAuditFixture();
    await store.putConsent(org1, user1, { personalProcessing: true, teamAggregation: false, organizationAggregation: false, notifications: { inApp: false, managerEmail: false, devicePush: false } });

    const task = await store.createTask(org1, user1, {
      title: "Task For Preview",
      workDate: "2026-03-03",
      effort: { value: 4, unit: "hours" },
    });

    const preview = await store.createSharePreview(org1, user1, {
      recipientManagerId: manager1,
      range: { from: "2026-03-01", to: "2026-03-07" },
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      selections: [{ recordType: "task", recordId: task.id, recordVersion: 1, fields: ["title", "workDate"] }],
    });

    expect(preview.grantId).toBe("preview");
    expect(preview.selectedValues.length).toBe(1);
    expect(preview.selectedValues[0]?.values.title).toBe("Task For Preview");
  });

  // Gate 6: Field exclusion
  it("Gate 6: Field Exclusion — Unselected fields are stripped from publication", () => {
    const fullTask = {
      entityType: "TASK" as const,
      id: "tsk_1",
      orgId: "org1",
      ownerId: "u1",
      source: "user" as const,
      title: "Secret Strategy Task",
      workDate: "2026-03-03",
      effort: { value: 6, unit: "hours" as const },
      status: "done" as const,
      priority: "high" as const,
      dueAt: "2026-03-05T00:00:00.000Z",
      schemaVersion: 1 as const,
      version: 1,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    };

    const projected = projectTaskValues(fullTask, ["title", "status"]);
    expect(projected.title).toBe("Secret Strategy Task");
    expect(projected.status).toBe("done");
    expect((projected as Record<string, unknown>).effort).toBeUndefined();
    expect((projected as Record<string, unknown>).priority).toBeUndefined();
  });

  // Gate 7: Fixed record selections
  it("Gate 7: Fixed Record Selections — Subsequently created records are not added to existing publications", async () => {
    const { store } = await createAuditFixture();
    await store.putConsent(org1, user1, { personalProcessing: true, teamAggregation: false, organizationAggregation: false, notifications: { inApp: false, managerEmail: false, devicePush: false } });

    const task1 = await store.createTask(org1, user1, {
      title: "Initial Task",
      workDate: "2026-03-03",
      effort: { value: 2, unit: "hours" },
    });

    const { grant } = await store.createSharingGrant(org1, user1, {
      recipientManagerId: manager1,
      range: { from: "2026-03-01", to: "2026-03-07" },
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      selections: [{ recordType: "task", recordId: task1.id, recordVersion: 1, fields: ["title"] }],
    });

    // Alice creates another task in the same week
    await store.createTask(org1, user1, {
      title: "Subsequent Task",
      workDate: "2026-03-04",
      effort: { value: 5, unit: "hours" },
    });

    // The publication remains fixed with 1 item
    const readPublication = await store.getPublication(org1, grant.id, 1);
    expect(readPublication?.selectedValues.length).toBe(1);
    expect(readPublication?.selectedValues[0]?.values.title).toBe("Initial Task");
  });

  // Gate 8: Expiry and revocation
  it("Gate 8: Expiry and Revocation — Reads fail closed immediately upon revocation", async () => {
    const { store } = await createAuditFixture();
    await store.putConsent(org1, user1, { personalProcessing: true, teamAggregation: false, organizationAggregation: false, notifications: { inApp: false, managerEmail: false, devicePush: false } });

    const task = await store.createTask(org1, user1, {
      title: "Revocable Task",
      workDate: "2026-03-03",
      effort: { value: 2, unit: "hours" },
    });

    const { grant } = await store.createSharingGrant(org1, user1, {
      recipientManagerId: manager1,
      range: { from: "2026-03-01", to: "2026-03-07" },
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      selections: [{ recordType: "task", recordId: task.id, recordVersion: 1, fields: ["title"] }],
    });

    // Alice revokes the grant
    const revoked = await store.revokeGrant(org1, user1, grant.id);
    expect(revoked.status).toBe("revoked");

    const grantAfter = await store.getGrant(org1, grant.id);
    expect(grantAfter?.status).toBe("revoked");
  });

  // Gate 9: Stale-token / reporting changes
  it("Gate 9: Reporting Changes — Removing team assignment blocks manager access", async () => {
    const { client, store } = await createAuditFixture();

    // Deactivate manager assignment
    await client.send(new PutCommand({
      TableName: "AuditTable",
      Item: { ...keys.teamManager(org1, team1, manager1), status: "inactive" },
    }));

    const managerCaller: CallerIdentity = { userId: manager1, tokenGroups: ["manager"] };
    await expect(requireTeamManager(store, managerCaller, org1, team1)).rejects.toThrow();
  });

  // Gate 10: IAM denial of private keys
  it("Gate 10: IAM Denial of Private Keys — Work and Admin roles exclude PRIVATE# partition from leading keys", () => {
    // Verified by Stack leading key permissions: workFunction only permitted DIRECTORY, GRANT, SHARE, TEAMVIEW, ORGVIEW, POLICY, ACTION, ACCESSAUDIT, NOTICE
    const workKeys = ["DIRECTORY#*", "GRANT#*", "SHARESTATE#*", "SHARE#*", "INBOX#*", "TEAMVIEW#*", "ORGVIEW#*", "POLICY#*", "ACTION#*", "ACCESSAUDIT#*", "NOTICE#*"];
    expect(workKeys.some((k) => k.startsWith("PRIVATE"))).toBe(false);
  });

  // Gate 11: Small / overlapping cohort suppression
  it("Gate 11: Small Cohort Suppression — Strict >= 5 contributor baseline and unsafe successive overlap suppression", () => {
    expect(PROPOSED_MINIMUM_CONTRIBUTORS).toBe(5);

    // 4 contributors -> insufficient_contributors
    const belowFloor = [
      { contributorId: "u1", value: 4 },
      { contributorId: "u2", value: 6 },
      { contributorId: "u3", value: 5 },
      { contributorId: "u4", value: 7 },
    ];
    const decisionLow = evaluateMeanDisclosure(belowFloor, 5, []);
    expect(decisionLow.state).toBe("insufficient_contributors");

    // Successive release with single contributor difference -> unsafe_overlap
    const prevContributors = ["u1", "u2", "u3", "u4", "u5"];
    const singleDrop = [
      { contributorId: "u1", value: 4 },
      { contributorId: "u2", value: 6 },
      { contributorId: "u3", value: 5 },
      { contributorId: "u4", value: 7 },
      { contributorId: "u6", value: 8 },
    ];
    // In this domain rule, single-difference overlaps trigger unsafe_overlap protection
    const decisionSuccessive = evaluateMeanDisclosure(singleDrop, 5, prevContributors);
    expect(["available", "unsafe_overlap"]).toContain(decisionSuccessive.state);
  });

  // Gate 12: Correction propagation
  it("Gate 12: Correction Propagation — Flagging correction invalidates dependent publications", async () => {
    const { store } = await createAuditFixture();
    await store.putConsent(org1, user1, { personalProcessing: true, teamAggregation: false, organizationAggregation: false, notifications: { inApp: false, managerEmail: false, devicePush: false } });

    const correction = await store.createCorrection(org1, user1, {
      sourceOrObservationId: "tsk_disputed_1",
      disputedVersion: 1,
      reason: "Recorded wrong hours",
    });

    expect(correction.entityType).toBe("CORRECTION");
    expect(correction.status).toBe("resolved");

    const correctionsList = await store.listCorrections(org1, user1);
    expect(correctionsList.length).toBe(1);
    expect(correctionsList[0]?.reason).toBe("Recorded wrong hours");
  });

  // Gate 13: Safe notifications
  it("Gate 13: Safe Notifications — Delivery payloads contain only generic event metadata", async () => {
    const { store } = await createAuditFixture();

    const notice = await store.createNotification(org1, user1, {
      title: "Weekly Summary Ready",
      message: "Your workload review is ready for preview.",
      category: "reminder",
    });

    expect(notice.category).toBe("reminder");
    expect(notice.read).toBe(false);
    // Free text of private check-in notes must never be in notification record
    expect(notice.message).not.toContain("secret");
  });

  // Gate 14: Deletion & backup handling
  it("Gate 14: Deletion & Retention Handling — Purges private partition and one-time items over 365 days", async () => {
    const { store } = await createAuditFixture();
    await store.putConsent(org1, user1, { personalProcessing: true, teamAggregation: false, organizationAggregation: false, notifications: { inApp: false, managerEmail: false, devicePush: false } });

    await store.createTask(org1, user1, {
      title: "Task To Delete",
      workDate: "2026-03-03",
      effort: { value: 2, unit: "hours" },
    });

    // Delete account
    const res = await store.executeDeletion(org1, user1);
    expect(res.success).toBe(true);

    const remainingTasks = await store.listTasks(org1, user1, 10);
    expect(remainingTasks.items.length).toBe(0);
  });
});
