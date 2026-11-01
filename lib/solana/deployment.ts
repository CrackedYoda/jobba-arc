import "server-only";

import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

import type { SolanaCluster } from "@/lib/solana/types";

const publicKey = z.string().transform((value, context) => {
  try {
    return new PublicKey(value).toBase58();
  } catch {
    context.addIssue({ code: "custom", message: "Invalid Solana public key" });
    return z.NEVER;
  }
});

const schema = z.object({
  version: z.literal(1),
  deployment: z.string().min(1).max(80),
  cluster: z.enum(["devnet", "testnet", "mainnet-beta", "localnet"]),
  programId: publicKey,
  usdcMint: publicKey,
  tokenProgramId: publicKey,
  admin: publicKey,
  treasury: publicKey,
  feeBps: z.number().int().min(0).max(10_000),
});

export type SolanaDeployment = Omit<z.infer<typeof schema>, "cluster"> & { cluster: SolanaCluster };

let cached: SolanaDeployment | undefined;

export function getSolanaDeployment(): SolanaDeployment {
  if (cached) return cached;
  const raw = process.env.SOLANA_DEPLOYMENT_MANIFEST_JSON;
  if (!raw) throw new Error("SOLANA_DEPLOYMENT_MANIFEST_JSON is required; refusing to construct a transaction.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("SOLANA_DEPLOYMENT_MANIFEST_JSON is not valid JSON.");
  }
  const deployment = schema.parse(parsed) as SolanaDeployment;
  const configuredCluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
  if (deployment.cluster !== configuredCluster) throw new Error("Deployment manifest cluster does not match NEXT_PUBLIC_SOLANA_CLUSTER.");
  cached = deployment;
  return deployment;
}
