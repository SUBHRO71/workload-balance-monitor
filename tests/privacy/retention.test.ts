import { describe, expect, it } from "vitest";
import { privateItemDeleteAfter } from "../../packages/domain/src/index";

describe("private item retention", () => {
  it("does not age-expire ongoing items", () => expect(privateItemDeleteAfter({ type: "personal_goal", title: "Learn", lifecycle: "ongoing" })).toBeUndefined());
  it("expires one-time items 365 days after the event end", () => expect(privateItemDeleteAfter({ type: "leave_detail", title: "Leave", lifecycle: "one_time", eventEndAt: "2026-03-10T00:00:00.000Z" })).toBe("2027-03-10T00:00:00.000Z"));
});
