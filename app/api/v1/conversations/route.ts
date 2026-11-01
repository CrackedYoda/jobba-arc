import { NextResponse } from "next/server";

import { success } from "@/lib/api/envelope";
import { errorResponse } from "@/server/db/errors";
import { requireActor } from "@/server/services/auth-context";
import { listConversations } from "@/server/services/chat";

export async function GET() {
  try {
    return NextResponse.json(success(await listConversations(await requireActor())));
  } catch (error) {
    return errorResponse(error);
  }
}
