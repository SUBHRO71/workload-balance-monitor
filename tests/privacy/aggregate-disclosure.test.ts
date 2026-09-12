import { describe, expect, it } from "vitest";
import { evaluateMeanDisclosure } from "../../packages/domain/src/index";

const contribution = (contributorId: string, value: number) => ({ contributorId, value });

describe("aggregate disclosure", () => {
  it("suppresses fewer than five distinct contributors", () => {
    expect(evaluateMeanDisclosure([1, 2, 3, 4].map((n) => contribution(`u${n}`, n))).state).toBe("insufficient_contributors");
  });

  it("publishes an equally weighted mean for an eligible cohort", () => {
    expect(evaluateMeanDisclosure([1, 2, 3, 4, 5].map((n) => contribution(`u${n}`, n)))).toEqual({ state: "available", contributorCount: 5, value: 3 });
  });

  it("suppresses a successive release when one contributor changes", () => {
    const current = [2, 3, 4, 5, 6].map((n) => contribution(`u${n}`, n));
    expect(evaluateMeanDisclosure(current, 5, ["u1", "u2", "u3", "u4", "u5"]).state).toBe("unsafe_overlap");
  });
});
