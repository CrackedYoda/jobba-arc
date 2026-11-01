import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/config/env";

export function assertSameOrigin(request: Request): NextResponse | undefined {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const expected = new URL(getServerEnv().NEXT_PUBLIC_APP_URL).origin;
  if (origin !== expected) {
    return NextResponse.json({ error: { code: "ORIGIN_MISMATCH", message: "Request origin is not allowed." } }, { status: 403 });
  }
}

export function invalidRequest(message = "Invalid request."): NextResponse {
  return NextResponse.json({ error: { code: "INVALID_REQUEST", message } }, { status: 400 });
}
