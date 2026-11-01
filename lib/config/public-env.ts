import { z } from "zod";

const schema = z.object({
  appUrl: z.string().url(),
  reownProjectId: z.string().min(1).optional(),
  cluster: z.enum(["devnet", "testnet", "mainnet-beta"]),
});

export const publicEnv = schema.parse({
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  reownProjectId: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || undefined,
  cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
});
