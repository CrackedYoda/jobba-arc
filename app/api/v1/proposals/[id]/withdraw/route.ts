import { proposalIdSchema } from "@/features/proposals/schemas";
import { requireActor } from "@/server/services/auth-context";
import { handleRoute, mutationGuard, ok } from "@/server/services/http";
import { withdrawProposal } from "@/server/services/proposals";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return handleRoute(async () => {
    const originError = mutationGuard(request);
    if (originError) return originError;
    const actor = await requireActor("freelancer");
    const proposalId = proposalIdSchema.parse((await context.params).id);
    return ok(await withdrawProposal(actor, proposalId));
  });
}
