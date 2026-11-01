import "server-only";

import type { CreateProjectInput, ListProjectsInput } from "@/features/projects/schemas";
import { getServerEnv } from "@/lib/config/env";
import { decodeCursor, encodeCursor } from "@/server/db/cursor";
import { getDatabase } from "@/server/db/client";
import { AppError } from "@/server/db/errors";
import { getProjectById, insertProject, listProjects } from "@/server/repositories/projects";
import type { Actor } from "@/server/repositories/profiles";
import { serializeProject } from "@/server/services/serialize";

export async function createProject(actor: Actor, input: CreateProjectInput) {
  if (!actor.roles.includes("client")) throw new AppError("FORBIDDEN", "The client role is required.", 403);
  const mint = getServerEnv().SOLANA_USDC_MINT;
  if (!mint) throw new AppError("SERVER_NOT_CONFIGURED", "The USDC mint is not configured.", 503);
  const project = await insertProject(getDatabase(), actor.profileId, mint, input);
  if (!project) throw new AppError("DATABASE_ERROR", "The project could not be loaded after creation.", 500);
  return serializeProject(project as Record<string, unknown>);
}

export async function browseProjects(input: ListProjectsInput) {
  const rows = await listProjects(getDatabase(), input, decodeCursor(input.cursor));
  const hasMore = rows.length > input.limit;
  const page = rows.slice(0, input.limit);
  const last = page.at(-1) as Record<string, unknown> | undefined;
  return {
    items: page.map((row) => serializeProject(row as Record<string, unknown>)),
    nextCursor: hasMore && last ? encodeCursor({ createdAt: String(last.created_at), id: String(last.id) }) : null,
  };
}

export async function readProject(projectId: string) {
  const project = await getProjectById(getDatabase(), projectId);
  if (!project || project.status === "draft") throw new AppError("PROJECT_NOT_FOUND", "Project not found.", 404);
  return serializeProject(project as Record<string, unknown>);
}
