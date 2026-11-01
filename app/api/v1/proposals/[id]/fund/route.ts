import { proposalIdSchema } from "@/features/proposals/schemas";
import { requireActor } from "@/server/services/auth-context";
import { handleRoute, mutationGuard, ok, requireIdempotencyKey } from "@/server/services/http";
import { prepareProposalFunding } from "@/server/services/proposals";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return handleRoute(async () => {
    const originError = mutationGuard(request);
    if (originError) return originError;
    requireIdempotencyKey(request);
    const actor = await requireActor("client");
    const proposalId = proposalIdSchema.parse((await context.params).id);
    return ok(await prepareProposalFunding(actor, proposalId));
  });
}
