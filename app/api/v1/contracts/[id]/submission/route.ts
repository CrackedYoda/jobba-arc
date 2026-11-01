import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { submissionInputSchema } from "@/features/contracts/submission-schema";
import { success } from "@/lib/api/envelope";
import { assertSameOrigin } from "@/server/auth/http";
import { getDatabase } from "@/server/db/client";
import { AppError, errorResponse } from "@/server/db/errors";
import { requireActor } from "@/server/services/auth-context";

type Context = { params: Promise<{ id: string }> };

function canonicalHash(description: string, urls: string[]): Buffer {
  return createHash("sha256").update(JSON.stringify({ description, urls, version: 1 })).digest();
}

async function contractAccess(contractId: string, profileId: string) {
  const { rows } = await getDatabase().query(`select c.id,c.client_id,c.freelancer_id,c.status,
    exists(select 1 from profile_roles where profile_id=$2 and role='admin') as is_admin
    from contracts c where c.id=$1`, [contractId, profileId]);
  const contract = rows[0];
  if (!contract || (profileId !== contract.client_id && profileId !== contract.freelancer_id && !contract.is_admin)) throw new AppError("CONTRACT_NOT_FOUND", "Contract not found.", 404);
  return contract;
}

export async function GET(_request: Request, context: Context) {
  try {
    const contractId = z.string().uuid().parse((await context.params).id);
    const actor = await requireActor();
    const contract = await contractAccess(contractId, actor.profileId);
    const { rows } = await getDatabase().query(`select s.id,s.description,s.deliverable_urls,encode(s.content_hash,'hex') as content_hash,s.status,s.created_at,p.display_name as freelancer_name
      from submissions s join profiles p on p.id=s.freelancer_id where s.contract_id=$1 order by s.created_at desc`, [contractId]);
    return NextResponse.json(success({ items: rows, canSubmit: actor.profileId === contract.freelancer_id && contract.status === "active" }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  const originFailure = assertSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const contractId = z.string().uuid().parse((await context.params).id);
    const actor = await requireActor("freelancer");
    const input = submissionInputSchema.parse(await request.json());
    const contract = await contractAccess(contractId, actor.profileId);
    if (contract.freelancer_id !== actor.profileId) throw new AppError("FORBIDDEN", "Only the contract freelancer may submit work.", 403);
    if (contract.status !== "active") throw new AppError("INVALID_CONTRACT_STATE", "Work can only be submitted for an active contract.", 409);
    const hash = canonicalHash(input.description, input.deliverableUrls);
    const db = getDatabase();
    const client = await db.connect();
    try {
      await client.query("begin");
      const existing = await client.query("select id,description,deliverable_urls,encode(content_hash,'hex') as content_hash,status,created_at from submissions where contract_id=$1 and status='submitted' for update", [contractId]);
      if (existing.rows[0]?.content_hash === hash.toString("hex")) {
        await client.query("commit");
        return NextResponse.json(success(existing.rows[0]), { status: 200 });
      }
      await client.query("update submissions set status='superseded' where contract_id=$1 and status='submitted'", [contractId]);
      const inserted = await client.query(`insert into submissions (contract_id,freelancer_id,description,deliverable_urls,content_hash)
        values ($1,$2,$3,$4,$5) returning id,description,deliverable_urls,encode(content_hash,'hex') as content_hash,status,created_at`,
        [contractId, actor.profileId, input.description, JSON.stringify(input.deliverableUrls), hash]);
      await client.query("commit");
      return NextResponse.json(success(inserted.rows[0]), { status: 201 });
    } catch (error) { await client.query("rollback"); throw error; }
    finally { client.release(); }
  } catch (error) { return errorResponse(error); }
}
