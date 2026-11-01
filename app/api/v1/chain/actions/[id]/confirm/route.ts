import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/server/auth/http";
import { authenticatedWallet, SolanaBoundaryError } from "@/server/solana/context";
import { verifyAndRecordSignature } from "@/server/solana/verify-action";

const bodySchema = z.object({ signature: z.string().min(64).max(128) }).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const originFailure = assertSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const actionId = z.string().uuid().parse((await context.params).id);
    const { signature } = bodySchema.parse(await request.json());
    return NextResponse.json({ data: await verifyAndRecordSignature(actionId, signature, await authenticatedWallet()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SolanaBoundaryError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Confirmation request is invalid." } }, { status: 400 });
    console.error("Failed to verify escrow transaction", error);
    return NextResponse.json({ error: { code: "CHAIN_VERIFICATION_FAILED", message: "Transaction could not be independently verified." } }, { status: 503 });
  }
}
