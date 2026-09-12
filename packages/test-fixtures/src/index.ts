import type { CheckInRecord, ConsentScopes, Membership, TaskRecord } from "@workload/contracts";

export const consentDisabledFixture: ConsentScopes = {
  personalProcessing: false, teamAggregation: false, organizationAggregation: false,
  notifications: { inApp: false, managerEmail: false, devicePush: false },
};

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

export function createSyntheticCohort(size = 8, seed = 712): {
  memberships: Membership[];
  tasks: TaskRecord[];
  checkIns: CheckInRecord[];
} {
  if (!Number.isInteger(size) || size < 1 || size > 100) throw new Error("Synthetic cohort size must be 1–100");
  const random = seeded(seed);
  const memberships: Membership[] = [];
  const tasks: TaskRecord[] = [];
  const checkIns: CheckInRecord[] = [];
  const createdAt = "2026-01-05T09:00:00.000Z";
  for (let index = 0; index < size; index += 1) {
    const ownerId = `demo-user-${index + 1}`;
    memberships.push({ orgId: "demo-org", userId: ownerId, displayName: `Demo Person ${index + 1}`, email: `person${index + 1}@example.invalid`, roles: ["member"], status: "active", membershipVersion: 1 });
    for (let week = 0; week < 6; week += 1) {
      const date = new Date("2026-01-05T00:00:00.000Z");
      date.setUTCDate(date.getUTCDate() + week * 7);
      const workDate = date.toISOString().slice(0, 10);
      tasks.push({ entityType: "TASK", id: `task-${index + 1}-${week + 1}`, orgId: "demo-org", ownerId, title: `Synthetic work item ${week + 1}`, workDate, effort: { value: Math.round((20 + random() * 25) * 10) / 10, unit: "hours" }, status: week === 5 ? "in_progress" : "done", source: "synthetic", schemaVersion: 1, version: 1, createdAt, updatedAt: createdAt });
      checkIns.push({ entityType: "CHECKIN", id: `checkin-${index + 1}-${week + 1}`, orgId: "demo-org", ownerId, checkInDate: workDate, manageability: Math.max(1, Math.min(5, Math.round(2 + random() * 3))), source: "synthetic", schemaVersion: 1, version: 1, createdAt, updatedAt: createdAt });
    }
  }
  return { memberships, tasks, checkIns };
}
