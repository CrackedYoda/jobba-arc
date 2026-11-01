import { AppError } from "@/server/db/errors";

export type Cursor = { createdAt: string; id: string };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(value: string | undefined): Cursor | undefined {
  if (!value) return;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>;
    if (typeof parsed.createdAt !== "string" || !Number.isFinite(Date.parse(parsed.createdAt))) throw new Error();
    if (typeof parsed.id !== "string" || !/^[0-9a-f-]{36}$/i.test(parsed.id)) throw new Error();
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new AppError("INVALID_CURSOR", "The pagination cursor is invalid.", 400);
  }
}
