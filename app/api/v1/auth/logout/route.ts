import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/config/env";
import { assertSameOrigin } from "@/server/auth/http";
import { deleteSession } from "@/server/auth/store";

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const env = getServerEnv();
  const cookieStore = await cookies();
  await deleteSession(cookieStore.get(env.SESSION_COOKIE_NAME)?.value);
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(env.SESSION_COOKIE_NAME, "", { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
