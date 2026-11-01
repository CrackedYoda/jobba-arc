import "server-only";

import type { AddEvidenceInput, CreateDisputeInput, ListAdminDisputesInput, PrepareResolutionInput } from "@/features/disputes/schemas";
import { decodeCursor, encodeCursor } from "@/server/db/cursor";
import { getDatabase } from "@/server/db/client";
import { AppError } from "@/server/db/errors";
import { auditAdmin, createDisputeRecord, getDispute, getDisputeByContract, insertEvidence, listAdminDisputes, prepareDecision } from "@/server/repositories/disputes";
import type { Actor } from "@/server/repositories/profiles";
import { buildChainAction } from "@/server/solana/build-action";
import { SolanaBoundaryError } from "@/server/solana/context";

type DisputeRow = Record<string, unknown> & { client_id: string; freelancer_id: string; status: string; contract_id: string };

function expose(row: Record<string, unknown>) {
  return {
    ...row,
    contractId: row.contract_id,
    contract_id: undefined,
    openedBy: row.opened_by,
    opened_by: undefined,
    assignedAdminId: row.assigned_admin_id,
    assigned_admin_id: undefined,
    termsHash: row.terms_hash,
    terms_hash: undefined,
    submissionSnapshot: row.submission_snapshot,
    submission_snapshot: undefined,
    escrowPda: row.escrow_pda,
    escrow_pda: undefined,
    amountAtomic: row.amount_atomic === undefined ? undefined : String(row.amount_atomic),
    amount_atomic: undefined,
    createdAt: row.created_at,
    created_at: undefined,
    updatedAt: row.updated_at,
    updated_at: undefined,
    resolvedAt: row.resolved_at,
    resolved_at: undefined,
  };
}

function chainError(error: unknown): never {
  if (error instanceof SolanaBoundaryError) throw new AppError(error.code, error.message, error.status);
  throw error;
}

export async function openDispute(actor: Actor, input: CreateDisputeInput) {
  const db = getDatabase();
  const existing = await getDisputeByContract(db, input.contractId);
  if (existing) {
    const row = existing as DisputeRow;
    if (![row.client_id, row.freelancer_id].includes(actor.profileId)) throw new AppError("FORBIDDEN", "Only contract participants can view this dispute.", 403);
    if (["funded", "active", "submitted"].includes(String(row.contract_status))) {
      try {
        const chain = await buildChainAction(input.contractId, "open_dispute", input.idempotencyKey, actor.walletAddress);
        return { dispute: expose(row), chain };
      } catch (error) { chainError(error); }
    }
    return { dispute: expose(row), chain: null };
  }
  let chain;
  try { chain = await buildChainAction(input.contractId, "open_dispute", input.idempotencyKey, actor.walletAddress); }
  catch (error) { chainError(error); }
  const dispute = await createDisputeRecord(db, actor.profileId, input, chain.action.escrowPda, chain.action.id);
  return { dispute: expose(dispute as DisputeRow), chain };
}

export async function readDispute(actor: Actor, disputeId: string, auditSensitiveRead = false) {
  const db = getDatabase();
  const dispute = await getDispute(db, disputeId) as DisputeRow | null;
  if (!dispute) throw new AppError("DISPUTE_NOT_FOUND", "Dispute not found.", 404);
  const isAdmin = actor.roles.includes("admin");
  if (![dispute.client_id, dispute.freelancer_id].includes(actor.profileId) && !isAdmin) throw new AppError("FORBIDDEN", "You cannot view this dispute.", 403);
  if (auditSensitiveRead && isAdmin) await auditAdmin(db, actor.profileId, "evidence_viewed", disputeId);
  return expose(dispute);
}

export async function addDisputeEvidence(actor: Actor, disputeId: string, input: AddEvidenceInput) {
  const db = getDatabase();
  const dispute = await getDispute(db, disputeId) as DisputeRow | null;
  if (!dispute) throw new AppError("DISPUTE_NOT_FOUND", "Dispute not found.", 404);
  if (![dispute.client_id, dispute.freelancer_id].includes(actor.profileId)) throw new AppError("FORBIDDEN", "Only contract participants can add evidence.", 403);
  if (!["open", "under_review"].includes(dispute.status)) throw new AppError("INVALID_DISPUTE_STATE", "Evidence can no longer be added.", 409);
  return insertEvidence(db, disputeId, actor.profileId, input);
}

export async function browseAdminDisputes(actor: Actor, input: ListAdminDisputesInput) {
  if (!actor.roles.includes("admin")) throw new AppError("FORBIDDEN", "The admin role is required.", 403);
  const db = getDatabase();
  const rows = await listAdminDisputes(db, input, decodeCursor(input.cursor));
  await auditAdmin(db, actor.profileId, "dispute_queue_viewed", null, { status: input.status ?? null });
  const page = rows.slice(0, input.limit) as Record<string, unknown>[];
  const last = page.at(-1);
  return { items: page.map(expose), nextCursor: rows.length > input.limit && last ? encodeCursor({ createdAt: String(last.created_at), id: String(last.id) }) : null };
}

export async function prepareDisputeResolution(actor: Actor, disputeId: string, input: PrepareResolutionInput) {
  if (!actor.roles.includes("admin")) throw new AppError("FORBIDDEN", "The admin role is required.", 403);
  const db = getDatabase();
  const dispute = await getDispute(db, disputeId) as DisputeRow | null;
  if (!dispute) throw new AppError("DISPUTE_NOT_FOUND", "Dispute not found.", 404);
  const action = input.outcome === "refund_client" ? "refund" : "award";
  let chain;
  try { chain = await buildChainAction(dispute.contract_id, action, input.idempotencyKey, actor.walletAddress); }
  catch (error) { chainError(error); }
  const decision = await prepareDecision(db, actor.profileId, disputeId, input, chain.action.id);
  return { decision: { ...decision, amount_atomic: undefined, amountAtomic: String(decision.amount_atomic) }, chain };
}
