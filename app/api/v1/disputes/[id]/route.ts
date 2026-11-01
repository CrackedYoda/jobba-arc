import { disputeIdSchema } from "@/features/disputes/schemas";
import { requireActor } from "@/server/services/auth-context";
import { readDispute } from "@/server/services/disputes";
import { handleRoute, ok } from "@/server/services/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const actor = await requireActor();
    return ok(await readDispute(actor, disputeIdSchema.parse((await context.params).id), true));
  });
}
