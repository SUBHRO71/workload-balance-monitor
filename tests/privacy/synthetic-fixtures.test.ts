import { describe, expect, it } from "vitest";
import { createSyntheticCohort } from "../../packages/test-fixtures/src/index";

describe("synthetic demo fixtures", () => {
  it("are deterministic, labeled synthetic, and use invalid email domains", () => {
    const first = createSyntheticCohort(5, 9);
    expect(first).toEqual(createSyntheticCohort(5, 9));
    expect(first.tasks.every((record) => record.source === "synthetic")).toBe(true);
    expect(first.memberships.every((record) => record.email.endsWith(".invalid"))).toBe(true);
  });
});
