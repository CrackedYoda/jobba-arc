import { NextResponse } from "next/server";
import { z } from "zod";
import { ESCROW_ACTIONS, type EscrowAction } from "@/lib/solana/types";
import { assertSameOrigin } from "@/server/auth/http";
import { buildChainAction } from "@/server/solana/build-action";
import { authenticatedWallet, SolanaBoundaryError } from "@/server/solana/context";

const bodySchema = z.object({ idempotencyKey: z.string().min(8).max(200) }).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  const originFailure = assertSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const { id, action } = await context.params;
    z.string().uuid().parse(id);
    if (!ESCROW_ACTIONS.includes(action as EscrowAction)) return NextResponse.json({ error: { code: "UNKNOWN_CHAIN_ACTION", message: "Unknown escrow action." } }, { status: 404 });
    const body = bodySchema.parse(await request.json());
    const transaction = await buildChainAction(id, action as EscrowAction, body.idempotencyKey, await authenticatedWallet());
    return NextResponse.json({ data: transaction }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SolanaBoundaryError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Transaction request is invalid.", details: z.flattenError(error) } }, { status: 400 });
    console.error("Failed to build escrow transaction", error);
    return NextResponse.json({ error: { code: "CHAIN_CONFIGURATION_INVALID", message: "The Solana deployment is unavailable or invalid." } }, { status: 503 });
  }
}
