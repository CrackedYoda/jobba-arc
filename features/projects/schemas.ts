import { z } from "zod";

const uuid = z.string().uuid();
const atomicAmount = z.string().regex(/^[1-9]\d*$/, "Amount must be a positive integer string.").refine((value) => BigInt(value) <= 9_223_372_036_854_775_807n, "Amount exceeds PostgreSQL bigint.");

export const projectStatusSchema = z.enum(["draft", "open", "contracted", "completed", "cancelled", "disputed"]);

export const createProjectSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(10_000),
  category: z.string().trim().min(1).max(80),
  budgetAtomic: atomicAmount,
  deliveryDays: z.number().int().min(1).max(365).default(30),
  skillIds: z.array(uuid).max(20).default([]).transform((ids) => [...new Set(ids)]),
  status: z.enum(["draft", "open"]).default("open"),
}).strict();

export const listProjectsSchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().trim().min(1).max(80).optional(),
  skillId: uuid.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  minBudgetAtomic: atomicAmount.optional(),
  maxBudgetAtomic: atomicAmount.optional(),
}).refine((value) => !value.minBudgetAtomic || !value.maxBudgetAtomic || BigInt(value.minBudgetAtomic) <= BigInt(value.maxBudgetAtomic), {
  message: "Minimum budget must not exceed maximum budget.",
  path: ["minBudgetAtomic"],
});

export const projectIdSchema = uuid;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type ListProjectsInput = z.infer<typeof listProjectsSchema>;
