import { disputeIdSchema, prepareResolutionSchema } from "@/features/disputes/schemas";
import { requireActor } from "@/server/services/auth-context";
import { prepareDisputeResolution } from "@/server/services/disputes";
import { handleRoute, mutationGuard, ok, parseJson } from "@/server/services/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const originError = mutationGuard(request);
    if (originError) return originError;
    const actor = await requireActor("admin");
    const disputeId = disputeIdSchema.parse((await context.params).id);
    return ok(await prepareDisputeResolution(actor, disputeId, await parseJson(request, prepareResolutionSchema)), 201);
  });
}
