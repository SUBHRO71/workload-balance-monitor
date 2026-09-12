import { describe, expect, it } from "vitest";
import { AuthorizationError, WorkloadStore } from "../../packages/backend-core/src/index";
import { createInMemoryDynamoClient } from "./in-memory-dynamo";

const consent = {
  personalProcessing: true,
  teamAggregation: false,
  organizationAggregation: false,
  notifications: { inApp: false, managerEmail: false, devicePush: false },
} as const;

describe("personal write idempotency", () => {
  it("returns the original task and does not duplicate it when a key is replayed", async () => {
    const store = new WorkloadStore("test-table", createInMemoryDynamoClient());
    await store.putConsent("org-1", "user-1", consent);

    const input = { title: "Prepare review", workDate: "2026-09-13", effort: { value: 2, unit: "hours" as const }, status: "planned" as const };
    const first = await store.createTask("org-1", "user-1", input, "task-submit-1");
    const replay = await store.createTask("org-1", "user-1", input, "task-submit-1");

    expect(replay.id).toBe(first.id);
    expect((await store.listTasks("org-1", "user-1")).items).toHaveLength(1);
  });

  it("rejects reusing a key with a different task payload", async () => {
    const store = new WorkloadStore("test-table", createInMemoryDynamoClient());
    await store.putConsent("org-1", "user-1", consent);

    await store.createTask("org-1", "user-1", {
      title: "Original", workDate: "2026-09-13", effort: { value: 2, unit: "hours" }, status: "planned",
    }, "task-submit-2");

    await expect(store.createTask("org-1", "user-1", {
      title: "Changed", workDate: "2026-09-13", effort: { value: 2, unit: "hours" }, status: "planned",
    }, "task-submit-2")).rejects.toMatchObject({ statusCode: 409 } satisfies Partial<AuthorizationError>);
  });

  it("returns the original check-in when a key is replayed", async () => {
    const store = new WorkloadStore("test-table", createInMemoryDynamoClient());
    await store.putConsent("org-1", "user-1", consent);

    const input = { checkInDate: "2026-09-13", manageability: 4, privateNote: "Steady" };
    const first = await store.createCheckIn("org-1", "user-1", input, "checkin-submit-1");
    const replay = await store.createCheckIn("org-1", "user-1", input, "checkin-submit-1");

    expect(replay.id).toBe(first.id);
    expect((await store.listCheckIns("org-1", "user-1")).items).toHaveLength(1);
  });
});
