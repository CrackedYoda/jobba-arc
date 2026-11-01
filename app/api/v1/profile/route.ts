import { updateProfileSchema } from "@/features/profiles/schemas";
import { requireActor } from "@/server/services/auth-context";
import { handleRoute, mutationGuard, ok, parseJson } from "@/server/services/http";
import { readOwnProfile, updateOwnProfile } from "@/server/services/profile";

export async function GET() {
  return handleRoute(async () => ok(await readOwnProfile(await requireActor())));
}

export async function PATCH(request: Request) {
  return handleRoute(async () => {
    const originError = mutationGuard(request);
    if (originError) return originError;
    const actor = await requireActor();
    return ok(await updateOwnProfile(actor, await parseJson(request, updateProfileSchema)));
  });
}
