import { NextResponse } from "next/server";

import { conversationIdSchema, markReadSchema } from "@/features/chat/schemas";
import { success } from "@/lib/api/envelope";
import { assertSameOrigin } from "@/server/auth/http";
import { errorResponse } from "@/server/db/errors";
import { requireActor } from "@/server/services/auth-context";
import { markConversationRead } from "@/server/services/chat";

type Context = { params: Promise<{ conversationId: string }> };

export async function POST(request: Request, context: Context) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  try {
    const { conversationId } = await context.params;
    const input = markReadSchema.parse(await request.json());
    return NextResponse.json(success(await markConversationRead(await requireActor(), conversationIdSchema.parse(conversationId), input)));
  } catch (error) {
    return errorResponse(error);
  }
}
