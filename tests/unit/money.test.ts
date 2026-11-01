import { describe, expect, it } from "vitest";

import { fromAtomic, platformFee, toAtomic } from "../../lib/domain/money";

describe("money helpers", () => {
  it("parses USDC strings to atomic units without floating point", () => {
    expect(toAtomic("2400")).toBe(2_400_000_000n);
    expect(toAtomic("2,350.5")).toBe(2_350_500_000n);
    expect(toAtomic("0.000001")).toBe(1n);
    expect(toAtomic("1.0000001")).toBeUndefined();
    expect(toAtomic("abc")).toBeUndefined();
    expect(toAtomic("-5")).toBeUndefined();
  });

  it("formats atomic units with at least two decimals", () => {
    expect(fromAtomic(2_350_000_000n)).toBe("2,350.00");
    expect(fromAtomic(1n)).toBe("0.000001");
    expect(fromAtomic(0n)).toBe("0.00");
  });

  it("floors the platform fee in integer arithmetic", () => {
    expect(platformFee(2_350_000_000n, 250)).toBe(58_750_000n);
    expect(platformFee(1n, 250)).toBe(0n);
    expect(platformFee(9_223_372_036_854_775_807n, 250)).toBe(230_584_300_921_369_395n);
  });
});
