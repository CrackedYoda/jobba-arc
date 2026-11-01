import { describe, expect, it } from "vitest";

import { canTransitionContract, formatUsdc, parseUsdc } from "../../lib/domain/marketplace";

describe("USDC atomic-unit conversion", () => {
  it("parses and formats six-decimal values without floating point", () => {
    expect(parseUsdc("2400.125001")).toBe(2_400_125_001n);
    expect(formatUsdc(2_400_125_001n)).toBe("2400.125001");
    expect(formatUsdc(parseUsdc("12.50"))).toBe("12.5");
  });

  it.each(["0", "-1", "1.0000001", "1e3", "", ".5"])("rejects invalid amount %s", (amount) => {
    expect(() => parseUsdc(amount)).toThrow();
  });
});

describe("contract state transitions", () => {
  it("supports the funded-before-acceptance flow", () => {
    expect(canTransitionContract("funding_pending", "funded")).toBe(true);
    expect(canTransitionContract("funded", "active")).toBe(true);
    expect(canTransitionContract("active", "submitted")).toBe(true);
    expect(canTransitionContract("submitted", "released")).toBe(true);
  });

  it("locks ordinary release after a dispute", () => {
    expect(canTransitionContract("funded", "disputed")).toBe(true);
    expect(canTransitionContract("active", "disputed")).toBe(true);
    expect(canTransitionContract("submitted", "disputed")).toBe(true);
    expect(canTransitionContract("disputed", "released")).toBe(false);
    expect(canTransitionContract("disputed", "resolved")).toBe(true);
  });
});
