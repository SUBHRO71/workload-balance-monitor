import { describe, expect, it } from "vitest";
import { privateItemInputSchema, sharingGrantInputSchema } from "../../packages/contracts/src/index";

describe("private and shared record contracts", () => {
  it("requires a relevant date for a one-time private item", () => {
    expect(privateItemInputSchema.safeParse({ type: "leave_detail", title: "Personal leave", lifecycle: "one_time" }).success).toBe(false);
  });

  it("does not allow a private check-in note to be selected", () => {
    const result = sharingGrantInputSchema.safeParse({
      recipientManagerId: "manager-1", range: { from: "2026-01-01", to: "2026-01-31" },
      expiresAt: "2026-02-01T00:00:00.000Z",
      selections: [{ recordType: "check_in", recordId: "checkin-1", recordVersion: 1, fields: ["privateNote"] }],
    });
    expect(result.success).toBe(false);
  });
});
