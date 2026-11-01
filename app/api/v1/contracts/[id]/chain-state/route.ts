import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { getSolanaDeployment } from "@/lib/solana/deployment";
import { configPda, escrowPda, hashContractId } from "@/lib/solana/program";
import { decodeEscrow, parseBytea32 } from "@/server/solana/accounts";
import { solanaConnection } from "@/server/solana/build-action";
import { authenticatedWallet, SolanaBoundaryError, solanaDatabase } from "@/server/solana/context";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().parse((await context.params).id);
    const wallet = await authenticatedWallet();
    const db = solanaDatabase();
    const result = await db.query(`select c.id,c.status,c.amount_atomic,c.terms_hash,c.client_id,c.freelancer_id,
      cp.wallet_public_key as client_wallet,fp.wallet_public_key as freelancer_wallet,
      (select id from conversations where contract_id=c.id) as conversation_id,
      exists(select 1 from profile_roles r join profiles p on p.id=r.profile_id where p.wallet_public_key=$2 and r.role='admin') as is_admin
      from contracts c join profiles cp on cp.id=c.client_id join profiles fp on fp.id=c.freelancer_id where c.id=$1`, [id, wallet]);
    const contract = result.rows[0];
    if (!contract) throw new SolanaBoundaryError("CONTRACT_NOT_FOUND", "Contract was not found.", 404);
    if (wallet !== contract.client_wallet && wallet !== contract.freelancer_wallet && !contract.is_admin) throw new SolanaBoundaryError("ACTION_FORBIDDEN", "Contract access is restricted to participants and admins.", 403);
    const manifest = getSolanaDeployment();
    const program = new PublicKey(manifest.programId);
    const address = escrowPda(program, configPda(program), hashContractId(id));
    const info = await solanaConnection().getAccountInfo(address, "confirmed");
    const decoded = info ? decodeEscrow(info.data) : null;
    if (decoded && (!decoded.termsHash.equals(parseBytea32(contract.terms_hash, "Contract terms hash")) || decoded.grossAmount !== BigInt(contract.amount_atomic))) throw new SolanaBoundaryError("ESCROW_ACCOUNT_MISMATCH", "On-chain escrow differs from the canonical contract.", 409);
    const actions = await db.query(`select a.id,a.kind,a.status,a.cluster,a.escrow_pda,a.amount_atomic,a.expires_at,s.signature
      from chain_actions a left join lateral (select signature from chain_signatures where chain_action_id=a.id order by submitted_at desc limit 1) s on true
      where a.contract_id=$1 order by a.created_at desc limit 20`, [id]);
    const allowedActions: string[] = [];
    const onChainState = decoded?.state;
    if (wallet === contract.client_wallet) {
      if (contract.status === "funding_pending" && !decoded) allowedActions.push("fund");
      if (contract.status === "funded" && onChainState === "funded") allowedActions.push("cancel", "open_dispute");
      if (contract.status === "active" && onChainState === "active") allowedActions.push("open_dispute");
      if (contract.status === "submitted" && onChainState === "submitted") allowedActions.push("release", "open_dispute");
    }
    if (wallet === contract.freelancer_wallet) {
      if (contract.status === "funded" && onChainState === "funded") allowedActions.push("accept", "open_dispute");
      if (contract.status === "active" && onChainState === "active") allowedActions.push("submit", "open_dispute");
      if (contract.status === "submitted" && onChainState === "submitted") allowedActions.push("open_dispute");
    }
    if (contract.is_admin && wallet === manifest.admin && contract.status === "disputed" && onChainState === "disputed") allowedActions.push("refund", "award");
    return NextResponse.json({ data: { contractId: id, contractStatus: contract.status, amountAtomic: String(contract.amount_atomic), cluster: manifest.cluster, conversationId: contract.conversation_id, allowedActions, escrowAddress: address.toBase58(), escrow: decoded ? { ...decoded, contractHash: decoded.contractHash.toString("hex"), termsHash: decoded.termsHash.toString("hex"), grossAmount: decoded.grossAmount.toString(), feeAmount: decoded.feeAmount.toString() } : null, actions: actions.rows } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SolanaBoundaryError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Contract identifier is invalid." } }, { status: 400 });
    console.error("Failed to load chain state", error);
    return NextResponse.json({ error: { code: "CHAIN_CONFIGURATION_INVALID", message: "Chain state is unavailable." } }, { status: 503 });
  }
}
