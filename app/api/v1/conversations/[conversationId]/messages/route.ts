import { NextResponse } from "next/server";

import { conversationIdSchema, listMessagesSchema, sendMessageSchema } from "@/features/chat/schemas";
import { success } from "@/lib/api/envelope";
import { assertSameOrigin } from "@/server/auth/http";
import { errorResponse } from "@/server/db/errors";
import { requireActor } from "@/server/services/auth-context";
import { listMessages, sendMessage } from "@/server/services/chat";

type Context = { params: Promise<{ conversationId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { conversationId } = await context.params;
    const url = new URL(request.url);
    const input = listMessagesSchema.parse(Object.fromEntries(url.searchParams));
    return NextResponse.json(success(await listMessages(await requireActor(), conversationIdSchema.parse(conversationId), input)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  try {
    const { conversationId } = await context.params;
    const input = sendMessageSchema.parse(await request.json());
    return NextResponse.json(success(await sendMessage(await requireActor(), conversationIdSchema.parse(conversationId), input)), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
