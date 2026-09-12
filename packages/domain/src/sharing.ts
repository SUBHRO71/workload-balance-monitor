import type {
  CheckInRecord,
  DateRange,
  TaskRecord,
} from "@workload/contracts";
import type { WeeklyWorkloadPoint } from "./trends";

export type TaskShareField = "title" | "workDate" | "effort" | "status" | "priority" | "dueAt";
export type CheckInShareField = "checkInDate" | "manageability";
export type SummaryShareField = "weeklyEffort" | "manageabilityTrend" | "evidenceStrength";

export function isDateInRange(dateStr: string, range: DateRange): boolean {
  return dateStr >= range.from && dateStr <= range.to;
}

export function projectTaskValues(task: TaskRecord, fields: TaskShareField[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in task && (task as unknown as Record<string, unknown>)[field] !== undefined) {
      values[field] = (task as unknown as Record<string, unknown>)[field];
    }
  }
  return values;
}

export function projectCheckInValues(checkIn: CheckInRecord, fields: CheckInShareField[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (field === "checkInDate") values.checkInDate = checkIn.checkInDate;
    if (field === "manageability") values.manageability = checkIn.manageability;
  }
  return values;
}

export function projectSummaryValues(points: WeeklyWorkloadPoint[], fields: SummaryShareField[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (field === "weeklyEffort") {
      values.weeklyEffort = points.map((p) => ({ weekStart: p.weekStart, effortValue: p.effortValue, effortUnit: p.effortUnit }));
    } else if (field === "manageabilityTrend") {
      values.manageabilityTrend = points.map((p) => ({ weekStart: p.weekStart, meanManageability: p.meanManageability }));
    } else if (field === "evidenceStrength") {
      values.evidenceStrength = points.length >= 6 ? "consistent" : points.length >= 3 ? "developing" : "limited";
    }
  }
  return values;
}
