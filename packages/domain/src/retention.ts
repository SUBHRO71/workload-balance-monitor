import type { PrivateItemInput } from "@workload/contracts";

const ONE_YEAR_DAYS = 365;

export function privateItemDeleteAfter(item: PrivateItemInput): string | undefined {
  if (item.lifecycle === "ongoing") return undefined;
  const date = new Date(item.eventEndAt);
  date.setUTCDate(date.getUTCDate() + ONE_YEAR_DAYS);
  return date.toISOString();
}
