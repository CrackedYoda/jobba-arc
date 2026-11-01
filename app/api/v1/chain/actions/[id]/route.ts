import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedWallet, SolanaBoundaryError, solanaDatabase } from "@/server/solana/context";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actionId = z.string().uuid().parse((await context.params).id);
    const wallet = await authenticatedWallet();
    const db = solanaDatabase();
    const result = await db.query(`select a.id,a.kind,a.status,a.contract_id,a.cluster,a.program_id,a.mint,a.escrow_pda,a.amount_atomic,a.expected_accounts,a.expires_at,a.failure_code,a.failure_detail,
      coalesce(json_agg(json_build_object('signature',s.signature,'slot',s.slot,'commitment',s.commitment,'confirmed_at',s.confirmed_at,'finalized_at',s.finalized_at)) filter (where s.id is not null),'[]') as signatures
      from chain_actions a join profiles p on p.id=a.actor_id left join chain_signatures s on s.chain_action_id=a.id
      where a.id=$1 and p.wallet_public_key=$2 group by a.id`, [actionId, wallet]);
    if (!result.rows[0]) throw new SolanaBoundaryError("CHAIN_ACTION_NOT_FOUND", "Chain action was not found.", 404);
    return NextResponse.json({ data: result.rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SolanaBoundaryError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Chain action identifier is invalid." } }, { status: 400 });
  }
}
