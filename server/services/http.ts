import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { success } from "@/lib/api/envelope";
import { assertSameOrigin } from "@/server/auth/http";
import { AppError, errorResponse } from "@/server/db/errors";

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  return schema.parse(await request.json().catch(() => null));
}

export function mutationGuard(request: Request): NextResponse | undefined {
  return assertSameOrigin(request);
}

export function requireIdempotencyKey(request: Request): string {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value || value.length < 8 || value.length > 200) {
    throw new AppError("IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key header is required.", 400);
  }
  return value;
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(success(data), { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleRoute(work: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await work();
  } catch (error) {
    return errorResponse(error);
  }
}
