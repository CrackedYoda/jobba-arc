import "server-only";

import { randomUUID } from "node:crypto";

import type { AddEvidenceInput, CreateDisputeInput, ListAdminDisputesInput, PrepareResolutionInput } from "@/features/disputes/schemas";
import type { Database } from "@/server/db/client";
import type { Cursor } from "@/server/db/cursor";
import { AppError } from "@/server/db/errors";

const detailQuery = `
  select d.id,d.contract_id,d.opened_by,d.assigned_admin_id,d.category,d.statement,
         encode(d.terms_hash,'hex') as terms_hash,d.submission_snapshot,d.escrow_pda,d.status,d.version,d.resolved_at,d.created_at,d.updated_at,
         c.client_id,c.freelancer_id,c.amount_atomic,c.currency_mint,c.status as contract_status,
         p.title as project_title,
         json_build_object('id',op.id,'displayName',op.display_name,'walletAddress',op.wallet_public_key) as opened_by_profile,
         case when aa.id is null then null else json_build_object('id',aa.id,'displayName',aa.display_name) end as assigned_admin,
         coalesce((select json_agg(json_build_object('id',e.id,'submittedBy',e.submitted_by,'description',e.description,'urls',e.urls,'createdAt',e.created_at) order by e.created_at,e.id)
                   from dispute_evidence e where e.dispute_id=d.id),'[]') as evidence,
         (select json_build_object('id',dd.id,'adminId',dd.admin_id,'outcome',dd.outcome,'reason',dd.reason,'amountAtomic',dd.amount_atomic::text,'chainActionId',dd.chain_action_id,'createdAt',dd.created_at)
            from dispute_decisions dd where dd.dispute_id=d.id) as decision
    from disputes d join contracts c on c.id=d.contract_id join projects p on p.id=c.project_id
    join profiles op on op.id=d.opened_by left join profiles aa on aa.id=d.assigned_admin_id`;

export async function getDispute(db: Database, disputeId: string) {
  const { rows } = await db.query(`${detailQuery} where d.id=$1`, [disputeId]);
  return rows[0] ?? null;
}

export async function getDisputeByContract(db: Database, contractId: string) {
  const { rows } = await db.query(`${detailQuery} where d.contract_id=$1`, [contractId]);
  return rows[0] ?? null;
}

export async function createDisputeRecord(db: Database, actorId: string, input: CreateDisputeInput, escrowPda: string, chainActionId: string) {
  const client = await db.connect();
  try {
    await client.query("begin");
    const contractResult = await client.query("select id,client_id,freelancer_id,status,terms_hash,escrow_pda from contracts where id=$1 for update", [input.contractId]);
    const contract = contractResult.rows[0];
    if (!contract) throw new AppError("CONTRACT_NOT_FOUND", "Contract not found.", 404);
    if (![contract.client_id, contract.freelancer_id].includes(actorId)) throw new AppError("FORBIDDEN", "Only a contract participant can open a dispute.", 403);
    const existing = await client.query("select id from disputes where contract_id=$1", [input.contractId]);
    if (existing.rows[0]) { await client.query("commit"); return getDispute(db, existing.rows[0].id); }
    if (!["funded", "active", "submitted"].includes(contract.status)) throw new AppError("INVALID_CONTRACT_STATE", "This contract cannot be disputed in its current state.", 409);
    const submission = await client.query("select id,description,deliverable_urls,encode(content_hash,'hex') as content_hash,created_at from submissions where contract_id=$1 and status='submitted' order by created_at desc limit 1", [input.contractId]);
    const disputeId = randomUUID();
    await client.query(
      `insert into disputes (id,contract_id,opened_by,category,statement,terms_hash,submission_snapshot,escrow_pda)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [disputeId, input.contractId, actorId, input.category, input.statement, contract.terms_hash, submission.rows[0] ?? null, escrowPda],
    );
    for (const evidence of input.evidence) {
      await client.query("insert into dispute_evidence (dispute_id,submitted_by,description,urls) values ($1,$2,$3,$4)", [disputeId, actorId, evidence.description, JSON.stringify(evidence.urls)]);
    }
    await client.query("update contracts set escrow_pda=coalesce(escrow_pda,$2) where id=$1", [input.contractId, escrowPda]);
    await client.query("insert into admin_audit_log (admin_id,action,entity_type,entity_id,dispute_id,metadata) select $1,'dispute_opened','dispute',$2,$2,jsonb_build_object('chainActionId',$3) where exists (select 1 from profile_roles where profile_id=$1 and role='admin')", [actorId, disputeId, chainActionId]);
    await client.query("commit");
    return getDispute(db, disputeId);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}

export async function insertEvidence(db: Database, disputeId: string, actorId: string, input: AddEvidenceInput) {
  const { rows } = await db.query(
    `insert into dispute_evidence (dispute_id,submitted_by,description,urls) values ($1,$2,$3,$4)
     returning id,dispute_id,submitted_by,description,urls,created_at`,
    [disputeId, actorId, input.description, JSON.stringify(input.urls)],
  );
  return rows[0];
}

export async function listAdminDisputes(db: Database, input: ListAdminDisputesInput, cursor?: Cursor) {
  const values: unknown[] = [];
  const where: string[] = [];
  const add = (value: unknown) => { values.push(value); return `$${values.length}`; };
  if (input.status) where.push(`d.status=${add(input.status)}`);
  if (cursor) where.push(`(d.created_at,d.id)<(${add(cursor.createdAt)}::timestamptz,${add(cursor.id)}::uuid)`);
  const clause = where.length ? `where ${where.join(" and ")}` : "";
  const { rows } = await db.query(
    `select d.id,d.contract_id,d.category,d.status,d.assigned_admin_id,d.created_at,d.updated_at,
            c.amount_atomic::text,p.title as project_title,op.display_name as opened_by_name
       from disputes d join contracts c on c.id=d.contract_id join projects p on p.id=c.project_id join profiles op on op.id=d.opened_by
       ${clause} order by d.created_at desc,d.id desc limit ${add(input.limit + 1)}`, values,
  );
  return rows;
}

export async function auditAdmin(db: Database, adminId: string, action: string, disputeId: string | null, metadata: Record<string, unknown> = {}) {
  await db.query("insert into admin_audit_log (admin_id,action,entity_type,entity_id,dispute_id,metadata) values ($1,$2,'dispute',$3,$3,$4)", [adminId, action, disputeId, JSON.stringify(metadata)]);
}

export async function prepareDecision(db: Database, adminId: string, disputeId: string, input: PrepareResolutionInput, chainActionId: string) {
  const client = await db.connect();
  try {
    await client.query("begin");
    const disputeResult = await client.query("select d.*,c.amount_atomic from disputes d join contracts c on c.id=d.contract_id where d.id=$1 for update of d", [disputeId]);
    const dispute = disputeResult.rows[0];
    if (!dispute) throw new AppError("DISPUTE_NOT_FOUND", "Dispute not found.", 404);
    const existing = await client.query("select * from dispute_decisions where dispute_id=$1", [disputeId]);
    if (existing.rows[0]) {
      if (existing.rows[0].outcome !== input.outcome || existing.rows[0].reason !== input.reason) throw new AppError("DECISION_CONFLICT", "A different resolution is already prepared.", 409);
      await client.query("commit");
      return existing.rows[0];
    }
    if (!["open", "under_review"].includes(dispute.status)) throw new AppError("INVALID_DISPUTE_STATE", "This dispute cannot be resolved in its current state.", 409);
    const decision = await client.query(
      `insert into dispute_decisions (dispute_id,admin_id,outcome,reason,amount_atomic,chain_action_id)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [disputeId, adminId, input.outcome, input.reason, String(dispute.amount_atomic), chainActionId],
    );
    await client.query("update disputes set status='awaiting_chain',assigned_admin_id=$2,version=version+1 where id=$1", [disputeId, adminId]);
    await client.query("insert into admin_audit_log (admin_id,action,entity_type,entity_id,dispute_id,metadata) values ($1,'resolution_prepared','dispute',$2,$2,jsonb_build_object('outcome',$3,'chainActionId',$4))", [adminId, disputeId, input.outcome, chainActionId]);
    await client.query("commit");
    return decision.rows[0];
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}
