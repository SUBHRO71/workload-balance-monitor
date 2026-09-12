import { describe, expect, it } from "vitest";
import { AuthorizationError, WorkloadStore } from "../../packages/backend-core/src/index";
import { createInMemoryDynamoClient } from "./in-memory-dynamo";

const consent = {
  personalProcessing: true,
  teamAggregation: false,
  organizationAggregation: false,
  notifications: { inApp: false, managerEmail: false, devicePush: false },
} as const;

describe("version and cursor boundaries", () => {
  it("rejects stale task and check-in updates", async () => {
    const store = new WorkloadStore("test-table", createInMemoryDynamoClient());
    await store.putConsent("org-1", "alice", consent);
    const task = await store.createTask("org-1", "alice", {
      title: "Initial", workDate: "2026-09-13", effort: { value: 1, unit: "hours" }, status: "planned",
    });
    await store.updateTask("org-1", "alice", task.id, { title: "First edit", expectedVersion: 1 });
    await expect(store.updateTask("org-1", "alice", task.id, { title: "Lost edit", expectedVersion: 1 })).rejects.toMatchObject({ statusCode: 409 });

    const checkIn = await store.createCheckIn("org-1", "alice", { checkInDate: "2026-09-13", manageability: 3 });
    await store.updateCheckIn("org-1", "alice", checkIn.id, { manageability: 4, expectedVersion: 1 });
    await expect(store.updateCheckIn("org-1", "alice", checkIn.id, { manageability: 2, expectedVersion: 1 })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects malformed, cross-owner, and cross-collection cursors", async () => {
    const store = new WorkloadStore("test-table", createInMemoryDynamoClient());
    await store.putConsent("org-1", "alice", consent);

    await expect(store.listTasks("org-1", "alice", 25, "not-base64-json")).rejects.toBeInstanceOf(AuthorizationError);
    const foreign = Buffer.from(JSON.stringify({ PK: "PRIVATE#ORG#org-1#USER#bob", SK: "TASK#2026-09-13#task-1" })).toString("base64url");
    await expect(store.listTasks("org-1", "alice", 25, foreign)).rejects.toMatchObject({ statusCode: 400 });
    const wrongCollection = Buffer.from(JSON.stringify({ PK: "PRIVATE#ORG#org-1#USER#alice", SK: "CHECKIN#2026-09-13#checkin-1" })).toString("base64url");
    await expect(store.listTasks("org-1", "alice", 25, wrongCollection)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects unbounded page sizes at the store boundary", async () => {
    const store = new WorkloadStore("test-table", createInMemoryDynamoClient());
    await expect(store.listTasks("org-1", "alice", 101)).rejects.toMatchObject({ statusCode: 400 });
    await expect(store.listCheckIns("org-1", "alice", 0)).rejects.toMatchObject({ statusCode: 400 });
    await expect(store.listPrivateItems("org-1", "alice", Number.NaN)).rejects.toMatchObject({ statusCode: 400 });
  });
});
