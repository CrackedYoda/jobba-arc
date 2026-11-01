import { z } from "zod";

export const conversationIdSchema = z.string().uuid();

export const listMessagesSchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const sendMessageSchema = z.object({
  clientMessageId: z.string().uuid(),
  body: z.string().trim().min(1).max(5_000),
}).strict();

export const markReadSchema = z.object({
  messageId: z.string().uuid(),
}).strict();
