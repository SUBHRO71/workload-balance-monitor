import type { WorkloadStore } from "@workload/backend-core";
import type { AggregateResponse, DateRange } from "@workload/contracts";

export interface AggregateJobPayload {
  jobType: "team.aggregate" | "org.aggregate" | "publication.invalidate";
  targetId: string;
  range?: DateRange;
  expectedDisclosureGeneration?: number;
}

export async function processAggregateJob(
  store: WorkloadStore,
  payload: AggregateJobPayload,
): Promise<AggregateResponse | { invalidated: boolean }> {
  const defaultRange: DateRange = payload.range ?? {
    from: "2026-03-01",
    to: "2026-03-07",
  };

  if (payload.expectedDisclosureGeneration !== undefined && payload.jobType !== "publication.invalidate") {
    const orgId = payload.targetId.split("#")[0];
    if (!orgId) throw new Error("Invalid aggregate target");
    const policy = await store.getOrganizationPolicy(orgId);
    if (policy.disclosureGeneration !== payload.expectedDisclosureGeneration) {
      return { state: "invalid", range: defaultRange, evidenceStrength: "limited", reason: "Stale disclosure generation discarded" };
    }
  }

  if (payload.jobType === "team.aggregate") {
    const [orgId, teamId] = payload.targetId.split("#");
    if (!orgId || !teamId) throw new Error("Invalid targetId for team.aggregate; expected orgId#teamId");
    return store.computeAndSaveTeamAggregate(orgId, teamId, defaultRange);
  }

  if (payload.jobType === "org.aggregate") {
    const orgId = payload.targetId;
    if (!orgId) throw new Error("Invalid targetId for org.aggregate; expected orgId");
    return store.computeAndSaveOrgAggregate(orgId, defaultRange);
  }

  if (payload.jobType === "publication.invalidate") {
    const parts = payload.targetId.split("#");
    const orgId = parts[0]!;
    const teamId = parts[1];
    await store.invalidateAggregateReleases(orgId, teamId);
    return { invalidated: true };
  }

  throw new Error(`Unsupported job type: ${payload.jobType}`);
}
