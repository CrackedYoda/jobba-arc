import bs58 from "bs58";
import { z } from "zod";

export const walletAddressSchema = z.string().refine((address) => {
  try {
    return bs58.decode(address).length === 32;
  } catch {
    return false;
  }
}, "Invalid Solana wallet address");

export const challengeRequestSchema = z.object({ address: walletAddressSchema }).strict();

export const challengeResponseSchema = z.object({
  nonce: z.string().min(16),
  message: z.string().min(1),
  expiresAt: z.string().datetime(),
});

export const verifyRequestSchema = z.object({
  address: walletAddressSchema,
  nonce: z.string().min(16).max(128),
  signature: z.string().min(1).max(256),
}).strict();

export const sessionResponseSchema = z.object({
  authenticated: z.boolean(),
  walletAddress: walletAddressSchema.optional(),
  expiresAt: z.string().datetime().optional(),
});

export type ChallengeResponse = z.infer<typeof challengeResponseSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
