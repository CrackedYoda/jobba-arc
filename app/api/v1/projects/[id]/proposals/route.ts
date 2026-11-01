import { projectIdSchema } from "@/features/projects/schemas";
import { createProposalSchema, listProposalsSchema } from "@/features/proposals/schemas";
import { requireActor } from "@/server/services/auth-context";
import { handleRoute, mutationGuard, ok, parseJson } from "@/server/services/http";
import { createProposal, readProjectProposals } from "@/server/services/proposals";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return handleRoute(async () => {
    const actor = await requireActor();
    const projectId = projectIdSchema.parse((await context.params).id);
    const input = listProposalsSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return ok(await readProjectProposals(actor, projectId, input));
  });
}

export async function POST(request: Request, context: Context) {
  return handleRoute(async () => {
    const originError = mutationGuard(request);
    if (originError) return originError;
    const actor = await requireActor("freelancer");
    const projectId = projectIdSchema.parse((await context.params).id);
    const input = await parseJson(request, createProposalSchema);
    return ok(await createProposal(actor, projectId, input), 201);
  });
}
