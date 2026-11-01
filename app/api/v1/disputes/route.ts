import { createDisputeSchema } from "@/features/disputes/schemas";
import { requireActor } from "@/server/services/auth-context";
import { openDispute } from "@/server/services/disputes";
import { handleRoute, mutationGuard, ok, parseJson } from "@/server/services/http";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const originError = mutationGuard(request);
    if (originError) return originError;
    const actor = await requireActor();
    const input = await parseJson(request, createDisputeSchema);
    return ok(await openDispute(actor, input), 201);
  });
}
