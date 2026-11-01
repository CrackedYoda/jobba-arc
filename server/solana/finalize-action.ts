import "server-only";

import { decodeEscrow } from "@/server/solana/accounts";
import { solanaConnection } from "@/server/solana/build-action";
import { SolanaBoundaryError, solanaDatabase } from "@/server/solana/context";
import { getFinalizationProjection } from "@/server/solana/finalization-projection";

const chainState: Partial<Record<string, string>> = {
  fund: "funded",
  accept: "active",
  submit: "submitted",
  open_dispute: "disputed",
};

const terminal = new Set(["release", "cancel", "refund", "award"]);

export async function finalizeChainAction(actionId: string, wallet: string) {
  const db = solanaDatabase();
  const result = await db.query(
    `select a.id,a.kind,a.status,a.contract_id,a.escrow_pda,a.program_id,
            s.id as signature_id,s.signature
       from chain_actions a
       join profiles p on p.id=a.actor_id
       join lateral (
         select id,signature from chain_signatures where chain_action_id=a.id
         order by submitted_at desc limit 1
       ) s on true
      where a.id=$1 and p.wallet_public_key=$2`,
    [actionId, wallet],
  );
  const action = result.rows[0];
  if (!action) throw new SolanaBoundaryError("CHAIN_ACTION_NOT_FOUND", "Chain action was not found.", 404);
  if (action.status === "finalized") return { actionId, status: "finalized" as const };
  const projection = getFinalizationProjection(action.kind);

  const rpc = solanaConnection();
  const signatureStatus = (await rpc.getSignatureStatuses([action.signature], { searchTransactionHistory: true })).value[0];
  if (!signatureStatus || signatureStatus.err || signatureStatus.confirmationStatus !== "finalized") {
    throw new SolanaBoundaryError("TRANSACTION_NOT_FINALIZED", "The transaction has not reached finalized commitment.", 409);
  }

  const escrowInfo = await rpc.getAccountInfo(new (await import("@solana/web3.js")).PublicKey(action.escrow_pda), "finalized");
  if (terminal.has(action.kind)) {
    if (escrowInfo) throw new SolanaBoundaryError("ESCROW_NOT_CLOSED", "A terminal escrow account is still open.", 409);
  } else {
    if (!escrowInfo || escrowInfo.owner.toBase58() !== action.program_id) {
      throw new SolanaBoundaryError("ESCROW_FINAL_STATE_MISSING", "The finalized escrow account is missing or invalid.", 409);
    }
    const state = decodeEscrow(escrowInfo.data).state;
    if (state !== chainState[action.kind]) {
      throw new SolanaBoundaryError("ESCROW_FINAL_STATE_MISMATCH", `Expected ${chainState[action.kind]} escrow state, received ${state}.`, 409);
    }
  }

  const client = await db.connect();
  try {
    await client.query("begin");
    const locked = await client.query("select status,project_id,proposal_id from contracts where id=$1 for update", [action.contract_id]);
    if (!locked.rows[0]) throw new SolanaBoundaryError("CONTRACT_NOT_FOUND", "Contract was not found.", 404);
    const next = projection.contractStatus;
    await client.query(
      `update contracts set status=$2, escrow_pda=coalesce(escrow_pda,$3), version=version+1,
        funded_at=case when $2='funded' then now() else funded_at end,
        accepted_at=case when $2='active' then now() else accepted_at end,
        submitted_at=case when $2='submitted' then now() else submitted_at end,
        completed_at=case when $2 in ('released','cancelled','resolved') then now() else completed_at end
       where id=$1`,
      [action.contract_id, next, action.escrow_pda],
    );
    if (action.kind === "fund") {
      await client.query("update proposals set status=case when id=$1 then 'accepted'::proposal_status else 'rejected'::proposal_status end, version=version+1 where project_id=$2 and status='pending'", [locked.rows[0].proposal_id, locked.rows[0].project_id]);
      await client.query("update projects set status='contracted', version=version+1 where id=$1", [locked.rows[0].project_id]);
      const conversation = await client.query("insert into conversations (contract_id) values ($1) on conflict (contract_id) do update set contract_id=excluded.contract_id returning id", [action.contract_id]);
      await client.query("insert into conversation_participants (conversation_id,profile_id) select $1,unnest(array[client_id,freelancer_id]) from contracts where id=$2 on conflict do nothing", [conversation.rows[0].id, action.contract_id]);
    } else if (projection.projectStatus) {
      await client.query("update projects set status=$2, version=version+1 where id=$1", [locked.rows[0].project_id, projection.projectStatus]);
    }
    if (projection.resolvesDispute) {
      await client.query("update disputes set status='resolved',resolved_at=now(),version=version+1 where contract_id=$1 and status='awaiting_chain'", [action.contract_id]);
    }
    await client.query("update chain_signatures set commitment='finalized',finalized_at=now(),slot=$2 where id=$1", [action.signature_id, signatureStatus.slot]);
    await client.query("update chain_actions set status='finalized',version=version+1 where id=$1", [action.id]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return { actionId, status: "finalized" as const, contractStatus: projection.contractStatus, slot: signatureStatus.slot.toString() };
}
