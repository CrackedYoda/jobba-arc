import "server-only";

import type { z } from "zod";

import type { listMessagesSchema, markReadSchema, sendMessageSchema } from "@/features/chat/schemas";
import { getDatabase } from "@/server/db/client";
import { AppError } from "@/server/db/errors";
import type { Actor } from "@/server/repositories/profiles";

async function requireParticipant(conversationId: string, profileId: string): Promise<void> {
  const { rowCount } = await getDatabase().query(
    "select 1 from conversation_participants where conversation_id = $1 and profile_id = $2",
    [conversationId, profileId],
  );
  if (!rowCount) throw new AppError("CONVERSATION_NOT_FOUND", "Conversation not found.", 404);
}

export async function listConversations(actor: Actor) {
  const { rows } = await getDatabase().query(
    `select c.id, c.contract_id, c.created_at,
            ct.status as contract_status, p.title as project_title,
            (select row_to_json(last_message) from (
              select m.id, m.sender_id, m.body, m.created_at from messages m
              where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1
            ) last_message) as last_message
       from conversations c
       join conversation_participants cp on cp.conversation_id = c.id
       join contracts ct on ct.id = c.contract_id
       join projects p on p.id = ct.project_id
      where cp.profile_id = $1
      order by coalesce((select max(m.created_at) from messages m where m.conversation_id = c.id), c.created_at) desc`,
    [actor.profileId],
  );
  return rows;
}

export async function listMessages(
  actor: Actor,
  conversationId: string,
  input: z.infer<typeof listMessagesSchema>,
) {
  await requireParticipant(conversationId, actor.profileId);
  const values: unknown[] = [conversationId, input.limit + 1, actor.profileId];
  const before = input.before ? "and m.created_at < $4" : "";
  if (input.before) values.push(input.before);
  const { rows } = await getDatabase().query(
    `select m.id, m.sender_id, p.display_name as sender_name, m.client_message_id, m.body, m.created_at,
            (m.sender_id = $3) as is_own
       from messages m join profiles p on p.id = m.sender_id
      where m.conversation_id = $1 ${before}
      order by m.created_at desc, m.id desc limit $2`,
    values,
  );
  const hasMore = rows.length > input.limit;
  const page = rows.slice(0, input.limit);
  const nextBefore = hasMore ? page.at(-1)?.created_at ?? null : null;
  return { items: page.reverse(), nextBefore };
}

export async function sendMessage(
  actor: Actor,
  conversationId: string,
  input: z.infer<typeof sendMessageSchema>,
) {
  await requireParticipant(conversationId, actor.profileId);
  const { rows } = await getDatabase().query(
    `insert into messages (conversation_id, sender_id, client_message_id, body)
     values ($1,$2,$3,$4)
     on conflict (sender_id, client_message_id) do update set body = messages.body
     returning id, conversation_id, sender_id, client_message_id, body, created_at`,
    [conversationId, actor.profileId, input.clientMessageId, input.body],
  );
  return rows[0];
}

export async function markConversationRead(
  actor: Actor,
  conversationId: string,
  input: z.infer<typeof markReadSchema>,
) {
  await requireParticipant(conversationId, actor.profileId);
  const message = await getDatabase().query(
    "select 1 from messages where id = $1 and conversation_id = $2",
    [input.messageId, conversationId],
  );
  if (!message.rowCount) throw new AppError("MESSAGE_NOT_FOUND", "Message not found.", 404);
  await getDatabase().query(
    `insert into conversation_read_cursors (conversation_id, profile_id, last_read_message_id, last_read_at)
     values ($1,$2,$3,now())
     on conflict (conversation_id, profile_id) do update
       set last_read_message_id = excluded.last_read_message_id, last_read_at = excluded.last_read_at`,
    [conversationId, actor.profileId, input.messageId],
  );
  return { read: true };
}
