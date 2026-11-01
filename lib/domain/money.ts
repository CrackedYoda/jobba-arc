export function toAtomic(value: string): bigint | undefined {
  const input = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,6})?$/.test(input)) return undefined;
  const [whole, fraction = ""] = input.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

export function fromAtomic(value: bigint, minFraction = 2): string {
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "").padEnd(minFraction, "0");
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}

export function platformFee(amount: bigint, feeBps: number): bigint {
  return (amount * BigInt(feeBps)) / 10_000n;
}

function readPlatformFeeBps(value = process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS): number {
  const feeBps = Number(value ?? 250);
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    throw new Error("NEXT_PUBLIC_PLATFORM_FEE_BPS must be an integer from 0 to 10000.");
  }
  return feeBps;
}

export const PLATFORM_FEE_BPS = readPlatformFeeBps();
