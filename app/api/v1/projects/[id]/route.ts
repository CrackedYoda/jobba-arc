import { projectIdSchema } from "@/features/projects/schemas";
import { handleRoute, ok } from "@/server/services/http";
import { readProject } from "@/server/services/projects";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  return handleRoute(async () => {
    const projectId = projectIdSchema.parse((await context.params).id);
    return ok(await readProject(projectId));
  });
}
