import { z } from "zod";

const atomicAmount = z.string().regex(/^\d+$/, "Rate must be an atomic-unit integer string.").refine((value) => BigInt(value) <= 9_223_372_036_854_775_807n, "Rate exceeds PostgreSQL bigint.");
const role = z.enum(["client", "freelancer"]);
const safeUrl = z.string().url().max(2048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Portfolio links must use HTTP or HTTPS.");
const portfolioLink = z.object({ title: z.string().trim().min(1).max(120), url: safeUrl }).strict();

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  headline: z.string().trim().min(1).max(120).nullable(),
  location: z.string().trim().min(1).max(120).nullable(),
  bio: z.string().trim().max(2000).nullable(),
  hourlyRateAtomic: atomicAmount.nullable(),
  availability: z.enum(["available", "limited", "unavailable"]),
  roles: z.array(role).min(1).max(2).transform((values) => [...new Set(values)]),
  skillIds: z.array(z.string().uuid()).max(20).transform((values) => [...new Set(values)]),
  portfolio: z.array(portfolioLink).max(12),
}).strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
