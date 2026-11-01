import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { failure } from "@/lib/api/envelope";

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function databaseError(context: string, error: { code?: string; message: string }): never {
  if (error.code === "23505") throw new AppError("CONFLICT", "That record already exists.", 409);
  if (error.code === "23503") throw new AppError("INVALID_REFERENCE", "A referenced record does not exist.", 400);
  console.error(context, { code: error.code, message: error.message });
  throw new AppError("DATABASE_ERROR", "The database operation failed.", 500);
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(failure(error.code, error.message, error.details), { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(failure("INVALID_REQUEST", "Request validation failed.", error.flatten()), { status: 400 });
  }
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
    try { databaseError("query", { code, message: (error as Error).message }); } catch (mapped) { return errorResponse(mapped); }
  }
  console.error("Unhandled API error", error);
  return NextResponse.json(failure("INTERNAL_ERROR", "An unexpected error occurred."), { status: 500 });
}
