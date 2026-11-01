import { describe, expect, it } from "vitest";

import { getFinalizationProjection } from "@/server/solana/finalization-projection";

describe("chain action finalization projection", () => {
  it.each([
    ["fund", "funded", "contracted", false],
    ["accept", "active", null, false],
    ["submit", "submitted", null, false],
    ["release", "released", "completed", false],
    ["cancel", "cancelled", "cancelled", false],
    ["open_dispute", "disputed", "disputed", false],
    ["refund", "resolved", "cancelled", true],
    ["award", "resolved", "completed", true],
  ] as const)("projects %s to contract=%s, project=%s, resolvesDispute=%s", (kind, contractStatus, projectStatus, resolvesDispute) => {
    expect(getFinalizationProjection(kind)).toEqual({ contractStatus, projectStatus, resolvesDispute });
  });

  it("rejects an action kind that has no defined database projection", () => {
    expect(() => getFinalizationProjection("unexpected_action")).toThrow("Unsupported chain action kind: unexpected_action");
  });
});
