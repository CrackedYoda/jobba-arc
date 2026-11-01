import "server-only";

import { getDatabase, type Database } from "@/server/db/client";
import { requireActor } from "@/server/services/auth-context";

export class SolanaBoundaryError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
  }
}

export function solanaDatabase(): Database {
  try { return getDatabase(); }
  catch { throw new SolanaBoundaryError("CHAIN_STORAGE_UNAVAILABLE", "Persistent chain-action storage is not configured.", 503); }
}

export async function authenticatedWallet(): Promise<string> {
  return (await requireActor()).walletAddress;
}
