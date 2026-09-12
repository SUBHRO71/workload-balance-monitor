import { describe, expect, it } from "vitest";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { WorkloadStore } from "../../packages/backend-core/src/dynamo-store";
import { keys } from "../../packages/backend-core/src/keys";
import { aggregateResponseSchema } from "../../packages/contracts/src/insights";
import { createInMemoryDynamoClient } from "./in-memory-dynamo";
import type { CallerIdentity } from "../../packages/backend-core/src/authorization";

describe("Phase 4: Protected Team & HR Releases Pipeline", () => {
  const orgId = "org-privacy-test";
  const managerId = "mgr-lead-01";
  const otherManagerId = "mgr-other-02";
  const hrId = "hr-admin-01";
  const regularUserId = "user-regular-01";
  const teamId = "team-eng-alpha";
  const windowRange = { from: "2026-03-01", to: "2026-03-07" };

  const managerCaller: CallerIdentity = { userId: managerId, tokenGroups: ["manager"] };
  const otherManagerCaller: CallerIdentity = { userId: otherManagerId, tokenGroups: ["manager"] };
  const hrCaller: CallerIdentity = { userId: hrId, tokenGroups: ["hr"] };
  const regularCaller: CallerIdentity = { userId: regularUserId, tokenGroups: ["member"] };

  async function setupEnvironment(userCount = 6, teamConsentCount = 6, orgConsentCount = 6) {
    const client = createInMemoryDynamoClient();
    const store = new WorkloadStore("TestTable", client);

    // Seed Manager membership & team manager pointer
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.member(orgId, managerId),
          orgId, userId: managerId, displayName: "Manager Lead", email: "manager@example.invalid",
          roles: ["member", "manager"], status: "active", membershipVersion: 1,
        },
      }),
    );
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: { ...keys.teamManager(orgId, teamId, managerId), status: "active" },
      }),
    );
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: { PK: keys.userTeams(orgId, managerId).PK, SK: `TEAM#${teamId}`, teamId },
      }),
    );

    // Seed Other Manager (manages a different team)
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.member(orgId, otherManagerId),
          orgId, userId: otherManagerId, displayName: "Other Manager", email: "other@example.invalid",
          roles: ["member", "manager"], status: "active", membershipVersion: 1,
        },
      }),
    );

    // Seed HR membership
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.member(orgId, hrId),
          orgId, userId: hrId, displayName: "HR Specialist", email: "hr@example.invalid",
          roles: ["member", "hr"], status: "active", membershipVersion: 1,
        },
      }),
    );

    // Seed Members
    for (let i = 1; i <= userCount; i++) {
      const uid = `emp-${String(i).padStart(3, "0")}`;
      await client.send(
        new PutCommand({
          TableName: "TestTable",
          Item: {
            ...keys.member(orgId, uid),
            orgId, userId: uid, displayName: `Employee ${i}`, email: `emp${i}@example.invalid`,
            roles: ["member"], status: "active", membershipVersion: 1,
          },
        }),
      );

      // Team assignment
      await client.send(
        new PutCommand({
          TableName: "TestTable",
          Item: {
            ...keys.teamAssignment(orgId, teamId, uid),
            orgId, teamId, userId: uid, directManagerId: managerId,
            effectiveFrom: "2026-01-01T00:00:00.000Z", assignmentVersion: 1, status: "active",
          },
        }),
      );
      await client.send(
        new PutCommand({
          TableName: "TestTable",
          Item: { PK: keys.userTeams(orgId, uid).PK, SK: `TEAM#${teamId}`, teamId },
        }),
      );

      // Consent records
      const hasTeamConsent = i <= teamConsentCount;
      const hasOrgConsent = i <= orgConsentCount;
      await store.putConsent(orgId, uid, {
        personalProcessing: true,
        teamAggregation: hasTeamConsent,
        organizationAggregation: hasOrgConsent,
        notifications: { inApp: false, managerEmail: false, devicePush: false },
      });

      // Tasks and Check-ins within the window
      await store.createTask(orgId, uid, {
        title: `Work Task for ${uid}`,
        workDate: "2026-03-03",
        effort: { value: 30 + i * 2, unit: "hours" },
        status: "done",
      });

      await store.createCheckIn(orgId, uid, {
        checkInDate: "2026-03-04",
        manageability: Math.min(5, Math.max(1, (i % 4) + 1)),
      });
    }

    return { client, store };
  }

  it("suppresses team aggregate when consenting contributors are fewer than 5", async () => {
    // 4 members with team consent
    const { store } = await setupEnvironment(4, 4, 4);

    const aggregate = await store.computeAndSaveTeamAggregate(orgId, teamId, windowRange);

    // Strictly validate against schema
    expect(() => aggregateResponseSchema.parse(aggregate)).not.toThrow();

    expect(aggregate.state).toBe("insufficient_contributors");
    expect(aggregate.metrics).toBeUndefined(); // Strictly omitted per contract!
    expect(aggregate.reason).toContain("At least 5 distinct consenting contributors are required");

    // Manager read also gets suppressed aggregate
    const managerRead = await store.getTeamAggregate(orgId, teamId, managerCaller, windowRange);
    expect(managerRead.state).toBe("insufficient_contributors");
    expect(managerRead.metrics).toBeUndefined();
  });

  it("publishes team aggregate when 5 or more consenting contributors participate", async () => {
    // 5 members with team consent
    const { store } = await setupEnvironment(5, 5, 5);

    const aggregate = await store.computeAndSaveTeamAggregate(orgId, teamId, windowRange);

    expect(() => aggregateResponseSchema.parse(aggregate)).not.toThrow();
    expect(aggregate.state).toBe("available");
    expect(aggregate.metrics).toBeDefined();
    expect(aggregate.metrics!.length).toBeGreaterThan(0);

    const effortMetric = aggregate.metrics!.find((m) => m.key === "meanWeeklyEffort");
    expect(effortMetric).toBeDefined();
    expect(effortMetric?.contributorCountBand).toBe("5-9");
    // Values: 32, 34, 36, 38, 40 -> mean = 36.0
    expect(effortMetric?.value).toBe(36.0);

    // Manageability
    const manageabilityMetric = aggregate.metrics!.find((m) => m.key === "meanManageability");
    expect(manageabilityMetric).toBeDefined();
    expect(manageabilityMetric?.contributorCountBand).toBe("5-9");

    // Manager can read the published release
    const managerRead = await store.getTeamAggregate(orgId, teamId, managerCaller, windowRange);
    expect(managerRead.state).toBe("available");
    expect(managerRead.metrics).toEqual(aggregate.metrics);
  });

  it("strictly excludes members without teamAggregation consent", async () => {
    // 6 members total, but only 4 consented to team aggregation
    const { store } = await setupEnvironment(6, 4, 6);

    const aggregate = await store.computeAndSaveTeamAggregate(orgId, teamId, windowRange);

    // Since only 4 consented, it must be suppressed!
    expect(aggregate.state).toBe("insufficient_contributors");
    expect(aggregate.metrics).toBeUndefined();
  });

  it("suppresses successive releases with unsafe contributor overlap", async () => {
    const { client, store } = await setupEnvironment(6, 6, 6);

    // Initial release for window 1 with contributors emp-001..emp-005
    await store.computeAndSaveTeamAggregate(orgId, teamId, windowRange);

    // Now pretend window 2 has contributors emp-002..emp-006 (symmetric difference = 2: emp-001 left, emp-006 joined)
    // Small shift (<5) between successive releases triggers unsafe_overlap suppression!
    const window2Range = { from: "2026-03-08", to: "2026-03-14" };

    // Seed task for window 2
    for (let i = 2; i <= 6; i++) {
      const uid = `emp-${String(i).padStart(3, "0")}`;
      await store.createTask(orgId, uid, {
        title: `Window 2 task for ${uid}`,
        workDate: "2026-03-10",
        effort: { value: 35, unit: "hours" },
        status: "done",
      });
    }

    // Seed existing window record with previous contributors
    const windowKey = `${window2Range.from}_${window2Range.to}`;
    await client.send(
      new PutCommand({
        TableName: "TestTable",
        Item: {
          ...keys.teamView(orgId, teamId, windowKey),
          contributorIds: ["emp-001", "emp-002", "emp-003", "emp-004", "emp-005"],
        },
      }),
    );

    const successiveRelease = await store.computeAndSaveTeamAggregate(orgId, teamId, window2Range);

    expect(() => aggregateResponseSchema.parse(successiveRelease)).not.toThrow();
    expect(successiveRelease.state).toBe("unsafe_overlap");
    expect(successiveRelease.metrics).toBeUndefined();
    expect(successiveRelease.reason).toContain("contributor change is too small");
  });

  it("synchronously invalidates releases upon consent withdrawal", async () => {
    // 5 consenting members -> initially available
    const { store } = await setupEnvironment(5, 5, 5);
    const initial = await store.computeAndSaveTeamAggregate(orgId, teamId, windowRange);
    expect(initial.state).toBe("available");

    // Employee 1 withdraws team aggregation consent
    await store.putConsent(orgId, "emp-001", {
      personalProcessing: true,
      teamAggregation: false,
      organizationAggregation: false,
      notifications: { inApp: false, managerEmail: false, devicePush: false },
    });

    // Existing release is now invalidated
    const readAfterWithdrawal = await store.getTeamAggregate(orgId, teamId, managerCaller, windowRange);
    expect(readAfterWithdrawal.state).toBe("invalid");
    expect(readAfterWithdrawal.metrics).toBeUndefined();
  });

  it("computes independent organization-wide releases for HR", async () => {
    // 6 members with organization aggregation consent
    const { store } = await setupEnvironment(6, 6, 6);

    const orgAggregate = await store.computeAndSaveOrgAggregate(orgId, windowRange);

    expect(() => aggregateResponseSchema.parse(orgAggregate)).not.toThrow();
    expect(orgAggregate.state).toBe("available");
    expect(orgAggregate.metrics).toBeDefined();

    // HR can read
    const hrRead = await store.getOrgAggregate(orgId, hrCaller, windowRange);
    expect(hrRead.state).toBe("available");
    expect(hrRead.metrics).toEqual(orgAggregate.metrics);
  });

  it("enforces strict authorization boundaries for manager and HR endpoints", async () => {
    const { store } = await setupEnvironment(5, 5, 5);
    await store.computeAndSaveTeamAggregate(orgId, teamId, windowRange);
    await store.computeAndSaveOrgAggregate(orgId, windowRange);

    // 1. Manager cannot view aggregate of a team they do not manage
    await expect(store.getTeamAggregate(orgId, "team-unauthorized", managerCaller, windowRange)).rejects.toThrow(
      "Team is not available",
    );

    // 2. Another manager cannot view teamId where they are not assigned manager
    await expect(store.getTeamAggregate(orgId, teamId, otherManagerCaller, windowRange)).rejects.toThrow(
      "Team is not available",
    );

    // 3. Regular member cannot view team aggregates
    await expect(store.getTeamAggregate(orgId, teamId, regularCaller, windowRange)).rejects.toThrow(
      "Organization role is not available",
    );

    // 4. Regular member cannot view HR aggregates
    await expect(store.getOrgAggregate(orgId, regularCaller, windowRange)).rejects.toThrow(
      "Organization role is not available",
    );

    // 5. Manager cannot view HR aggregates (unless they also have HR role)
    await expect(store.getOrgAggregate(orgId, managerCaller, windowRange)).rejects.toThrow(
      "Organization role is not available",
    );

    // 6. HR can view HR aggregates
    const hrView = await store.getOrgAggregate(orgId, hrCaller, windowRange);
    expect(hrView.state).toBe("available");
  });
});
