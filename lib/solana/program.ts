import { createHash } from "node:crypto";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";

import type { EscrowAction } from "@/lib/solana/types";

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

export function instructionDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

export function accountDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
}

export function hashContractId(contractId: string): Buffer {
  return createHash("sha256").update(contractId.toLowerCase(), "utf8").digest();
}

export function configPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0];
}

export function escrowPda(programId: PublicKey, config: PublicKey, contractHash: Buffer): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("escrow"), config.toBuffer(), contractHash], programId)[0];
}

export function associatedTokenAddress(mint: PublicKey, owner: PublicKey, tokenProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgramId.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function u64(value: bigint): Buffer {
  if (value < 0n || value > 18_446_744_073_709_551_615n) throw new Error("Amount does not fit in u64.");
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(value);
  return bytes;
}

export type InstructionAccounts = Record<string, PublicKey>;

const instructionNames: Record<EscrowAction, string> = {
  fund: "create_and_fund_escrow",
  accept: "accept_escrow",
  submit: "submit_work",
  release: "approve_and_release",
  cancel: "cancel_before_acceptance",
  open_dispute: "open_dispute",
  refund: "resolve_dispute",
  award: "resolve_dispute",
};

export function expectedDiscriminator(action: EscrowAction): Buffer {
  return instructionDiscriminator(instructionNames[action]);
}

export function buildEscrowInstruction(
  action: EscrowAction,
  programId: PublicKey,
  accounts: InstructionAccounts,
  contractHash: Buffer,
  termsHash: Buffer,
  amount: bigint,
): TransactionInstruction {
  const meta = (name: string, isSigner = false, isWritable = false) => ({ pubkey: accounts[name], isSigner, isWritable });
  let keys;
  let data = expectedDiscriminator(action);
  switch (action) {
    case "fund":
      keys = [meta("client", true, true), meta("freelancer"), meta("config"), meta("mint"), meta("escrow", false, true), meta("clientToken", false, true), meta("vault", false, true), meta("tokenProgram"), meta("associatedTokenProgram"), meta("systemProgram")];
      data = Buffer.concat([data, contractHash, termsHash, u64(amount)]);
      break;
    case "accept":
    case "submit":
      keys = [meta("freelancer", true), meta("escrow", false, true)];
      break;
    case "open_dispute":
      keys = [meta("participant", true), meta("escrow", false, true)];
      break;
    case "release":
      keys = [meta("client", true, true), meta("freelancer"), meta("treasury"), meta("config"), meta("escrow", false, true), meta("mint"), meta("vault", false, true), meta("freelancerToken", false, true), meta("treasuryToken", false, true), meta("clientToken", false, true), meta("tokenProgram"), meta("associatedTokenProgram"), meta("systemProgram")];
      break;
    case "cancel":
      keys = [meta("client", true, true), meta("config"), meta("escrow", false, true), meta("mint"), meta("vault", false, true), meta("clientToken", false, true), meta("tokenProgram"), meta("associatedTokenProgram"), meta("systemProgram")];
      break;
    case "refund":
    case "award":
      keys = [meta("admin", true, true), meta("client", false, true), meta("freelancer"), meta("treasury"), meta("config"), meta("escrow", false, true), meta("mint"), meta("vault", false, true), meta("clientToken", false, true), meta("freelancerToken", false, true), meta("treasuryToken", false, true), meta("tokenProgram"), meta("associatedTokenProgram"), meta("systemProgram")];
      data = Buffer.concat([data, Buffer.from([action === "refund" ? 0 : 1])]);
      break;
  }
  return new TransactionInstruction({ programId, keys, data });
}
