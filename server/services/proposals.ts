import "server-only";

import { randomUUID } from "node:crypto";
import type { CreateProposalInput, ListProposalsInput } from "@/features/proposals/schemas";
import { decodeCursor, encodeCursor } from "@/server/db/cursor";
import { getDatabase } from "@/server/db/client";
import { AppError } from "@/server/db/errors";
import { findContractByProposal, insertFundingPendingContract } from "@/server/repositories/contracts";
import { getProjectById } from "@/server/repositories/projects";
import { getProposalById, insertProposal, listProjectProposals, withdrawPendingProposal } from "@/server/repositories/proposals";
import type { Actor } from "@/server/repositories/profiles";
import { serializeContract, serializeProposal } from "@/server/services/serialize";

export async function createProposal(actor: Actor, projectId: string, input: CreateProposalInput) {
  if (!actor.roles.includes("freelancer")) throw new AppError("FORBIDDEN", "The freelancer role is required.", 403);
  const db = getDatabase();
  const project = await getProjectById(db, projectId);
  if (!project) throw new AppError("PROJECT_NOT_FOUND", "Project not found.", 404);
  if (project.status !== "open") throw new AppError("PROJECT_NOT_OPEN", "This project is not accepting proposals.", 409);
  if (project.client_id === actor.profileId) throw new AppError("OWN_PROJECT", "You cannot propose on your own project.", 403);
  return serializeProposal(await insertProposal(db, projectId, actor.profileId, input) as Record<string, unknown>);
}

export async function readProjectProposals(actor: Actor, projectId: string, input: ListProposalsInput) {
  const db = getDatabase();
  const project = await getProjectById(db, projectId);
  if (!project) throw new AppError("PROJECT_NOT_FOUND", "Project not found.", 404);
  if (project.client_id !== actor.profileId && !actor.roles.includes("admin")) {
    throw new AppError("FORBIDDEN", "Only the project client can review its proposals.", 403);
  }
  const rows = await listProjectProposals(db, projectId, input, decodeCursor(input.cursor));
  const hasMore = rows.length > input.limit;
  const page = rows.slice(0, input.limit);
  const last = page.at(-1) as Record<string, unknown> | undefined;
  return {
    items: page.map((row) => serializeProposal(row as Record<string, unknown>)),
    nextCursor: hasMore && last ? encodeCursor({ createdAt: String(last.created_at), id: String(last.id) }) : null,
  };
}

export async function withdrawProposal(actor: Actor, proposalId: string) {
  if (!actor.roles.includes("freelancer")) throw new AppError("FORBIDDEN", "The freelancer role is required.", 403);
  const db = getDatabase();
  const proposal = await getProposalById(db, proposalId);
  if (!proposal) throw new AppError("PROPOSAL_NOT_FOUND", "Proposal not found.", 404);
  if (proposal.freelancer_id !== actor.profileId) throw new AppError("FORBIDDEN", "You cannot withdraw this proposal.", 403);
  if (proposal.status !== "pending") throw new AppError("INVALID_PROPOSAL_STATE", "Only pending proposals can be withdrawn.", 409);
  const updated = await withdrawPendingProposal(db, proposalId, actor.profileId, Number(proposal.version));
  if (!updated) throw new AppError("PROPOSAL_CONFLICT", "The proposal changed before it could be withdrawn.", 409);
  return serializeProposal(updated as Record<string, unknown>);
}

export async function prepareProposalFunding(actor: Actor, proposalId: string) {
  if (!actor.roles.includes("client")) throw new AppError("FORBIDDEN", "The client role is required.", 403);
  const db = getDatabase();
  const proposal = await getProposalById(db, proposalId);
  if (!proposal) throw new AppError("PROPOSAL_NOT_FOUND", "Proposal not found.", 404);
  const project = await getProjectById(db, proposal.project_id as string);
  if (!project) throw new AppError("PROJECT_NOT_FOUND", "Project not found.", 404);
  if (project.client_id !== actor.profileId) throw new AppError("FORBIDDEN", "Only the project client can select a proposal.", 403);
  if (project.status !== "open") {
    const existing = await findContractByProposal(db, proposalId);
    if (existing) return serializeContract(existing as Record<string, unknown>);
    throw new AppError("PROJECT_NOT_OPEN", "This project is no longer open.", 409);
  }
  if (proposal.status !== "pending") throw new AppError("INVALID_PROPOSAL_STATE", "Only pending proposals can be selected.", 409);
  const existing = await findContractByProposal(db, proposalId);
  if (existing) return serializeContract(existing as Record<string, unknown>);
  try {
    const contract = await insertFundingPendingContract(db, {
      id: randomUUID(),
      projectId: project.id as string,
      proposalId: proposal.id as string,
      clientId: actor.profileId,
      freelancerId: proposal.freelancer_id as string,
      amountAtomic: String(proposal.amount_atomic),
      currencyMint: project.currency_mint as string,
    });
    return serializeContract(contract as Record<string, unknown>);
  } catch (error) {
    if (error instanceof AppError && error.code === "CONFLICT") {
      const raced = await findContractByProposal(db, proposalId);
      if (raced) return serializeContract(raced as Record<string, unknown>);
    }
    throw error;
  }
}
