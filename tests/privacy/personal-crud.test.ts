import { describe, expect, it } from "vitest";
import { WorkloadStore } from "../../packages/backend-core/src/index";
import { createInMemoryDynamoClient } from "./in-memory-dynamo";

describe("personal journeys CRUD and retention", () => {
  it("manages tasks, check-ins, preferences, and trends", async () => {
    const store = new WorkloadStore("test-table", createInMemoryDynamoClient());
    await store.putConsent("org-1", "user-1", {
      personalProcessing: true,
      teamAggregation: false,
      organizationAggregation: false,
      notifications: { inApp: false, managerEmail: false, devicePush: false },
    });

    // Preferences
    await store.putPreferences("org-1", "user-1", {
      timezone: "America/New_York",
      weeklyCapacity: { value: 35, unit: "hours" },
    });
    const prefs = await store.getPreferences("org-1", "user-1");
    expect(prefs.timezone).toBe("America/New_York");
    expect(prefs.weeklyCapacity?.value).toBe(35);

    // Tasks
    const task1 = await store.createTask("org-1", "user-1", {
      title: "Task 1",
      workDate: "2026-02-02",
      effort: { value: 10, unit: "hours" },
      status: "done",
    });
    const task2 = await store.createTask("org-1", "user-1", {
      title: "Task 2",
      workDate: "2026-02-09",
      effort: { value: 15, unit: "hours" },
      status: "done",
    });

    const tasksList = await store.listTasks("org-1", "user-1");
    expect(tasksList.items).toHaveLength(2);

    const updatedTask = await store.updateTask("org-1", "user-1", task1.id, {
      title: "Task 1 Updated",
      effort: { value: 12, unit: "hours" },
    });
    expect(updatedTask.title).toBe("Task 1 Updated");
    expect(updatedTask.version).toBe(2);

    // Check-ins
    const checkIn = await store.createCheckIn("org-1", "user-1", {
      checkInDate: "2026-02-02",
      manageability: 4,
      privateNote: "Doing well",
    });
    expect(checkIn.manageability).toBe(4);

    const checkInsList = await store.listCheckIns("org-1", "user-1");
    expect(checkInsList.items).toHaveLength(1);

    // Trends
    const trends = await store.getPersonalTrends("org-1", "user-1");
    expect(trends.points).toHaveLength(2);
    expect(trends.points[0]?.effortValue).toBe(12);
    expect(trends.points[0]?.meanManageability).toBe(4);
    expect(trends.points[1]?.effortValue).toBe(15);
    expect(trends.evidenceStrength).toBe("limited"); // 2 weeks of data

    // Delete task
    await store.deleteTask("org-1", "user-1", task2.id);
    const afterDelete = await store.listTasks("org-1", "user-1");
    expect(afterDelete.items).toHaveLength(1);
  });

  it("enforces 365-day deletion on one-time private items and recalculates on date update", async () => {
    const store = new WorkloadStore("test-table", createInMemoryDynamoClient());
    await store.putConsent("org-1", "user-1", {
      personalProcessing: true,
      teamAggregation: false,
      organizationAggregation: false,
      notifications: { inApp: false, managerEmail: false, devicePush: false },
    });

    // Ongoing item (retained until user deletes)
    const ongoing = await store.createPrivateItem("org-1", "user-1", {
      type: "personal_goal",
      title: "Read more books",
      lifecycle: "ongoing",
    });
    expect(ongoing.deleteAfter).toBeUndefined();

    // One-time item (365 days after eventEndAt)
    const oneTime = await store.createPrivateItem("org-1", "user-1", {
      type: "leave_detail",
      title: "Family leave",
      lifecycle: "one_time",
      eventEndAt: "2026-06-01T00:00:00.000Z",
    });
    expect(oneTime.deleteAfter).toBe("2027-06-01T00:00:00.000Z");

    // Updating eventEndAt recalculates deleteAfter
    const updated = await store.updatePrivateItem("org-1", "user-1", oneTime.id, {
      eventEndAt: "2026-07-01T00:00:00.000Z",
    });
    expect(updated.deleteAfter).toBe("2027-07-01T00:00:00.000Z");

    // Private items never leak into trends
    const trends = await store.getPersonalTrends("org-1", "user-1");
    expect(trends.points).toHaveLength(0);
  });
});
