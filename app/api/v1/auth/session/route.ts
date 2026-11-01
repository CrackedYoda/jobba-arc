import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/config/env";
import { readSession } from "@/server/auth/store";

export async function GET() {
  const env = getServerEnv();
  const session = await readSession((await cookies()).get(env.SESSION_COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ authenticated: true, walletAddress: session.walletAddress, expiresAt: new Date(session.expiresAt).toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
