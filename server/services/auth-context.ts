import "server-only";

import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/config/env";
import { readSession } from "@/server/auth/store";
import { getDatabase } from "@/server/db/client";
import { AppError } from "@/server/db/errors";
import { findActorByWallet, type Actor, type AppRole } from "@/server/repositories/profiles";

export async function requireActor(role?: AppRole): Promise<Actor> {
  const env = getServerEnv();
  const token = (await cookies()).get(env.SESSION_COOKIE_NAME)?.value;
  const session = await readSession(token);
  if (!session) throw new AppError("UNAUTHENTICATED", "Sign in with your wallet to continue.", 401);
  const actor = await findActorByWallet(getDatabase(), session.walletAddress);
  if (!actor) throw new AppError("UNAUTHENTICATED", "The signed-in profile no longer exists.", 401);
  if (role && !actor.roles.includes(role)) {
    throw new AppError("FORBIDDEN", `The ${role} role is required.`, 403);
  }
  return actor;
}
