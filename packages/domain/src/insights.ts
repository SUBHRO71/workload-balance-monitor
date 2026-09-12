import type { EvidenceStrength, SuggestionCategory } from "@workload/contracts";
import { evidenceStrength, type WeeklyWorkloadPoint } from "./trends";

export interface PersonalInsight {
  ruleVersion: "personal-v1";
  evidenceStrength: EvidenceStrength;
  category: SuggestionCategory;
  title: string;
  explanation: string;
  evidenceRecordIds: string[];
}

export function generatePersonalInsights(points: WeeklyWorkloadPoint[], weeklyCapacity?: number): PersonalInsight[] {
  const usable = points.filter((point) => point.taskIds.length || point.checkInIds.length);
  const strength = evidenceStrength(usable.length);
  if (usable.length < 2) return [];
  const recent = usable.slice(-3);
  const evidenceRecordIds = recent.flatMap((point) => [...point.taskIds, ...point.checkInIds]);
  const insights: PersonalInsight[] = [];
  const risingEffort = recent.length === 3 && recent[0]!.effortValue < recent[1]!.effortValue && recent[1]!.effortValue < recent[2]!.effortValue;
  if (risingEffort) insights.push({
    ruleVersion: "personal-v1", evidenceStrength: strength, category: "reprioritize",
    title: "Your entered workload has increased",
    explanation: "Your entered effort increased in each of the last three weeks with data. Consider reviewing priorities; this describes your entries, not your productivity.",
    evidenceRecordIds,
  });
  const ratings = recent.map((point) => point.meanManageability).filter((value): value is number => value !== undefined);
  if (ratings.length >= 2 && ratings.at(-1)! < ratings[0]!) insights.push({
    ruleVersion: "personal-v1", evidenceStrength: strength, category: "recovery",
    title: "Your manageability check-ins have declined",
    explanation: "Your latest voluntary manageability rating is lower than the earliest rating in this window. Consider recovery time or adjusting the plan.",
    evidenceRecordIds,
  });
  if (weeklyCapacity && recent.at(-1)!.effortUnit === "hours" && recent.at(-1)!.effortValue > weeklyCapacity) insights.push({
    ruleVersion: "personal-v1", evidenceStrength: strength, category: "manager_review",
    title: "Your entered effort is above your capacity preference",
    explanation: "Your latest entered weekly effort exceeds the capacity value you chose. You decide whether to share anything with your direct manager.",
    evidenceRecordIds,
  });
  return insights;
}
