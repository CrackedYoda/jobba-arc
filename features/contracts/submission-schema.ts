import { z } from "zod";

export const submissionInputSchema = z.object({
  description: z.string().trim().min(1).max(10_000),
  deliverableUrls: z.array(z.string().url().refine((value) => new URL(value).protocol === "https:", "Deliverable links must use HTTPS.")).max(10),
}).strict();
