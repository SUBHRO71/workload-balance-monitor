export const PROPOSED_MINIMUM_CONTRIBUTORS = 5;

export interface ContributorMetric {
  contributorId: string;
  value: number;
}

export type DisclosureDecision =
  | { state: "available"; contributorCount: number; value: number }
  | { state: "insufficient_contributors" | "unsafe_overlap"; contributorCount: number; reason: string };

export function contributorCountBand(count: number): "5-9" | "10-19" | "20+" {
  if (count >= 20) return "20+";
  if (count >= 10) return "10-19";
  return "5-9";
}

export function evaluateMeanDisclosure(
  contributions: ContributorMetric[],
  minimumContributors = PROPOSED_MINIMUM_CONTRIBUTORS,
  previousContributorIds: readonly string[] = [],
): DisclosureDecision {
  if (minimumContributors < PROPOSED_MINIMUM_CONTRIBUTORS) throw new Error("Privacy threshold cannot be lower than five");
  const unique = new Map<string, number>();
  for (const contribution of contributions) {
    if (!Number.isFinite(contribution.value)) throw new Error("Contribution values must be finite");
    if (unique.has(contribution.contributorId)) throw new Error("A contributor may appear only once per metric/window");
    unique.set(contribution.contributorId, contribution.value);
  }
  if (unique.size < minimumContributors) return {
    state: "insufficient_contributors", contributorCount: unique.size,
    reason: `At least ${minimumContributors} distinct consenting contributors are required`,
  };
  if (previousContributorIds.length) {
    const previous = new Set(previousContributorIds);
    const changed = new Set([...unique.keys()].filter((id) => !previous.has(id)));
    for (const id of previous) if (!unique.has(id)) changed.add(id);
    if (changed.size > 0 && changed.size < minimumContributors) return {
      state: "unsafe_overlap", contributorCount: unique.size,
      reason: "The contributor change is too small to safely publish a successive release",
    };
  }
  return { state: "available", contributorCount: unique.size, value: [...unique.values()].reduce((sum, value) => sum + value, 0) / unique.size };
}
