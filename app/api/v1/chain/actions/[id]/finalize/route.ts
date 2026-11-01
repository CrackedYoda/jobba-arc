import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/server/auth/http";
import { authenticatedWallet, SolanaBoundaryError } from "@/server/solana/context";
import { finalizeChainAction } from "@/server/solana/finalize-action";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const originFailure = assertSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const actionId = z.string().uuid().parse((await context.params).id);
    return NextResponse.json({ data: await finalizeChainAction(actionId, await authenticatedWallet()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SolanaBoundaryError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Chain action identifier is invalid." } }, { status: 400 });
    console.error("Failed to finalize escrow action", error);
    return NextResponse.json({ error: { code: "CHAIN_FINALIZATION_FAILED", message: "The finalized transaction could not be reconciled." } }, { status: 503 });
  }
}
