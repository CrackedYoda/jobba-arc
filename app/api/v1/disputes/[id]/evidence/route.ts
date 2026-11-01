import { addEvidenceSchema, disputeIdSchema } from "@/features/disputes/schemas";
import { requireActor } from "@/server/services/auth-context";
import { addDisputeEvidence } from "@/server/services/disputes";
import { handleRoute, mutationGuard, ok, parseJson } from "@/server/services/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const originError = mutationGuard(request);
    if (originError) return originError;
    const actor = await requireActor();
    const disputeId = disputeIdSchema.parse((await context.params).id);
    return ok(await addDisputeEvidence(actor, disputeId, await parseJson(request, addEvidenceSchema)), 201);
  });
}
