import "server-only";

import { PublicKey } from "@solana/web3.js";
import { accountDiscriminator } from "@/lib/solana/program";

function key(data: Buffer, offset: number): string {
  return new PublicKey(data.subarray(offset, offset + 32)).toBase58();
}

function assertAccount(data: Buffer, minimum: number, name: string): void {
  if (data.length < minimum || !data.subarray(0, 8).equals(accountDiscriminator(name))) {
    throw new Error(`Invalid Anchor ${name} account.`);
  }
}

export function decodeConfig(data: Buffer) {
  assertAccount(data, 173, "Config");
  return { version: data[8], admin: key(data, 9), acceptedMint: key(data, 73), tokenProgram: key(data, 105), treasury: key(data, 137), feeBps: data.readUInt16LE(169), paused: data[171] !== 0 };
}

const escrowStates = ["funded", "active", "submitted", "released", "cancelled", "disputed", "refunded", "awarded"] as const;

export function decodeEscrow(data: Buffer) {
  assertAccount(data, 218, "Escrow");
  const state = escrowStates[data[217]];
  if (!state) throw new Error("Escrow contains an unknown state.");
  return { version: data[8], config: key(data, 9), contractHash: data.subarray(41, 73), termsHash: data.subarray(73, 105), client: key(data, 105), freelancer: key(data, 137), mint: key(data, 169), grossAmount: data.readBigUInt64LE(201), feeAmount: data.readBigUInt64LE(209), state };
}

export function parseBytea32(value: unknown, label: string): Buffer {
  let hex: string;
  if (typeof value === "string") hex = value.startsWith("\\x") ? value.slice(2) : value;
  else if (Array.isArray(value)) hex = Buffer.from(value).toString("hex");
  else if (value && typeof value === "object" && "data" in value && Array.isArray((value as { data: unknown }).data)) hex = Buffer.from((value as { data: number[] }).data).toString("hex");
  else throw new Error(`${label} is not a supported bytea value.`);
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error(`${label} must contain exactly 32 bytes.`);
  return Buffer.from(hex, "hex");
}
