export const PROJECT_STATES = ["draft", "open", "contracted", "completed", "cancelled", "disputed"] as const;
export const PROPOSAL_STATES = ["pending", "accepted", "rejected", "withdrawn"] as const;
export const CONTRACT_STATES = [
  "funding_pending",
  "funded",
  "active",
  "submitted",
  "released",
  "cancelled",
  "disputed",
  "resolved",
] as const;

export type ProjectState = (typeof PROJECT_STATES)[number];
export type ProposalState = (typeof PROPOSAL_STATES)[number];
export type ContractState = (typeof CONTRACT_STATES)[number];
export type AtomicUsdc = bigint;

const contractTransitions: Readonly<Record<ContractState, readonly ContractState[]>> = {
  funding_pending: ["funded", "cancelled"],
  funded: ["active", "cancelled", "disputed"],
  active: ["submitted", "disputed"],
  submitted: ["released", "disputed"],
  disputed: ["resolved"],
  released: [],
  cancelled: [],
  resolved: [],
};

export function canTransitionContract(from: ContractState, to: ContractState): boolean {
  return contractTransitions[from].includes(to);
}

export function parseUsdc(value: string): AtomicUsdc {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) {
    throw new Error("USDC amount must be a positive decimal with at most six places.");
  }

  const [whole, fractional = ""] = value.split(".");
  const atomic = BigInt(whole) * 1_000_000n + BigInt(fractional.padEnd(6, "0"));

  if (atomic <= 0n) throw new Error("USDC amount must be greater than zero.");
  return atomic;
}

export function formatUsdc(value: AtomicUsdc): string {
  const whole = value / 1_000_000n;
  const fractional = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole.toString();
}
