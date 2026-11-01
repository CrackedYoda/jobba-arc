import { z } from "zod";

const atomicAmount = z.string().regex(/^[1-9]\d*$/, "Amount must be a positive integer string.").refine((value) => BigInt(value) <= 9_223_372_036_854_775_807n, "Amount exceeds PostgreSQL bigint.");

export const createProposalSchema = z.object({
  coverLetter: z.string().trim().min(20).max(5_000),
  amountAtomic: atomicAmount,
  estimatedDays: z.number().int().min(1).max(3_650),
  portfolioUrl: z.string().url().max(2048).nullish(),
}).strict();

export const listProposalsSchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const proposalIdSchema = z.string().uuid();
export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type ListProposalsInput = z.infer<typeof listProposalsSchema>;
