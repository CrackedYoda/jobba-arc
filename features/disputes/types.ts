import type { UnsignedEscrowTransaction } from "@/lib/solana/types";

export type DisputeStatus = "open" | "under_review" | "awaiting_chain" | "resolved";

export type DisputeEvidence = {
  id: string;
  submittedBy: string;
  description: string;
  urls: string[];
  createdAt: string;
};

export type DisputeDecision = {
  id: string;
  adminId: string;
  outcome: "refund_client" | "award_freelancer";
  reason: string;
  amountAtomic: string;
  chainActionId: string;
  createdAt: string;
};

export type DisputeDetail = {
  id: string;
  contractId: string;
  client_id: string;
  freelancer_id: string;
  category: string;
  statement: string;
  status: DisputeStatus;
  project_title: string;
  contract_status: string;
  amountAtomic: string;
  currency_mint: string;
  termsHash: string;
  escrowPda: string;
  opened_by_profile: { id: string; displayName: string; walletAddress: string };
  assigned_admin: null | { id: string; displayName: string };
  submissionSnapshot: null | Record<string, unknown>;
  evidence: DisputeEvidence[];
  decision: DisputeDecision | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type AdminDisputeSummary = Pick<DisputeDetail, "id" | "contractId" | "category" | "status" | "createdAt"> & {
  project_title: string;
  opened_by_name: string;
  amountAtomic: string;
};

export type ResolutionResponse = { decision: DisputeDecision; chain: UnsignedEscrowTransaction };
