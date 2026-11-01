import "server-only";

import type { UpdateProfileInput } from "@/features/profiles/schemas";
import { getDatabase } from "@/server/db/client";
import { AppError } from "@/server/db/errors";
import { getProfileById, listSkills, type Actor } from "@/server/repositories/profiles";

function serializeProfile(row: Record<string, unknown>) {
  return {
    id: row.id,
    walletAddress: row.wallet_public_key,
    displayName: row.display_name,
    headline: row.headline,
    location: row.location,
    bio: row.bio,
    hourlyRateAtomic: row.hourly_rate_atomic === null ? null : String(row.hourly_rate_atomic),
    availability: row.availability,
    avatarUrl: row.avatar_url,
    roles: row.roles,
    skills: Array.isArray(row.profile_skills) ? row.profile_skills.map((entry) => (entry as { skill: unknown }).skill) : [],
    portfolio: row.portfolio_links,
  };
}

export async function readOwnProfile(actor: Actor) {
  const db = getDatabase();
  const profile = await getProfileById(db, actor.profileId);
  if (!profile) throw new AppError("PROFILE_NOT_FOUND", "Profile not found.", 404);
  return { profile: serializeProfile(profile as Record<string, unknown>), availableSkills: await listSkills(db) };
}

export async function updateOwnProfile(actor: Actor, input: UpdateProfileInput) {
  const db = getDatabase();
  const client = await db.connect();
  try {
    await client.query("begin");
    if (input.skillIds.length) {
      const found = await client.query<{ id: string }>("select id from skills where id = any($1::uuid[])", [input.skillIds]);
      if (found.rowCount !== input.skillIds.length) throw new AppError("INVALID_SKILL", "One or more selected skills do not exist.", 400);
    }
    await client.query(
      `update profiles set display_name=$2, headline=$3, location=$4, bio=$5, hourly_rate_atomic=$6, availability=$7 where id=$1`,
      [actor.profileId, input.displayName, input.headline, input.location, input.bio, input.hourlyRateAtomic, input.availability],
    );
    await client.query("delete from profile_roles where profile_id=$1 and role <> 'admin'", [actor.profileId]);
    for (const role of input.roles) await client.query("insert into profile_roles (profile_id, role) values ($1,$2)", [actor.profileId, role]);
    await client.query("delete from profile_skills where profile_id=$1", [actor.profileId]);
    for (const skillId of input.skillIds) await client.query("insert into profile_skills (profile_id, skill_id) values ($1,$2)", [actor.profileId, skillId]);
    await client.query("delete from portfolio_links where profile_id=$1", [actor.profileId]);
    for (const [index, link] of input.portfolio.entries()) {
      await client.query("insert into portfolio_links (profile_id, title, url, sort_order) values ($1,$2,$3,$4)", [actor.profileId, link.title, link.url, index]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return readOwnProfile(actor);
}
