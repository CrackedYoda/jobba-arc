export const ESCROW_ACTIONS = [
  "fund",
  "accept",
  "submit",
  "release",
  "cancel",
  "open_dispute",
  "refund",
  "award",
] as const;

export type EscrowAction = (typeof ESCROW_ACTIONS)[number];
export type SolanaCluster = "devnet" | "testnet" | "mainnet-beta" | "localnet";

export type ChainActionStatus =
  | "created"
  | "submitted"
  | "confirmed"
  | "finalized"
  | "expired"
  | "failed";

export type ChainActionSummary = {
  id: string;
  kind: EscrowAction;
  status: ChainActionStatus;
  contractId: string;
  cluster: SolanaCluster;
  programId: string;
  mint: string;
  escrowPda: string;
  amountAtomic: string;
  termsHashHex: string;
  expectedAccounts: Record<string, string>;
  expiresAt: string;
  signature?: string;
  slot?: string;
};

export type UnsignedEscrowTransaction = {
  action: ChainActionSummary;
  transactionBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  feePayer: string;
};

export type EscrowAccountView = {
  address: string;
  state: "funded" | "active" | "submitted" | "released" | "cancelled" | "disputed" | "refunded" | "awarded";
  client: string;
  freelancer: string;
  mint: string;
  grossAmountAtomic: string;
  feeAmountAtomic: string;
  termsHashHex: string;
};
