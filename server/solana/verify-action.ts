import "server-only";

import bs58 from "bs58";
import { PublicKey, type PartiallyDecodedInstruction } from "@solana/web3.js";

import { expectedDiscriminator, hashContractId } from "@/lib/solana/program";
import type { EscrowAction } from "@/lib/solana/types";
import { parseBytea32 } from "@/server/solana/accounts";
import { solanaConnection } from "@/server/solana/build-action";
import { SolanaBoundaryError, solanaDatabase } from "@/server/solana/context";

const accountOrder: Record<EscrowAction, readonly string[]> = {
  fund: ["client", "freelancer", "config", "mint", "escrow", "clientToken", "vault", "tokenProgram", "associatedTokenProgram", "systemProgram"],
  accept: ["freelancer", "escrow"], submit: ["freelancer", "escrow"], open_dispute: ["participant", "escrow"],
  release: ["client", "freelancer", "treasury", "config", "escrow", "mint", "vault", "freelancerToken", "treasuryToken", "clientToken", "tokenProgram", "associatedTokenProgram", "systemProgram"],
  cancel: ["client", "config", "escrow", "mint", "vault", "clientToken", "tokenProgram", "associatedTokenProgram", "systemProgram"],
  refund: ["admin", "client", "freelancer", "treasury", "config", "escrow", "mint", "vault", "clientToken", "freelancerToken", "treasuryToken", "tokenProgram", "associatedTokenProgram", "systemProgram"],
  award: ["admin", "client", "freelancer", "treasury", "config", "escrow", "mint", "vault", "clientToken", "freelancerToken", "treasuryToken", "tokenProgram", "associatedTokenProgram", "systemProgram"],
};

function expectedData(action: EscrowAction, contractId: string, termsHash: Buffer, amount: bigint): Buffer {
  const discriminator = expectedDiscriminator(action);
  if (action === "fund") {
    const number = Buffer.alloc(8); number.writeBigUInt64LE(amount);
    return Buffer.concat([discriminator, hashContractId(contractId), termsHash, number]);
  }
  if (action === "refund" || action === "award") return Buffer.concat([discriminator, Buffer.from([action === "refund" ? 0 : 1])]);
  return discriminator;
}

export async function verifyAndRecordSignature(actionId: string, signature: string, wallet: string) {
  let signatureBytes: Uint8Array;
  try { signatureBytes = bs58.decode(signature); } catch { throw new SolanaBoundaryError("INVALID_SIGNATURE", "Signature is not valid base58."); }
  if (signatureBytes.length !== 64) throw new SolanaBoundaryError("INVALID_SIGNATURE", "Signature must contain 64 bytes.");
  const db = solanaDatabase();
  const actorResult = await db.query<{ id: string }>("select id from profiles where wallet_public_key=$1", [wallet]);
  const actor = actorResult.rows[0];
  if (!actor) throw new SolanaBoundaryError("PROFILE_REQUIRED", "The signed-in wallet has no profile.", 403);
  const actionResult = await db.query("select id,kind,status,contract_id,program_id,amount_atomic,terms_hash,expected_accounts,expires_at from chain_actions where id=$1 and actor_id=$2", [actionId, actor.id]);
  const action = actionResult.rows[0];
  if (!action) throw new SolanaBoundaryError("CHAIN_ACTION_NOT_FOUND", "Chain action was not found.", 404);
  if (new Date(action.expires_at).getTime() <= Date.now()) throw new SolanaBoundaryError("CHAIN_ACTION_EXPIRED", "Chain action expired before confirmation.", 409);
  const kind = action.kind as EscrowAction;
  const rpc = solanaConnection();
  const transaction = await rpc.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (!transaction || transaction.meta?.err) throw new SolanaBoundaryError("TRANSACTION_NOT_CONFIRMED", "Transaction is missing or failed at confirmed commitment.", 409);
  const message = transaction.transaction.message;
  const feePayer = message.accountKeys.find((entry) => entry.signer)?.pubkey.toBase58();
  if (feePayer !== wallet) throw new SolanaBoundaryError("FEE_PAYER_MISMATCH", "Transaction fee payer does not match the authenticated wallet.", 409);
  if (message.instructions.length !== 1) throw new SolanaBoundaryError("UNEXPECTED_INSTRUCTIONS", "Transaction contains instructions outside the authorized escrow action.", 409);
  const instruction = message.instructions.find((entry): entry is PartiallyDecodedInstruction => "programId" in entry && "accounts" in entry && entry.programId.equals(new PublicKey(action.program_id)));
  if (!instruction) throw new SolanaBoundaryError("PROGRAM_INSTRUCTION_MISSING", "Transaction does not invoke the expected escrow program.", 409);
  const expectedAccounts = action.expected_accounts as Record<string, string>;
  const actual = instruction.accounts.map((address) => address.toBase58());
  const expected = accountOrder[kind].map((name) => expectedAccounts[name]);
  if (actual.length !== expected.length || actual.some((address, index) => address !== expected[index])) throw new SolanaBoundaryError("INSTRUCTION_ACCOUNTS_MISMATCH", "Instruction accounts differ from the authorized action.", 409);
  const data = Buffer.from(bs58.decode(instruction.data));
  const termsHash = parseBytea32(action.terms_hash, "Action terms hash");
  if (!data.equals(expectedData(kind, action.contract_id, termsHash, BigInt(action.amount_atomic)))) throw new SolanaBoundaryError("INSTRUCTION_DATA_MISMATCH", "Instruction data differs from the authorized action.", 409);

  const client = await db.connect();
  try {
    await client.query("begin");
    const existing = await client.query("select chain_action_id from chain_signatures where signature=$1", [signature]);
    if (existing.rows[0] && existing.rows[0].chain_action_id !== action.id) throw new SolanaBoundaryError("SIGNATURE_REUSED", "Signature belongs to another chain action.", 409);
    await client.query(`insert into chain_signatures (chain_action_id,signature,slot,block_time,commitment,confirmed_at,raw_transaction)
      values ($1,$2,$3,$4,'confirmed',now(),$5) on conflict (signature) do nothing`,
      [action.id, signature, transaction.slot, transaction.blockTime ? new Date(transaction.blockTime * 1000).toISOString() : null, { feePayer, instructionProgram: action.program_id }]);
    await client.query("update chain_actions set status='confirmed' where id=$1 and status in ('created','submitted','confirmed')", [action.id]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
  return { actionId: action.id, signature, status: "confirmed" as const, slot: transaction.slot.toString() };
}
