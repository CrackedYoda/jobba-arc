import { NextResponse } from "next/server";

import { challengeRequestSchema } from "@/features/auth/schemas";
import { getServerEnv } from "@/lib/config/env";
import { assertSameOrigin, invalidRequest } from "@/server/auth/http";
import { buildSignInMessage } from "@/server/auth/message";
import { getRequestIp, takeRateLimit } from "@/server/auth/rate-limit";
import { createNonce, saveChallenge } from "@/server/auth/store";

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const parsed = challengeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidRequest(parsed.error.issues[0]?.message);
  const rateLimitKey = `challenge:${getRequestIp(request)}:${parsed.data.address}`;
  if (!takeRateLimit(rateLimitKey, 10, 60_000)) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many challenge requests." } }, { status: 429 });
  }

  const env = getServerEnv();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.SIWS_NONCE_TTL_SECONDS * 1_000);
  const nonce = createNonce();
  const message = buildSignInMessage({
    domain: env.SIWS_DOMAIN,
    address: parsed.data.address,
    statement: env.SIWS_STATEMENT,
    uri: env.NEXT_PUBLIC_APP_URL,
    chainId: `solana:${env.NEXT_PUBLIC_SOLANA_CLUSTER}`,
    nonce,
    issuedAt: now.toISOString(),
    expirationTime: expiresAt.toISOString(),
  });

  await saveChallenge(nonce, { address: parsed.data.address, message, expiresAt: expiresAt.getTime() });
  return NextResponse.json({ nonce, message, expiresAt: expiresAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
