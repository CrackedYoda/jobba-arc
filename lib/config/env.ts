import "server-only";

import { z } from "zod";

const clusterSchema = z.enum(["devnet", "testnet", "mainnet-beta"]);
const publicKeySchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana public key");
const optionalUrl = z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional());
const optionalPublicKey = z.preprocess((value) => value === "" ? undefined : value, publicKeySchema.optional());

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SESSION_COOKIE_NAME: z.string().min(1).max(64).default("jobba_session"),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().max(604_800).default(86_400),
  SIWS_NONCE_TTL_SECONDS: z.coerce.number().int().positive().max(900).default(300),
  SIWS_DOMAIN: z.string().min(1).default("localhost:3000"),
  SIWS_STATEMENT: z.string().min(1).max(200).refine((value) => !value.includes("\n"), "Statement must be one line").default("Sign in to Jobba Freelance."),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SOLANA_CLUSTER: clusterSchema.default("devnet"),
  SOLANA_RPC_URL: optionalUrl,
  SOLANA_PROGRAM_ID: optionalPublicKey,
  SOLANA_USDC_MINT: optionalPublicKey,
  ADMIN_WALLETS: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
  SOLANA_ADMIN_WALLET: optionalPublicKey,
  DATABASE_URL: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedServerEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = serverEnvSchema.parse(process.env);
  }
  return cachedServerEnv;
}

export function getPublicAppUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return z.string().url().parse(value);
}
