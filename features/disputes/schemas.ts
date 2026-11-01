import { z } from "zod";

export const disputeIdSchema = z.string().uuid();
const evidenceUrlSchema = z.string().url().max(2_048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Evidence URLs must use HTTP or HTTPS.");

export const createDisputeSchema = z.object({
  contractId: z.string().uuid(),
  category: z.enum(["scope_or_quality", "missed_deadline", "communication", "fraud_or_abuse", "other"]),
  statement: z.string().trim().min(20).max(10_000),
  evidence: z.array(z.object({
    description: z.string().trim().min(1).max(5_000),
    urls: z.array(evidenceUrlSchema).max(10).default([]),
  }).strict()).max(10).default([]),
  idempotencyKey: z.string().trim().min(8).max(200),
}).strict();

export const addEvidenceSchema = z.object({
  description: z.string().trim().min(1).max(5_000),
  urls: z.array(evidenceUrlSchema).min(1).max(10),
}).strict();

export const listAdminDisputesSchema = z.object({
  status: z.enum(["open", "under_review", "awaiting_chain", "resolved"]).optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const prepareResolutionSchema = z.object({
  outcome: z.enum(["refund_client", "award_freelancer"]),
  reason: z.string().trim().min(20).max(10_000),
  idempotencyKey: z.string().trim().min(8).max(200),
}).strict();

export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export type AddEvidenceInput = z.infer<typeof addEvidenceSchema>;
export type ListAdminDisputesInput = z.infer<typeof listAdminDisputesSchema>;
export type PrepareResolutionInput = z.infer<typeof prepareResolutionSchema>;
