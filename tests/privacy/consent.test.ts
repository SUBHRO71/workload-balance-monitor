import { describe, expect, it } from "vitest";
import { consentSchema } from "../../packages/contracts/src/index";

describe("consent contract", () => {
  it("grants no consent when scopes are omitted", () => {
    expect(consentSchema.parse({})).toEqual({
      personalProcessing: false,
      teamAggregation: false,
      organizationAggregation: false,
      notifications: { inApp: false, managerEmail: false, devicePush: false },
    });
  });
  it("does not coerce string values into opt-in", () => {
    expect(consentSchema.safeParse({ teamAggregation: "true" }).success).toBe(false);
  });
  it("does not opt into other scopes when one is selected", () => {
    expect(consentSchema.parse({ personalProcessing: true })).toEqual({
      personalProcessing: true,
      teamAggregation: false,
      organizationAggregation: false,
      notifications: { inApp: false, managerEmail: false, devicePush: false },
    });
  });

  it("keeps team and HR aggregation independent", () => {
    const consent = consentSchema.parse({ teamAggregation: true });
    expect(consent.teamAggregation).toBe(true);
    expect(consent.organizationAggregation).toBe(false);
  });
});
