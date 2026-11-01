import { listAdminDisputesSchema } from "@/features/disputes/schemas";
import { requireActor } from "@/server/services/auth-context";
import { browseAdminDisputes } from "@/server/services/disputes";
import { handleRoute, ok } from "@/server/services/http";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const actor = await requireActor("admin");
    const input = listAdminDisputesSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return ok(await browseAdminDisputes(actor, input));
  });
}
