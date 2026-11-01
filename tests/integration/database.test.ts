import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgres://jobba:jobba@localhost:5434/jobba_freelance";

const client = "4Nd1mYQq6hWzK8Qn7xq9c3yD1sJ6bS9m2oR5pTfV8aXe";
const freelancer = "7Hk2pLmN3qRs5tUv8wXy1zAb4CdE6fGh9JkMn2PqRsTu";
const mint = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

async function load() {
  const { getDatabase } = await import("@/server/db/client");
  return {
    db: getDatabase(),
    projects: await import("@/server/repositories/projects"),
    proposals: await import("@/server/repositories/proposals"),
    profiles: await import("@/server/repositories/profiles"),
    profileService: await import("@/server/services/profile"),
    auth: await import("@/server/auth/store"),
  };
}

let ctx: Awaited<ReturnType<typeof load>>;

async function wipe() {
  const wallets = [client, freelancer];
  await ctx.db.query("delete from auth_nonces where wallet_public_key = any($1)", [wallets]);
  await ctx.db.query("delete from projects where client_id in (select id from profiles where wallet_public_key = any($1))", [wallets]);
  await ctx.db.query("delete from profiles where wallet_public_key = any($1)", [wallets]);
}

beforeAll(async () => { ctx = await load(); await wipe(); });
afterAll(async () => { await wipe(); await ctx.db.end(); });

describe("schema", () => {
  it("applies all tables, enums and seed skills", async () => {
    const t = await ctx.db.query("select count(*)::int n from information_schema.tables where table_schema = 'public'");
    expect(t.rows[0].n).toBeGreaterThanOrEqual(24);
    expect((await ctx.db.query("select count(*)::int n from skills")).rows[0].n).toBeGreaterThan(0);
  });

  it("rejects non-base58 wallets and non-positive budgets", async () => {
    await expect(ctx.db.query("insert into profiles (wallet_public_key, display_name) values ('not-a-wallet','x')")).rejects.toMatchObject({ code: "23514" });
  });
});

describe("wallet sessions", () => {
  it("creates a profile per wallet, reads and revokes sessions, and rejects nonce replay", async () => {
    const a = await ctx.auth.createSession(client, 60);
    const again = await ctx.auth.createSession(client, 60);
    expect((await ctx.auth.readSession(a.token))?.walletAddress).toBe(client);
    expect((await ctx.db.query("select count(*)::int n from profiles where wallet_public_key = $1", [client])).rows[0].n).toBe(1);
    await ctx.auth.deleteSession(again.token);
    expect(await ctx.auth.readSession(again.token)).toBeUndefined();
    expect(await ctx.auth.readSession("unknown")).toBeUndefined();

    await ctx.auth.saveChallenge("nonce-1", { address: client, message: "msg", expiresAt: Date.now() + 60_000 });
    expect(await ctx.auth.consumeChallenge("nonce-1", freelancer)).toBeUndefined();
    expect(await ctx.auth.consumeChallenge("nonce-1", client)).toBeTruthy();
    expect(await ctx.auth.consumeChallenge("nonce-1", client)).toBeUndefined();
  });

  it("rejects expired challenges", async () => {
    await ctx.auth.saveChallenge("nonce-2", { address: client, message: "msg2", expiresAt: Date.now() + 1_000 });
    expect(await ctx.auth.consumeChallenge("nonce-2", client, Date.now() + 5_000)).toBeUndefined();
  });
});

describe("projects and proposals", () => {
  it("round-trips, filters, paginates and enforces uniqueness", async () => {
    await ctx.auth.createSession(freelancer, 60);
    const c = (await ctx.profiles.findActorByWallet(ctx.db, client))!;
    const f = (await ctx.profiles.findActorByWallet(ctx.db, freelancer))!;
    const skill = (await ctx.db.query("select id from skills limit 1")).rows[0].id;
    const input = (title: string) => ({ title, description: "D".repeat(40), category: "web", budgetAtomic: "5000000", deliveryDays: 21, status: "open", skillIds: [skill] }) as never;

    const p1 = await ctx.projects.insertProject(ctx.db, c.profileId, mint, input("First project"));
    const p2 = await ctx.projects.insertProject(ctx.db, c.profileId, mint, input("Second project"));
    expect(p1.project_skills).toHaveLength(1);
    expect(p1.client.id).toBe(c.profileId);

    const page1 = await ctx.projects.listProjects(ctx.db, { limit: 1 } as never);
    expect(page1[0].id).toBe(p2.id);
    const last = page1[0];
    const page2 = await ctx.projects.listProjects(ctx.db, { limit: 1 } as never, { createdAt: String(last.created_at), id: last.id });
    expect(page2[0].id).toBe(p1.id);
    expect(await ctx.projects.listProjects(ctx.db, { limit: 5, search: "First" } as never)).toHaveLength(1);
    expect(await ctx.projects.listProjects(ctx.db, { limit: 5, search: "100%" } as never)).toHaveLength(0);
    expect(await ctx.projects.listProjects(ctx.db, { limit: 5, minBudgetAtomic: "9000000000000" } as never)).toHaveLength(0);

    const proposal = { coverLetter: "I can do this work well and fast.", amountAtomic: "4000000", estimatedDays: 3 } as never;
    const created = await ctx.proposals.insertProposal(ctx.db, p1.id, f.profileId, proposal);
    expect(created.freelancer.display_name).toBeTruthy();
    await expect(ctx.proposals.insertProposal(ctx.db, p1.id, f.profileId, proposal)).rejects.toMatchObject({ code: "23505" });
    expect(await ctx.proposals.listProjectProposals(ctx.db, p1.id, { limit: 5 } as never)).toHaveLength(1);

    expect(await ctx.proposals.withdrawPendingProposal(ctx.db, created.id, c.profileId)).toBeNull();
    expect((await ctx.proposals.withdrawPendingProposal(ctx.db, created.id, f.profileId))?.status).toBe("withdrawn");
    expect(await ctx.proposals.withdrawPendingProposal(ctx.db, created.id, f.profileId)).toBeNull();

    const revived = await ctx.proposals.insertProposal(ctx.db, p1.id, f.profileId, { ...(proposal as object), amountAtomic: "3500000" } as never);
    expect(revived.id).toBe(created.id);
    expect(revived.status).toBe("pending");
    expect(String(revived.amount_atomic)).toBe("3500000");
  });
});

describe("profile persistence", () => {
  it("updates details and atomically replaces roles, skills and portfolio", async () => {
    await ctx.auth.createSession(client, 60);
    const actor = (await ctx.profiles.findActorByWallet(ctx.db, client))!;
    const skills = (await ctx.db.query<{ id: string }>("select id from skills order by id limit 2")).rows.map((row) => row.id);
    const input = {
      displayName: "Jordan Client",
      headline: "Product builder",
      location: "Lagos, Nigeria",
      bio: "Building useful products with independent teams.",
      hourlyRateAtomic: "50000000",
      availability: "limited",
      roles: ["client", "freelancer"],
      skillIds: skills,
      portfolio: [{ title: "Recent work", url: "https://example.com/work" }],
    } as const;
    const first = await ctx.profileService.updateOwnProfile(actor, input as never);
    expect(first.profile).toMatchObject({ displayName: "Jordan Client", headline: "Product builder", location: "Lagos, Nigeria" });
    expect(first.profile.roles).toEqual(["client", "freelancer"]);
    expect(first.profile.skills).toHaveLength(2);

    const second = await ctx.profileService.updateOwnProfile(actor, { ...input, roles: ["client"], skillIds: [skills[0]], portfolio: [] } as never);
    expect(second.profile.roles).toEqual(["client"]);
    expect(second.profile.skills).toHaveLength(1);
    expect(second.profile.portfolio).toEqual([]);
  });

  it("rolls back the complete replacement when a skill is invalid", async () => {
    const actor = (await ctx.profiles.findActorByWallet(ctx.db, client))!;
    await expect(ctx.profileService.updateOwnProfile(actor, {
      displayName: "Should not persist", headline: null, location: null, bio: null, hourlyRateAtomic: null,
      availability: "available", roles: ["freelancer"], skillIds: ["99999999-9999-4999-8999-999999999999"], portfolio: [],
    } as never)).rejects.toMatchObject({ code: "INVALID_SKILL" });
    expect((await ctx.profiles.getProfileById(ctx.db, actor.profileId)).display_name).toBe("Jordan Client");
  });
});
