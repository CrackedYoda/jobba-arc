import "server-only";

import { PublicKey } from "@solana/web3.js";
import { decodeEscrow } from "@/server/solana/accounts";
import { solanaConnection } from "@/server/solana/build-action";
import { SolanaBoundaryError } from "@/server/solana/context";

/**
 * Finalization worker primitive. Database projections must only be advanced
 * after this check and a finalized signature check. Terminal actions expect
 * the account to be closed; their event/transaction evidence is authoritative.
 */
export async function readFinalizedEscrow(escrowAddress: string, programId: string) {
  const info = await solanaConnection().getAccountInfo(new PublicKey(escrowAddress), "finalized");
  if (!info) return { closed: true as const };
  if (!info.owner.equals(new PublicKey(programId))) throw new SolanaBoundaryError("ESCROW_OWNER_MISMATCH", "Finalized escrow has the wrong owner.", 409);
  return { closed: false as const, escrow: decodeEscrow(info.data) };
}
