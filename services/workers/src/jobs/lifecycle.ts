import type { WorkloadStore } from "@workload/backend-core";
import type { LifecycleJobRecord } from "@workload/contracts";

export interface LifecycleJobPayload {
  jobType: "owner.export" | "owner.delete" | "lifecycle.schedule";
  targetId: string;
  schemaVersion?: number;
}

export async function processLifecycleJob(
  store: WorkloadStore,
  payload: LifecycleJobPayload,
): Promise<LifecycleJobRecord | { success: boolean; deletedCount: number } | { prunedCount: number }> {
  const parts = payload.targetId.split("#");
  const orgId = parts[0];
  const userId = parts[1];
  const jobIdOrItemId = parts[2];

  if (!orgId || !userId) {
    throw new Error(`Invalid targetId for lifecycle job: ${payload.targetId}`);
  }

  if (payload.jobType === "owner.export") {
    const jobId = jobIdOrItemId ?? "";
    await store.compileOwnerExportData(orgId, userId, jobId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    const job = await store.getJob(orgId, userId, jobId);
    if (!job) throw new Error(`Export job ${jobId} not found`);
    return job;
  }

  if (payload.jobType === "owner.delete") {
    return store.executeDeletion(orgId, userId, jobIdOrItemId);
  }

  if (payload.jobType === "lifecycle.schedule") {
    const prunedCount = await store.cleanupExpiredPrivateItems(orgId, userId);
    return { prunedCount };
  }

  throw new Error(`Unsupported lifecycle job type: ${payload.jobType}`);
}
