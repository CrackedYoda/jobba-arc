import { describe, expect, it } from "vitest";

import { updateProfileSchema } from "@/features/profiles/schemas";

const valid = {
  displayName: "Amara Okafor",
  headline: "Product designer",
  location: "Lagos, Nigeria",
  bio: "I design clear tools for complex financial workflows.",
  hourlyRateAtomic: "65000000",
  availability: "available",
  roles: ["freelancer"],
  skillIds: ["10000000-0000-4000-8000-000000000005"],
  portfolio: [{ title: "Payments case study", url: "https://example.com/work" }],
};

describe("profile update schema", () => {
  it("accepts roles, bigint-safe rates, skills and portfolio links", () => {
    expect(updateProfileSchema.parse(valid)).toMatchObject({ roles: ["freelancer"], hourlyRateAtomic: "65000000" });
  });

  it("rejects admin role assignment and unsafe URLs", () => {
    expect(() => updateProfileSchema.parse({ ...valid, roles: ["admin"] })).toThrow();
    expect(() => updateProfileSchema.parse({ ...valid, portfolio: [{ title: "bad", url: "javascript:alert(1)" }] })).toThrow();
  });

  it("requires at least one marketplace role", () => {
    expect(() => updateProfileSchema.parse({ ...valid, roles: [] })).toThrow();
  });
});
