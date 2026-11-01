import "server-only";

import type { CreateProposalInput, ListProposalsInput } from "@/features/proposals/schemas";
import type { Database } from "@/server/db/client";
import type { Cursor } from "@/server/db/cursor";

const select = `
  select pr.id, pr.project_id, pr.freelancer_id, pr.cover_letter, pr.amount_atomic, pr.estimated_days, pr.status,
         pr.version, pr.portfolio_url, pr.created_at, pr.updated_at,
         json_build_object('id', f.id, 'display_name', f.display_name, 'avatar_url', f.avatar_url, 'availability', f.availability) as freelancer
    from proposals pr join profiles f on f.id = pr.freelancer_id`;

export async function insertProposal(db: Database, projectId: string, freelancerId: string, input: CreateProposalInput) {
  // A withdrawn proposal may be re-submitted; any other existing proposal is a conflict.
  const { rows } = await db.query<{ id: string }>(
    `insert into proposals (project_id, freelancer_id, cover_letter, amount_atomic, estimated_days, portfolio_url)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (project_id, freelancer_id) do update
       set cover_letter = excluded.cover_letter, amount_atomic = excluded.amount_atomic, estimated_days = excluded.estimated_days,
           portfolio_url = excluded.portfolio_url, status = 'pending', version = proposals.version + 1
       where proposals.status = 'withdrawn'
     returning id`,
    [projectId, freelancerId, input.coverLetter, input.amountAtomic, input.estimatedDays, input.portfolioUrl ?? null],
  );
  if (!rows[0]) throw Object.assign(new Error("duplicate proposal"), { code: "23505" });
  return getProposalById(db, rows[0].id);
}

export async function listProjectProposals(db: Database, projectId: string, input: ListProposalsInput, cursor?: Cursor) {
  const params: unknown[] = [projectId];
  let cursorClause = "";
  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    cursorClause = "and (pr.created_at, pr.id) < ($2::timestamptz, $3::uuid)";
  }
  params.push(input.limit + 1);
  const { rows } = await db.query(
    `${select} where pr.project_id = $1 ${cursorClause} order by pr.created_at desc, pr.id desc limit $${params.length}`,
    params,
  );
  return rows;
}

export async function getProposalById(db: Database, proposalId: string) {
  const { rows } = await db.query(`${select} where pr.id = $1`, [proposalId]);
  return rows[0] ?? null;
}

export async function withdrawPendingProposal(db: Database, proposalId: string, freelancerId: string, expectedVersion = 1) {
  const { rowCount } = await db.query(
    `update proposals set status = 'withdrawn', version = version + 1
      where id = $1 and freelancer_id = $2 and status = 'pending' and version = $3`,
    [proposalId, freelancerId, expectedVersion],
  );
  return rowCount ? getProposalById(db, proposalId) : null;
}
