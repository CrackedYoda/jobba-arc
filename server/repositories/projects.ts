import "server-only";

import type { CreateProjectInput, ListProjectsInput } from "@/features/projects/schemas";
import type { Database } from "@/server/db/client";
import type { Cursor } from "@/server/db/cursor";

const projectSelect = `
  select p.id, p.client_id, p.title, p.description, p.category, p.budget_atomic, p.delivery_days,
         (select count(*)::int from proposals x where x.project_id = p.id and x.status in ('pending','accepted')) as proposal_count,
         (select count(*)::int from contracts k where k.client_id = p.client_id and k.status in ('funded','active','submitted','released','resolved')) as client_funded_count,
         c.location as client_location, c.wallet_public_key as client_wallet, p.currency_mint, p.status,
         p.version, p.published_at, p.created_at, p.updated_at,
         json_build_object('id', c.id, 'display_name', c.display_name, 'avatar_url', c.avatar_url) as client,
         coalesce((select json_agg(json_build_object('skill', json_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'category', s.category)))
                     from project_skills ps join skills s on s.id = ps.skill_id where ps.project_id = p.id), '[]') as project_skills
    from projects p join profiles c on c.id = p.client_id`;

export async function insertProject(db: Database, clientId: string, mint: string, input: CreateProjectInput) {
  const conn = await db.connect();
  try {
    await conn.query("begin");
    const { rows } = await conn.query<{ id: string }>(
      `insert into projects (client_id, title, description, category, budget_atomic, delivery_days, currency_mint, status, published_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [clientId, input.title, input.description, input.category, input.budgetAtomic, input.deliveryDays, mint, input.status,
        input.status === "open" ? new Date().toISOString() : null],
    );
    const id = rows[0].id;
    if (input.skillIds.length) {
      await conn.query(
        "insert into project_skills (project_id, skill_id) select $1, unnest($2::uuid[])",
        [id, input.skillIds],
      );
    }
    await conn.query("commit");
    return getProjectById(db, id);
  } catch (error) {
    await conn.query("rollback");
    throw error;
  } finally {
    conn.release();
  }
}

export async function getProjectById(db: Database, id: string) {
  const { rows } = await db.query(`${projectSelect} where p.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listProjects(db: Database, input: ListProjectsInput, cursor?: Cursor) {
  const where = ["p.status = 'open'"];
  const params: unknown[] = [];
  const add = (value: unknown) => { params.push(value); return `$${params.length}`; };
  if (input.category) where.push(`p.category = ${add(input.category)}`);
  if (input.search) {
    const term = add(`%${input.search.replace(/[\\%_]/g, "\\$&")}%`);
    where.push(`(p.title ilike ${term} or p.description ilike ${term})`);
  }
  if (input.minBudgetAtomic) where.push(`p.budget_atomic >= ${add(input.minBudgetAtomic)}`);
  if (input.maxBudgetAtomic) where.push(`p.budget_atomic <= ${add(input.maxBudgetAtomic)}`);
  if (input.skillId) where.push(`exists (select 1 from project_skills f where f.project_id = p.id and f.skill_id = ${add(input.skillId)})`);
  if (cursor) where.push(`(p.created_at, p.id) < (${add(cursor.createdAt)}::timestamptz, ${add(cursor.id)}::uuid)`);
  const { rows } = await db.query(
    `${projectSelect} where ${where.join(" and ")} order by p.created_at desc, p.id desc limit ${add(input.limit + 1)}`,
    params,
  );
  return rows;
}
