import { createProjectSchema, listProjectsSchema } from "@/features/projects/schemas";
import { requireActor } from "@/server/services/auth-context";
import { handleRoute, mutationGuard, ok, parseJson } from "@/server/services/http";
import { browseProjects, createProject } from "@/server/services/projects";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const url = new URL(request.url);
    const input = listProjectsSchema.parse(Object.fromEntries(url.searchParams));
    return ok(await browseProjects(input));
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const originError = mutationGuard(request);
    if (originError) return originError;
    const actor = await requireActor("client");
    const input = await parseJson(request, createProjectSchema);
    return ok(await createProject(actor, input), 201);
  });
}
