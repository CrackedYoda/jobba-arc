import "server-only";

import type { Database } from "@/server/db/client";

export type AppRole = "client" | "freelancer" | "admin";
export type Actor = { profileId: string; walletAddress: string; roles: AppRole[] };

export async function findActorByWallet(db: Database, walletAddress: string): Promise<Actor | undefined> {
  const { rows } = await db.query<{ id: string; wallet_public_key: string; roles: AppRole[] }>(
    `select p.id, p.wallet_public_key,
            coalesce(array_agg(r.role::text) filter (where r.role is not null), '{}') as roles
       from profiles p left join profile_roles r on r.profile_id = p.id
      where p.wallet_public_key = $1 group by p.id`,
    [walletAddress],
  );
  const row = rows[0];
  return row ? { profileId: row.id, walletAddress: row.wallet_public_key, roles: row.roles } : undefined;
}

export async function getProfileById(db: Database, profileId: string) {
  const { rows } = await db.query(
    `select p.id, p.wallet_public_key, p.display_name, p.headline, p.location, p.bio, p.hourly_rate_atomic, p.availability, p.avatar_url,
            coalesce((select array_agg(pr.role::text order by pr.role) from profile_roles pr where pr.profile_id = p.id), '{}') as roles,
            coalesce((select json_agg(json_build_object('skill', json_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'category', s.category)))
                        from profile_skills ps join skills s on s.id = ps.skill_id where ps.profile_id = p.id), '[]') as profile_skills,
            coalesce((select json_agg(json_build_object('id', l.id, 'title', l.title, 'url', l.url, 'sort_order', l.sort_order) order by l.sort_order)
                        from portfolio_links l where l.profile_id = p.id), '[]') as portfolio_links
       from profiles p where p.id = $1`,
    [profileId],
  );
  return rows[0] ?? null;
}

export async function listSkills(db: Database) {
  return (await db.query("select id, slug, name::text, category::text from skills order by category, name")).rows;
}
