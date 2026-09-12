import { describe, expect, it } from "vitest";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { WorkloadStore } from "../../packages/backend-core/src/dynamo-store";
import { keys } from "../../packages/backend-core/src/keys";
import { processLifecycleJob } from "../../services/workers/src/jobs/lifecycle";
import { createInMemoryDynamoClient } from "./in-memory-dynamo";

describe("Phase 6: Data Lifecycle, Owner Export, Account Deletion & Retention", () => {
  const orgId = "org_lifecycle_test";
  const aliceId = "usr_alice";
  const bobId = "usr_bob";
  const charlieId = "mgr_charlie";
  const teamId = "team_alpha";

  async function setupTestStore() {
    const client = createInMemoryDynamoClient();
    const store = new WorkloadStore("TestTable", client);

    // Organization
    await client.send(new PutCommand({
      TableName: "TestTable",
      Item: { ...keys.organization(orgId), name: "Lifecycle Corp", status: "active" },
    }));

    // Policy
    await client.send(new PutCommand({
      TableName: "TestTable",
      Item: { ...keys.policy(orgId), orgId, minimumContributors: 5, policyVersion: 1, disclosureGeneration: 1 },
    }));

    // Members
    await client.send(new PutCommand({
      TableName: "TestTable",
      Item: { ...keys.member(orgId, aliceId), orgId, userId: aliceId, email: "alice@example.invalid", displayName: "Alice", roles: ["member"], status: "active", membershipVersion: 1 },
    }));
    await client.send(new PutCommand({
      TableName: "TestTable",
      Item: { PK: `IDENTITY#USER#${aliceId}`, SK: `ORG#${orgId}`, orgId },
    }));

    await client.send(new PutCommand({
      TableName: "TestTable",
      Item: { ...keys.member(orgId, bobId), orgId, userId: bobId, email: "bob@example.invalid", displayName: "Bob", roles: ["member"], status: "active", membershipVersion: 1 },
    }));

    await client.send(new PutCommand({
      TableName: "TestTable",
      Item: { ...keys.member(orgId, charlieId), orgId, userId: charlieId, email: "charlie@example.invalid", displayName: "Charlie", roles: ["manager"], status: "active", membershipVersion: 1 },
    }));

    // Team and assignments
    await client.send(new PutCommand({
      TableName: "TestTable",
      Item: { ...keys.teamManager(orgId, teamId, charlieId), status: "active" },
    }));
    await client.send(new PutCommand({
      TableName: "TestTable",
      Item: {
        ...keys.teamAssignment(orgId, teamId, aliceId),
        orgId,
        teamId,
        userId: aliceId,
        directManagerId: charlieId,
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        status: "active",
        assignmentVersion: 1,
      },
    }));
    await client.send(new PutCommand({
      TableName: "TestTable",
      Item: { PK: keys.userTeams(orgId, aliceId).PK, SK: `TEAM#${teamId}`, teamId, status: "active" },
    }));

    // Alice's data: tasks, check-in, private items, preferences, consent, notifications
    await store.putConsent(orgId, aliceId, {
      personalProcessing: true,
      teamAggregation: true,
      organizationAggregation: true,
      notifications: { inApp: true, managerEmail: false, devicePush: false },
    });

    await store.putPreferences(orgId, aliceId, {
      timezone: "UTC",
      weeklyCapacity: { value: 35, unit: "hours" },
    });

    await store.createTask(orgId, aliceId, {
      title: "Alice Task 1",
      workDate: "2026-03-02",
      effort: { value: 4, unit: "hours" },
      status: "done",
    });

    await store.createCheckIn(orgId, aliceId, {
      checkInDate: "2026-03-02",
      manageability: 4,
      privateNote: "Alice secret note",
    });

    await store.createPrivateItem(orgId, aliceId, {
      type: "personal_goal",
      title: "Ongoing Certification",
      lifecycle: "ongoing",
    });

    await store.createPrivateItem(orgId, aliceId, {
      type: "leave_detail",
      title: "Medical Leave Note",
      lifecycle: "one_time",
      eventEndAt: "2026-04-01T00:00:00.000Z",
    });

    await store.createNotification(orgId, aliceId, {
      title: "Welcome",
      message: "Welcome to Workload Monitor",
      category: "policy",
    });

    // Bob's data (different user)
    await store.putConsent(orgId, bobId, {
      personalProcessing: true,
      teamAggregation: false,
      organizationAggregation: false,
      notifications: { inApp: false, managerEmail: false, devicePush: false },
    });

    await store.createTask(orgId, bobId, {
      title: "Bob Confidential Task",
      workDate: "2026-03-02",
      effort: { value: 8, unit: "hours" },
      status: "in_progress",
    });

    return { client, store };
  }

  it("gate 1: owner export produces strictly owner-owned records without cross-tenant or coworker leakage", async () => {
    const { store } = await setupTestStore();

    const job = await store.createExportJob(orgId, aliceId, { scope: "all" });
    expect(job.status).toBe("completed");
    expect(job.kind).toBe("export");
    expect(job.ownerId).toBe(aliceId);
    expect(job.downloadUrl).toBe(`/v1/me/exports/${job.id}/download`);

    const { job: fetchedJob, data } = await store.getExportDownload(orgId, aliceId, job.id);
    expect(fetchedJob.id).toBe(job.id);
    expect(data.userId).toBe(aliceId);
    expect(data.orgId).toBe(orgId);

    // Verify Alice's items are present
    expect(data.tasks.length).toBe(1);
    expect(data.tasks[0]?.title).toBe("Alice Task 1");
    expect(data.checkIns.length).toBe(1);
    expect(data.checkIns[0]?.privateNote).toBe("Alice secret note");
    expect(data.privateItems.length).toBe(2);
    expect(data.preferences?.weeklyCapacity?.value).toBe(35);
    expect(data.consent?.personalProcessing).toBe(true);
    expect(data.notifications.length).toBe(1);

    // Verify Bob's data is strictly absent
    const allTitles = data.tasks.map((t) => t.title);
    expect(allTitles).not.toContain("Bob Confidential Task");
  });

  it("gate 2: export download rejects expired downloads past 24 hours", async () => {
    const { client, store } = await setupTestStore();

    const job = await store.createExportJob(orgId, aliceId, { scope: "all" });

    // Simulate expiration by putting expiresAt in the past
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
    await client.send(new PutCommand({
      TableName: "TestTable",
      Item: {
        ...keys.job(orgId, aliceId, job.id),
        ...job,
        expiresAt: pastDate,
      },
    }));

    await expect(store.getExportDownload(orgId, aliceId, job.id)).rejects.toThrow(
      "Export download has expired (24-hour limit exceeded)",
    );
  });

  it("gate 3: unauthorized users cannot access another employee's export", async () => {
    const { store } = await setupTestStore();

    const job = await store.createExportJob(orgId, aliceId, { scope: "all" });

    // Bob attempts to download Alice's export
    await expect(store.getExportDownload(orgId, bobId, job.id)).rejects.toThrow();
  });

  it("gate 4: explicit owner account deletion wipes private partition, revokes grants, and invalidates releases", async () => {
    const { client, store } = await setupTestStore();

    // 1. Create a share from Alice to Charlie
    const { grant } = await store.createSharingGrant(orgId, aliceId, {
      recipientManagerId: charlieId,
      range: { from: "2026-03-01", to: "2026-03-07" },
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      selections: [{ recordType: "task", recordId: (await store.listTasks(orgId, aliceId, 1)).items[0]!.id, recordVersion: 1, fields: ["title", "workDate", "status"] }],
    });
    expect(grant.status).toBe("active");

    // 2. Set an active team release
    await client.send(new PutCommand({
      TableName: "TestTable",
      Item: {
        ...keys.teamView(orgId, teamId, "2026-03-01_2026-03-07"),
        state: "available",
        range: { from: "2026-03-01", to: "2026-03-07" },
        generatedAt: new Date().toISOString(),
        evidenceStrength: "consistent",
        metrics: [{ key: "meanWeeklyEffort", value: 35, contributorCountBand: "5-9" }],
        policyVersion: 1,
        disclosureGeneration: 1,
      },
    }));

    // 3. Execute Deletion
    const deleteResult = await store.createDeletionJob(orgId, aliceId, { scope: "all", confirmed: true });
    expect(deleteResult.kind).toBe("delete");
    expect(deleteResult.status).toBe("completed");

    // 4. Verify Alice's private partition is wiped
    const tasksAfter = await store.listTasks(orgId, aliceId, 10);
    expect(tasksAfter.items.length).toBe(0);

    const checkInsAfter = await store.listCheckIns(orgId, aliceId, 10);
    expect(checkInsAfter.items.length).toBe(0);

    const privateItemsAfter = await store.listPrivateItems(orgId, aliceId, 10);
    expect(privateItemsAfter.items.length).toBe(0);

    // 5. Verify grants and publications are revoked and inaccessible
    const grantAfter = await store.getGrant(orgId, grant.id);
    expect(grantAfter?.status).toBe("revoked");

    const publicationAfter = await store.getPublication(orgId, grant.id, 1);
    expect(publicationAfter).toBeUndefined();

    // 6. Verify team release was synchronously invalidated
    const charlieCaller = { userId: charlieId, tokenGroups: ["manager"] };
    const teamAggregate = await store.getTeamAggregate(orgId, teamId, charlieCaller, { from: "2026-03-01", to: "2026-03-07" });
    expect(teamAggregate.state).toBe("invalid");

    // 7. Verify member is inactive and identity pointer is deleted
    const memberAfter = await store.getMembership(orgId, aliceId);
    expect(memberAfter?.status).toBe("inactive");

    const userMemberships = await store.listUserMemberships(aliceId);
    expect(userMemberships.length).toBe(0);
  });

  it("gate 5: one-time private item 365-day retention cleanup purges expired items only", async () => {
    const { client, store } = await setupTestStore();

    // Ongoing item (never age-expires)
    await store.createPrivateItem(orgId, aliceId, {
      type: "personal_goal",
      title: "Learn Rust",
      lifecycle: "ongoing",
    });

    // One-time item not yet expired (deleteAfter is in future)
    await store.createPrivateItem(orgId, aliceId, {
      type: "leave_detail",
      title: "Future Leave",
      lifecycle: "one_time",
      eventEndAt: "2026-10-01T00:00:00.000Z",
    });

    // One-time item that has passed 365 days (deleteAfter in past)
    const expiredItemId = "item_expired_123";
    await client.send(new PutCommand({
      TableName: "TestTable",
      Item: {
        ...keys.privateRecord(orgId, aliceId, `ITEM#${expiredItemId}`),
        entityType: "PRIVATE_ITEM",
        id: expiredItemId,
        orgId,
        ownerId: aliceId,
        type: "leave_detail",
        title: "Old Leave Over A Year Ago",
        lifecycle: "one_time",
        eventEndAt: "2024-01-01T00:00:00.000Z",
        deleteAfter: "2025-01-01T00:00:00.000Z",
        schemaVersion: 1,
        version: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    }));

    // Run cleanup
    const pruned = await store.cleanupExpiredPrivateItems(orgId, aliceId, new Date("2026-03-01T00:00:00.000Z"));
    expect(pruned).toBe(1);

    const remaining = await store.listPrivateItems(orgId, aliceId, 10);
    const remainingTitles = remaining.items.map((i) => i.title);
    expect(remainingTitles).toContain("Learn Rust");
    expect(remainingTitles).toContain("Future Leave");
    expect(remainingTitles).not.toContain("Old Leave Over A Year Ago");
  });

  it("gate 6: lifecycle worker handles owner.export, owner.delete, and lifecycle.schedule payloads", async () => {
    const { store } = await setupTestStore();

    // 1. Worker export
    const exportJob = await store.createExportJob(orgId, aliceId);
    const workerExportResult = await processLifecycleJob(store, {
      jobType: "owner.export",
      targetId: `${orgId}#${aliceId}#${exportJob.id}`,
    });
    expect((workerExportResult as { id: string }).id).toBe(exportJob.id);

    // 2. Worker schedule cleanup
    const scheduleResult = await processLifecycleJob(store, {
      jobType: "lifecycle.schedule",
      targetId: `${orgId}#${aliceId}`,
    });
    expect("prunedCount" in scheduleResult).toBe(true);

    // 3. Worker delete
    const deleteJob = await store.createDeletionJob(orgId, aliceId, { scope: "all", confirmed: true });
    const deleteWorkerResult = await processLifecycleJob(store, {
      jobType: "owner.delete",
      targetId: `${orgId}#${aliceId}#${deleteJob.id}`,
    });
    expect("success" in deleteWorkerResult).toBe(true);
  });

  it("gate 7: scoped tasks export excludes other personal collections", async () => {
    const { store } = await setupTestStore();
    const job = await store.createExportJob(orgId, aliceId, { scope: "tasks" });
    const download = await store.getExportDownload(orgId, aliceId, job.id);
    expect(download.data.tasks.length).toBeGreaterThan(0);
    expect(download.data.checkIns).toEqual([]);
    expect(download.data.privateItems).toEqual([]);
    expect(download.data.grants).toEqual([]);
    expect(download.data.preferences).toBeUndefined();
  });

  it("gate 8: scoped check-ins export excludes tasks and private items", async () => {
    const { store } = await setupTestStore();
    const job = await store.createExportJob(orgId, aliceId, { scope: "checkins" });
    const download = await store.getExportDownload(orgId, aliceId, job.id);
    expect(download.data.checkIns.length).toBeGreaterThan(0);
    expect(download.data.tasks).toEqual([]);
    expect(download.data.privateItems).toEqual([]);
  });

  it("gate 9: shares export contains grant metadata without personal records", async () => {
    const { store } = await setupTestStore();
    const job = await store.createExportJob(orgId, aliceId, { scope: "shares" });
    const download = await store.getExportDownload(orgId, aliceId, job.id);
    expect(download.data.grants).toEqual(expect.any(Array));
    expect(download.data.tasks).toEqual([]);
    expect(download.data.checkIns).toEqual([]);
    expect(download.data.privateItems).toEqual([]);
  });

  it("gate 10: all export remains owner-scoped and excludes aggregate datasets", async () => {
    const { store } = await setupTestStore();
    const job = await store.createExportJob(orgId, aliceId, { scope: "all" });
    const download = await store.getExportDownload(orgId, aliceId, job.id);
    expect(download.data.orgId).toBe(orgId);
    expect(download.data.userId).toBe(aliceId);
    expect(download.data).not.toHaveProperty("aggregates");
    expect(download.data).not.toHaveProperty("iam");
  });
});
