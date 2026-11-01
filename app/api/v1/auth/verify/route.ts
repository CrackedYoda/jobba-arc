import bs58 from "bs58";
import { NextResponse } from "next/server";
import nacl from "tweetnacl";

import { verifyRequestSchema } from "@/features/auth/schemas";
import { getServerEnv } from "@/lib/config/env";
import { assertSameOrigin, invalidRequest } from "@/server/auth/http";
import { getRequestIp, takeRateLimit } from "@/server/auth/rate-limit";
import { consumeChallenge, createSession } from "@/server/auth/store";

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const parsed = verifyRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidRequest(parsed.error.issues[0]?.message);
  const rateLimitKey = `verify:${getRequestIp(request)}:${parsed.data.address}`;
  if (!takeRateLimit(rateLimitKey, 10, 60_000)) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many verification attempts." } }, { status: 429 });
  }

  const challenge = await consumeChallenge(parsed.data.nonce, parsed.data.address);
  if (!challenge) {
    return NextResponse.json({ error: { code: "CHALLENGE_INVALID", message: "Challenge is expired, used, or does not match this wallet." } }, { status: 401 });
  }

  let verified = false;
  try {
    verified = nacl.sign.detached.verify(
      new TextEncoder().encode(challenge.message),
      Buffer.from(parsed.data.signature, "base64"),
      bs58.decode(parsed.data.address),
    );
  } catch {
    verified = false;
  }
  if (!verified) {
    return NextResponse.json({ error: { code: "SIGNATURE_INVALID", message: "Wallet signature could not be verified." } }, { status: 401 });
  }

  const env = getServerEnv();
  const { token, session } = await createSession(parsed.data.address, env.SESSION_TTL_SECONDS);
  const response = NextResponse.json({ authenticated: true, walletAddress: session.walletAddress, expiresAt: new Date(session.expiresAt).toISOString() });
  response.cookies.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.SESSION_TTL_SECONDS,
  });
  return response;
}
