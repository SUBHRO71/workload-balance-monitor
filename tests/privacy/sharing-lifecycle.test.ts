import { describe, expect, it } from "vitest";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { WorkloadStore } from "../../packages/backend-core/src/dynamo-store";
import { keys } from "../../packages/backend-core/src/keys";
import { createInMemoryDynamoClient } from "./in-memory-dynamo";
import type { SharingGrantInput } from "../../packages/contracts/src/sharing";

describe("Phase 3: Explicit Manager Sharing Lifecycle", () => {
  const orgId = "org-sharing-test";
  const employeeId = "emp-001";
  const managerId = "mgr-001";
  const otherManagerId = "mgr-002";

  async function setupStoreWithData() {
    const client = createInMemoryDynamoClient();
    const store = new WorkloadStore("TestTable", client);

    // Seed directory membership for employee and managers
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.member(orgId, employeeId),
          orgId, userId: employeeId, displayName: "Alice Employee", email: "alice@example.invalid",
          roles: ["member"], status: "active", membershipVersion: 1,
        },
      }),
    );

    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.member(orgId, managerId),
          orgId, userId: managerId, displayName: "Bob Manager", email: "bob@example.invalid",
          roles: ["member", "manager"], status: "active", membershipVersion: 1,
        },
      }),
    );

    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.member(orgId, otherManagerId),
          orgId, userId: otherManagerId, displayName: "Charlie Other", email: "charlie@example.invalid",
          roles: ["member", "manager"], status: "active", membershipVersion: 1,
        },
      }),
    );

    // Seed active team assignment: Bob is Alice's direct manager (assignmentVersion 1)
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          PK: keys.userTeams(orgId, employeeId).PK,
          SK: "TEAM#team-eng",
          teamId: "team-eng",
        },
      }),
    );

    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.teamAssignment(orgId, "team-eng", employeeId),
          orgId, teamId: "team-eng", userId: employeeId, directManagerId: managerId,
          assignmentVersion: 1, status: "active", effectiveFrom: "2026-01-01T00:00:00.000Z",
        },
      }),
    );

    // Enable personal processing consent for Alice
    await store.putConsent(orgId, employeeId, {
      personalProcessing: true, teamAggregation: false, organizationAggregation: false,
      notifications: { inApp: false, managerEmail: false, devicePush: false },
    });

    // Create a task and a check-in for Alice
    const task = await store.createTask(orgId, employeeId, {
      title: "Deploy API service",
      workDate: "2026-03-10",
      effort: { value: 6, unit: "hours" },
      status: "done",
    });

    const checkIn = await store.createCheckIn(orgId, employeeId, {
      checkInDate: "2026-03-10",
      manageability: 4,
      privateNote: "Felt productive and calm today",
    });

    return { store, client, task, checkIn };
  }

  it("generates an exact share preview that excludes private check-in notes and unselected fields", async () => {
    const { store, task, checkIn } = await setupStoreWithData();

    const input: SharingGrantInput = {
      recipientManagerId: managerId,
      range: { from: "2026-03-01", to: "2026-03-15" },
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      selections: [
        { recordType: "task", recordId: task.id, recordVersion: task.version, fields: ["title", "effort", "status"] },
        { recordType: "check_in", recordId: checkIn.id, recordVersion: checkIn.version, fields: ["manageability", "checkInDate"] },
      ],
    };

    const preview = await store.createSharePreview(orgId, employeeId, input);

    expect(preview.recipientManagerId).toBe(managerId);
    expect(preview.selectedValues).toHaveLength(2);

    const taskProj = preview.selectedValues.find((s) => s.selection.recordType === "task");
    expect(taskProj?.values).toEqual({
      title: "Deploy API service",
      effort: { value: 6, unit: "hours" },
      status: "done",
    });
    // priority / dueAt was not selected so not present
    expect(taskProj?.values.priority).toBeUndefined();

    const checkInProj = preview.selectedValues.find((s) => s.selection.recordType === "check_in");
    expect(checkInProj?.values).toEqual({
      checkInDate: "2026-03-10",
      manageability: 4,
    });
    // STRICT PRIVACY: privateNote must NEVER be included
    expect((checkInProj?.values as Record<string, unknown> | undefined)?.privateNote).toBeUndefined();
  });

  it("rejects share creation if the recipient is not the user's active direct manager", async () => {
    const { store, task } = await setupStoreWithData();

    const input: SharingGrantInput = {
      recipientManagerId: otherManagerId, // Charlie is a manager, but NOT Alice's direct manager
      range: { from: "2026-03-01", to: "2026-03-15" },
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      selections: [
        { recordType: "task", recordId: task.id, recordVersion: task.version, fields: ["title"] },
      ],
    };

    await expect(store.createSharingGrant(orgId, employeeId, input)).rejects.toThrow(
      "Selected recipient is not an active direct manager",
    );
  });

  it("allows assigned manager to read the publication, but denies other managers", async () => {
    const { store, task, checkIn } = await setupStoreWithData();

    const input: SharingGrantInput = {
      recipientManagerId: managerId,
      range: { from: "2026-03-01", to: "2026-03-15" },
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      selections: [
        { recordType: "task", recordId: task.id, recordVersion: task.version, fields: ["title", "effort"] },
        { recordType: "check_in", recordId: checkIn.id, recordVersion: checkIn.version, fields: ["manageability"] },
      ],
    };

    const { grant } = await store.createSharingGrant(orgId, employeeId, input);

    // Bob (direct manager) reads publication
    const managerPub = await store.getManagerPublication(orgId, { userId: managerId, tokenGroups: ["manager"] }, grant.id);
    expect(managerPub.grant.id).toBe(grant.id);
    expect(managerPub.publication.selectedValues).toHaveLength(2);
    const history = await store.listAccessHistory(orgId, employeeId);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ ownerId: employeeId, recipientId: managerId, grantId: grant.id, action: "grant.read" });
    expect(history[0]).not.toHaveProperty("taskTitle");

    // Charlie (unauthorized manager) attempts to read publication
    await expect(
      store.getManagerPublication(orgId, { userId: otherManagerId, tokenGroups: ["manager"] }, grant.id),
    ).rejects.toThrow("Shared publication is not available");
  });

  it("blocks manager access immediately upon owner revocation", async () => {
    const { store, task } = await setupStoreWithData();

    const input: SharingGrantInput = {
      recipientManagerId: managerId,
      range: { from: "2026-03-01", to: "2026-03-15" },
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      selections: [
        { recordType: "task", recordId: task.id, recordVersion: task.version, fields: ["title"] },
      ],
    };

    const { grant } = await store.createSharingGrant(orgId, employeeId, input);

    // Revoke the grant as owner
    await store.revokeGrant(orgId, employeeId, grant.id);

    // Manager read must now be rejected
    await expect(
      store.getManagerPublication(orgId, { userId: managerId, tokenGroups: ["manager"] }, grant.id),
    ).rejects.toThrow("Shared publication is not available");
  });

  it("invalidates the grant when any referenced task or check-in is modified or deleted", async () => {
    const { store, task } = await setupStoreWithData();

    const input: SharingGrantInput = {
      recipientManagerId: managerId,
      range: { from: "2026-03-01", to: "2026-03-15" },
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      selections: [
        { recordType: "task", recordId: task.id, recordVersion: task.version, fields: ["title", "effort"] },
      ],
    };

    const { grant } = await store.createSharingGrant(orgId, employeeId, input);

    // Verify manager can read active grant
    const pubBefore = await store.getManagerPublication(orgId, { userId: managerId, tokenGroups: ["manager"] }, grant.id);
    expect(pubBefore.grant.status).toBe("active");

    // Owner edits the shared task (updating hours from 6 to 8)
    await store.updateTask(orgId, employeeId, task.id, { effort: { value: 8, unit: "hours" } });

    // The grant is now invalidated per policy
    const updatedGrant = await store.getGrant(orgId, grant.id);
    expect(updatedGrant?.status).toBe("invalidated");

    // Manager read is blocked
    await expect(
      store.getManagerPublication(orgId, { userId: managerId, tokenGroups: ["manager"] }, grant.id),
    ).rejects.toThrow("Shared publication is not available");
  });

  it("blocks manager access if the reporting relationship changes (stale assignmentVersion)", async () => {
    const { store, client, task } = await setupStoreWithData();

    const input: SharingGrantInput = {
      recipientManagerId: managerId,
      range: { from: "2026-03-01", to: "2026-03-15" },
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      selections: [
        { recordType: "task", recordId: task.id, recordVersion: task.version, fields: ["title"] },
      ],
    };

    const { grant } = await store.createSharingGrant(orgId, employeeId, input);

    // Reporting line updates: assignmentVersion bumps from 1 to 2
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.teamAssignment(orgId, "team-eng", employeeId),
          orgId, teamId: "team-eng", userId: employeeId, directManagerId: managerId,
          assignmentVersion: 2, status: "active", effectiveFrom: "2026-01-01T00:00:00.000Z",
        },
      }),
    );

    // Manager read must now be blocked because assignmentVersion changed
    await expect(
      store.getManagerPublication(orgId, { userId: managerId, tokenGroups: ["manager"] }, grant.id),
    ).rejects.toThrow("Shared publication is no longer available");
  });
});
