import type { CheckInRecord, EvidenceStrength, TaskRecord } from "@workload/contracts";

export interface WeeklyWorkloadPoint {
  weekStart: string;
  effortValue: number;
  effortUnit: "hours" | "points";
  meanManageability?: number;
  taskIds: string[];
  checkInIds: string[];
}

function mondayOf(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

export function evidenceStrength(weeksWithEvidence: number): EvidenceStrength {
  if (weeksWithEvidence >= 6) return "consistent";
  if (weeksWithEvidence >= 3) return "developing";
  return "limited";
}

export function calculateWeeklyWorkload(tasks: TaskRecord[], checkIns: CheckInRecord[]): WeeklyWorkloadPoint[] {
  const units = new Set(tasks.map((task) => task.effort.unit));
  if (units.size > 1) throw new Error("Workload effort units cannot be mixed in one trend");
  const unit = tasks[0]?.effort.unit ?? "hours";
  const byWeek = new Map<string, WeeklyWorkloadPoint & { ratings: number[] }>();
  const pointFor = (weekStart: string) => {
    const current = byWeek.get(weekStart);
    if (current) return current;
    const created: WeeklyWorkloadPoint & { ratings: number[] } = {
      weekStart, effortValue: 0, effortUnit: unit, taskIds: [], checkInIds: [], ratings: [],
    };
    byWeek.set(weekStart, created);
    return created;
  };
  for (const task of tasks) {
    const point = pointFor(mondayOf(task.workDate));
    point.effortValue += task.effort.value;
    point.taskIds.push(task.id);
  }
  for (const checkIn of checkIns) {
    const point = pointFor(mondayOf(checkIn.checkInDate));
    point.ratings.push(checkIn.manageability);
    point.checkInIds.push(checkIn.id);
  }
  return [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)).map(({ ratings, ...point }) => ({
    ...point,
    ...(ratings.length ? { meanManageability: ratings.reduce((sum, value) => sum + value, 0) / ratings.length } : {}),
  }));
}
