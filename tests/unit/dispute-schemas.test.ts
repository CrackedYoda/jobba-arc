import { describe, expect, it } from "vitest";

import { addEvidenceSchema, createDisputeSchema, prepareResolutionSchema } from "@/features/disputes/schemas";

describe("dispute schemas", () => {
  it("accepts a complete dispute request", () => {
    const result = createDisputeSchema.parse({ contractId: "10000000-0000-4000-8000-000000000001", category: "scope_or_quality", statement: "The delivered work does not match the agreed scope.", evidence: [], idempotencyKey: "dispute-123" });
    expect(result.category).toBe("scope_or_quality");
  });

  it("requires usable evidence URLs", () => {
    expect(() => addEvidenceSchema.parse({ description: "Screenshot", urls: [] })).toThrow();
    expect(() => addEvidenceSchema.parse({ description: "Screenshot", urls: ["javascript:alert(1)"] })).toThrow();
  });

  it("permits only full refund or full award decisions", () => {
    expect(prepareResolutionSchema.parse({ outcome: "refund_client", reason: "The submitted evidence supports a full client refund.", idempotencyKey: "resolve-123" }).outcome).toBe("refund_client");
    expect(() => prepareResolutionSchema.parse({ outcome: "split", reason: "Split this payment between both participants.", idempotencyKey: "resolve-123" })).toThrow();
  });
});
