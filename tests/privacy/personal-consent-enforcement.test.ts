import { describe, expect, it } from "vitest";
import { AuthorizationError, WorkloadStore } from "../../packages/backend-core/src/index";
import { createInMemoryDynamoClient } from "./in-memory-dynamo";

describe("personal consent enforcement", () => {
  it("blocks task, check-in, and private-item creation when personal processing consent is not enabled", async () => {
    const store = new WorkloadStore("test-table", createInMemoryDynamoClient());

    await expect(
      store.createTask("org-1", "user-1", {
        title: "Sprint Planning",
        workDate: "2026-02-02",
        effort: { value: 4, unit: "hours" },
        status: "planned",
      }),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      store.createCheckIn("org-1", "user-1", {
        checkInDate: "2026-02-02",
        manageability: 3,
        privateNote: "High focus day",
      }),
    ).rejects.toThrow(AuthorizationError);

    await expect(
      store.createPrivateItem("org-1", "user-1", {
        type: "note",
        title: "Personal notes",
        lifecycle: "ongoing",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("permits writes after consent is granted, then blocks writes immediately upon withdrawal while preserving read access", async () => {
    const store = new WorkloadStore("test-table", createInMemoryDynamoClient());

    // 1. Grant personal processing consent
    await store.putConsent("org-1", "user-1", {
      personalProcessing: true,
      teamAggregation: false,
      organizationAggregation: false,
      notifications: { inApp: false, managerEmail: false, devicePush: false },
    });

    const task = await store.createTask("org-1", "user-1", {
      title: "Write documentation",
      workDate: "2026-02-03",
      effort: { value: 3, unit: "hours" },
      status: "done",
    });
    expect(task.title).toBe("Write documentation");

    // 2. Withdraw personal processing consent
    await store.putConsent("org-1", "user-1", {
      personalProcessing: false,
      teamAggregation: false,
      organizationAggregation: false,
      notifications: { inApp: false, managerEmail: false, devicePush: false },
    });

    // 3. New writes must fail
    await expect(
      store.createTask("org-1", "user-1", {
        title: "New task after withdrawal",
        workDate: "2026-02-04",
        effort: { value: 2, unit: "hours" },
        status: "planned",
      }),
    ).rejects.toThrow(AuthorizationError);

    // 4. Existing data remains accessible for owner review/export
    const existing = await store.getTask("org-1", "user-1", task.id);
    expect(existing).toBeDefined();
    expect(existing?.title).toBe("Write documentation");
  });
});
