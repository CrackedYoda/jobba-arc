import { describe, expect, it } from "vitest";

import { createProjectSchema, listProjectsSchema } from "@/features/projects/schemas";
import { createProposalSchema } from "@/features/proposals/schemas";

describe("marketplace request schemas", () => {
  it("keeps atomic amounts as bigint-safe strings", () => {
    const parsed = createProjectSchema.parse({ title: "Build a Solana dashboard", description: "Create a responsive dashboard for escrow activity.", budgetAtomic: "9007199254740993", category: "Development", skillIds: [] });
    expect(parsed.budgetAtomic).toBe("9007199254740993");
  });

  it("rejects decimal and overflowing atomic amounts", () => {
    expect(() => createProposalSchema.parse({ coverLetter: "I can deliver this project quickly.", amountAtomic: "1.5", estimatedDays: 3 })).toThrow();
    expect(() => createProposalSchema.parse({ coverLetter: "I can deliver this project quickly.", amountAtomic: "9223372036854775808", estimatedDays: 3 })).toThrow();
  });

  it("caps page size and validates budget ranges", () => {
    expect(() => listProjectsSchema.parse({ limit: "51" })).toThrow();
    expect(() => listProjectsSchema.parse({ minBudgetAtomic: "20", maxBudgetAtomic: "10" })).toThrow();
  });

  it("deduplicates project skill identifiers", () => {
    const skill = "10000000-0000-4000-8000-000000000001";
    const parsed = createProjectSchema.parse({ title: "Build a Solana dashboard", description: "Create a responsive dashboard for escrow activity.", budgetAtomic: "1000000", category: "Development", skillIds: [skill, skill] });
    expect(parsed.skillIds).toEqual([skill]);
  });
});
