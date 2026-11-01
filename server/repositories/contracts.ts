import "server-only";

import { createHash } from "node:crypto";

import type { Database } from "@/server/db/client";

const selection = "id, project_id, proposal_id, client_id, freelancer_id, amount_atomic, fee_atomic, currency_mint, encode(terms_hash, 'hex') as terms_hash, status, version, escrow_pda, created_at, updated_at";

export async function findContractByProposal(db: Database, proposalId: string) {
  const { rows } = await db.query(`select ${selection} from contracts where proposal_id = $1`, [proposalId]);
  return rows[0] ?? null;
}

export function canonicalTermsHash(input: {
  contractId: string;
  projectId: string;
  proposalId: string;
  clientId: string;
  freelancerId: string;
  amountAtomic: string;
  currencyMint: string;
}): Buffer {
  const canonical = JSON.stringify({ amountAtomic: input.amountAtomic, clientId: input.clientId, contractId: input.contractId,
    currencyMint: input.currencyMint, freelancerId: input.freelancerId, projectId: input.projectId,
    proposalId: input.proposalId, version: 1 });
  return createHash("sha256").update(canonical).digest();
}

export async function insertFundingPendingContract(db: Database, input: {
  id: string;
  projectId: string;
  proposalId: string;
  clientId: string;
  freelancerId: string;
  amountAtomic: string;
  currencyMint: string;
}) {
  const { rows } = await db.query(
    `insert into contracts
       (id, project_id, proposal_id, client_id, freelancer_id, amount_atomic, currency_mint, terms_hash, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'funding_pending') returning ${selection}`,
    [input.id, input.projectId, input.proposalId, input.clientId, input.freelancerId,
      input.amountAtomic, input.currencyMint, canonicalTermsHash({ ...input, contractId: input.id })],
  );
  return rows[0];
}
