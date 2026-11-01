import "server-only";

import { cookies } from "next/headers";

import type {
  ContractDetail, ContractSummary, FreelancerProfile, ProjectSummary, ProposalSummary, Viewer,
} from "@/features/marketplace/types";
import { getServerEnv } from "@/lib/config/env";
import { formatUsdc } from "@/lib/domain/marketplace";
import { readSession } from "@/server/auth/store";
import { getDatabase, hasDatabase } from "@/server/db/client";
import { findActorByWallet, type Actor } from "@/server/repositories/profiles";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Row = Record<string, unknown>;

export function relativeDate(value: unknown): string {
  const elapsed = Math.max(0, Date.now() - Date.parse(String(value)));
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return minutes < 2 ? "Just now" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

export function usdc(value: unknown): string {
  const n = BigInt(String(value ?? 0));
  const whole = n / 1_000_000n;
  const fraction = (n % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}

export function shortKey(value: string): string {
  return value.length > 10 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value;
}

export async function getViewer(): Promise<Viewer> {
  if (!hasDatabase()) return { authenticated: false, roles: [] };
  const env = getServerEnv();
  const token = (await cookies()).get(env.SESSION_COOKIE_NAME)?.value;
  const session = await readSession(token);
  if (!session) return { authenticated: false, roles: [] };
  const db = getDatabase();
  const actor = await findActorByWallet(db, session.walletAddress);
  if (!actor) return { authenticated: false, roles: [] };
  const profile = await db.query<{ display_name: string }>("select display_name from profiles where id = $1", [actor.profileId]);
  return { authenticated: true, walletAddress: actor.walletAddress, profileId: actor.profileId, displayName: profile.rows[0]?.display_name, roles: actor.roles };
}

export async function viewerActor(): Promise<Actor | undefined> {
  const viewer = await getViewer();
  return viewer.authenticated && viewer.profileId ? { profileId: viewer.profileId, walletAddress: viewer.walletAddress!, roles: viewer.roles as Actor["roles"] } : undefined;
}

const projectSql = `
  select p.id, p.title, p.description, p.category, p.status, p.budget_atomic, p.delivery_days, p.created_at, p.published_at, p.client_id,
         c.display_name as client_name, coalesce(c.location, 'Remote') as client_location, c.wallet_public_key as client_wallet,
         (select count(*)::int from proposals x where x.project_id = p.id and x.status in ('pending','accepted')) as proposal_count,
         (select count(*)::int from contracts k where k.client_id = p.client_id and k.status in ('funded','active','submitted','released','resolved')) as funded_count,
         coalesce((select array_agg(s.name::text order by s.name) from project_skills ps join skills s on s.id = ps.skill_id where ps.project_id = p.id), '{}') as skills
    from projects p join profiles c on c.id = p.client_id`;

function projectView(row: Row): ProjectSummary {
  const description = String(row.description);
  return {
    id: String(row.id), title: String(row.title), description, category: String(row.category), status: String(row.status),
    summary: description.length > 180 ? `${description.slice(0, 177)}…` : description,
    skills: row.skills as string[], budgetAtomic: String(row.budget_atomic), budgetUsdc: usdc(row.budget_atomic),
    deliveryDays: Number(row.delivery_days), proposals: Number(row.proposal_count),
    postedAt: relativeDate(row.published_at ?? row.created_at), createdAt: String(row.created_at), clientId: String(row.client_id),
    client: { name: String(row.client_name), location: String(row.client_location), projectsFunded: Number(row.funded_count), wallet: String(row.client_wallet) },
  };
}

export type ProjectFilters = { q?: string; category?: string; skill?: string; budget?: string; sort?: string };

export async function listProjects(filters: ProjectFilters = {}): Promise<ProjectSummary[]> {
  const where = ["p.status = 'open'"];
  const params: unknown[] = [];
  const add = (v: unknown) => { params.push(v); return `$${params.length}`; };
  if (filters.category && filters.category !== "All") where.push(`p.category = ${add(filters.category)}`);
  if (filters.q?.trim()) {
    const t = add(`%${filters.q.trim().replace(/[\\%_]/g, "\\$&")}%`);
    where.push(`(p.title ilike ${t} or p.description ilike ${t} or c.display_name ilike ${t} or exists (select 1 from project_skills ps join skills s on s.id = ps.skill_id where ps.project_id = p.id and s.name ilike ${t}))`);
  }
  if (filters.skill) where.push(`exists (select 1 from project_skills ps join skills s on s.id = ps.skill_id where ps.project_id = p.id and s.slug = ${add(filters.skill)})`);
  if (filters.budget === "lt1k") where.push("p.budget_atomic < 1000000000");
  if (filters.budget === "1k3k") where.push("p.budget_atomic between 1000000000 and 3000000000");
  if (filters.budget === "gt3k") where.push("p.budget_atomic > 3000000000");
  const order = filters.sort === "hi" ? "p.budget_atomic desc" : filters.sort === "lo" ? "p.budget_atomic asc" : filters.sort === "few" ? "proposal_count asc, p.created_at desc" : "p.created_at desc";
  const { rows } = await getDatabase().query(`${projectSql} where ${where.join(" and ")} order by ${order}, p.id limit 60`, params);
  return rows.map(projectView);
}

export async function getProject(projectId: string): Promise<ProjectSummary | undefined> {
  if (!UUID.test(projectId)) return undefined;
  const { rows } = await getDatabase().query(`${projectSql} where p.id = $1 and p.status <> 'draft'`, [projectId]);
  return rows[0] ? projectView(rows[0]) : undefined;
}

export async function listCategories(): Promise<string[]> {
  const { rows } = await getDatabase().query<{ category: string }>("select distinct category::text from projects where status = 'open' order by 1");
  const base = ["Development", "Design & Creative", "Writing", "Marketing", "Data & AI", "Video & animation"];
  return [...new Set([...base, ...rows.map((r) => r.category)])];
}

export async function listSkillOptions() {
  return (await getDatabase().query<{ id: string; slug: string; name: string; category: string }>("select id, slug, name::text, category::text from skills order by name")).rows;
}

const proposalSql = `
  select pr.id, pr.project_id, pr.amount_atomic, pr.estimated_days, pr.cover_letter, pr.portfolio_url, pr.status, pr.created_at,
         p.title as project_title, f.id as freelancer_id, f.display_name, coalesce(f.headline, '') as headline,
         (select count(*)::int from contracts k where k.freelancer_id = f.id and k.status in ('released','resolved')) as completed,
         (select k.id from contracts k where k.proposal_id = pr.id) as contract_id
    from proposals pr join projects p on p.id = pr.project_id join profiles f on f.id = pr.freelancer_id`;

function proposalView(row: Row): ProposalSummary {
  return {
    id: String(row.id), projectId: String(row.project_id), projectTitle: String(row.project_title),
    freelancer: { id: String(row.freelancer_id), name: String(row.display_name), headline: String(row.headline), completedContracts: Number(row.completed) },
    amountAtomic: String(row.amount_atomic), amountUsdc: usdc(row.amount_atomic), deliveryDays: Number(row.estimated_days),
    coverLetter: String(row.cover_letter), portfolioUrl: (row.portfolio_url as string | null) ?? null,
    status: row.status as ProposalSummary["status"], createdAt: String(row.created_at), contractId: (row.contract_id as string | null) ?? null,
  };
}

export async function listProjectProposals(projectId: string): Promise<ProposalSummary[]> {
  if (!UUID.test(projectId)) return [];
  const { rows } = await getDatabase().query(`${proposalSql} where pr.project_id = $1 order by pr.created_at desc`, [projectId]);
  return rows.map(proposalView);
}

export async function findMyProposal(projectId: string, profileId: string): Promise<ProposalSummary | undefined> {
  const { rows } = await getDatabase().query(`${proposalSql} where pr.project_id = $1 and pr.freelancer_id = $2`, [projectId, profileId]);
  return rows[0] ? proposalView(rows[0]) : undefined;
}

export async function listMyProposals(profileId: string): Promise<ProposalSummary[]> {
  const { rows } = await getDatabase().query(`${proposalSql} where pr.freelancer_id = $1 order by pr.created_at desc limit 50`, [profileId]);
  return rows.map(proposalView);
}

const freelancerSql = `
  select p.id, p.display_name, coalesce(p.headline, '') as headline, coalesce(p.bio, '') as bio, coalesce(p.location, 'Remote') as location,
         p.hourly_rate_atomic, p.availability, p.wallet_public_key,
         (select count(*)::int from contracts k where k.freelancer_id = p.id and k.status in ('released','resolved')) as completed,
         (select coalesce(sum(k.amount_atomic - k.fee_atomic), 0) from contracts k where k.freelancer_id = p.id and k.status = 'released') as earned,
         coalesce((select array_agg(s.name::text order by s.name) from profile_skills ps join skills s on s.id = ps.skill_id where ps.profile_id = p.id), '{}') as skills,
         coalesce((select json_agg(json_build_object('label', l.title, 'url', l.url) order by l.sort_order) from portfolio_links l where l.profile_id = p.id), '[]') as portfolio
    from profiles p join profile_roles r on r.profile_id = p.id and r.role = 'freelancer'`;

const availabilityLabel: Record<string, string> = { available: "Available now", limited: "Limited availability", unavailable: "Not available" };

function freelancerView(row: Row): FreelancerProfile {
  return {
    id: String(row.id), name: String(row.display_name), headline: String(row.headline), bio: String(row.bio), location: String(row.location),
    rateUsdc: row.hourly_rate_atomic == null ? "—" : usdc(row.hourly_rate_atomic), availability: availabilityLabel[String(row.availability)] ?? String(row.availability),
    skills: row.skills as string[], completedContracts: Number(row.completed), earnedUsdc: usdc(row.earned), wallet: String(row.wallet_public_key),
    portfolio: row.portfolio as { label: string; url: string }[],
  };
}

export async function listFreelancers(filters: { q?: string; skill?: string } = {}): Promise<FreelancerProfile[]> {
  const where = ["true"];
  const params: unknown[] = [];
  const add = (v: unknown) => { params.push(v); return `$${params.length}`; };
  if (filters.q?.trim()) {
    const t = add(`%${filters.q.trim().replace(/[\\%_]/g, "\\$&")}%`);
    where.push(`(p.display_name ilike ${t} or p.headline ilike ${t} or exists (select 1 from profile_skills ps join skills s on s.id = ps.skill_id where ps.profile_id = p.id and s.name ilike ${t}))`);
  }
  if (filters.skill) where.push(`exists (select 1 from profile_skills ps join skills s on s.id = ps.skill_id where ps.profile_id = p.id and s.slug = ${add(filters.skill)})`);
  const { rows } = await getDatabase().query(`${freelancerSql} where ${where.join(" and ")} order by completed desc, p.created_at desc limit 60`, params);
  return rows.map(freelancerView);
}

export async function getFreelancer(profileId: string): Promise<FreelancerProfile | undefined> {
  if (!UUID.test(profileId)) return undefined;
  const { rows } = await getDatabase().query(`${freelancerSql} where p.id = $1`, [profileId]);
  return rows[0] ? freelancerView(rows[0]) : undefined;
}

const contractSql = `
  select k.id, k.project_id, k.status, k.amount_atomic, k.fee_atomic, k.currency_mint, encode(k.terms_hash,'hex') as terms_hash, k.escrow_pda, k.created_at, k.updated_at,
         p.title as project_title, p.description, p.delivery_days,
         c.id as client_id, c.display_name as client_name, c.wallet_public_key as client_wallet,
         f.id as freelancer_id, f.display_name as freelancer_name, f.wallet_public_key as freelancer_wallet,
         (select cv.id from conversations cv where cv.contract_id = k.id) as conversation_id,
         (select d.id from disputes d where d.contract_id = k.id order by d.created_at desc limit 1) as dispute_id
    from contracts k join projects p on p.id = k.project_id join profiles c on c.id = k.client_id join profiles f on f.id = k.freelancer_id`;

function contractSummary(row: Row, profileId: string): ContractSummary {
  const role = row.client_id === profileId ? "client" : "freelancer";
  return {
    id: String(row.id), projectId: String(row.project_id), projectTitle: String(row.project_title), status: String(row.status),
    amountAtomic: String(row.amount_atomic), amountUsdc: usdc(row.amount_atomic), role,
    counterpart: String(role === "client" ? row.freelancer_name : row.client_name), updatedAt: String(row.updated_at),
  };
}

export async function listMyContracts(profileId: string): Promise<ContractSummary[]> {
  const { rows } = await getDatabase().query(`${contractSql} where k.client_id = $1 or k.freelancer_id = $1 order by k.updated_at desc limit 50`, [profileId]);
  return rows.map((row) => contractSummary(row, profileId));
}

export async function getContractFor(contractId: string, actor: Actor): Promise<ContractDetail | undefined> {
  if (!UUID.test(contractId)) return undefined;
  const { rows } = await getDatabase().query(`${contractSql} where k.id = $1`, [contractId]);
  const row = rows[0];
  if (!row) return undefined;
  const participant = row.client_id === actor.profileId || row.freelancer_id === actor.profileId;
  if (!participant && !actor.roles.includes("admin")) return undefined;
  const summary = contractSummary(row, row.freelancer_id === actor.profileId ? actor.profileId : String(row.client_id) === actor.profileId ? actor.profileId : String(row.client_id));
  return {
    ...summary, feeAtomic: String(row.fee_atomic), currencyMint: String(row.currency_mint), termsHash: String(row.terms_hash),
    escrowPda: (row.escrow_pda as string | null) ?? null,
    client: { id: String(row.client_id), name: String(row.client_name), wallet: String(row.client_wallet) },
    freelancer: { id: String(row.freelancer_id), name: String(row.freelancer_name), wallet: String(row.freelancer_wallet) },
    conversationId: (row.conversation_id as string | null) ?? null, description: String(row.description), deliveryDays: Number(row.delivery_days),
    disputeId: (row.dispute_id as string | null) ?? null, createdAt: String(row.created_at),
  };
}

export async function clientDashboard(profileId: string) {
  const db = getDatabase();
  const [projects, stats, contracts] = await Promise.all([
    db.query(`${projectSql} where p.client_id = $1 order by p.created_at desc limit 20`, [profileId]),
    db.query<{ open: number; review: number; active: number; escrowed: string }>(
      `select (select count(*)::int from projects where client_id = $1 and status = 'open') as open,
              (select count(*)::int from proposals x join projects p on p.id = x.project_id where p.client_id = $1 and x.status = 'pending' and p.status = 'open') as review,
              (select count(*)::int from contracts where client_id = $1 and status in ('funded','active','submitted','disputed')) as active,
              (select coalesce(sum(amount_atomic),0)::text from contracts where client_id = $1 and status in ('funded','active','submitted','disputed')) as escrowed`, [profileId]),
    listMyContracts(profileId),
  ]);
  const s = stats.rows[0];
  return { projects: projects.rows.map(projectView), openProjects: s.open, pendingProposals: s.review, activeContracts: s.active, escrowedUsdc: usdc(s.escrowed), contracts: contracts.filter((c) => c.role === "client") };
}

export async function freelancerDashboard(profileId: string) {
  const db = getDatabase();
  const [proposals, contracts, stats] = await Promise.all([
    listMyProposals(profileId), listMyContracts(profileId),
    db.query<{ pending: number; active: number; earned: string; strength: number }>(
      `select (select count(*)::int from proposals where freelancer_id = $1 and status = 'pending') as pending,
              (select count(*)::int from contracts where freelancer_id = $1 and status in ('funded','active','submitted','disputed')) as active,
              (select coalesce(sum(amount_atomic - fee_atomic),0)::text from contracts where freelancer_id = $1 and status in ('released')) as earned,
              (select ((p.headline is not null)::int + (p.bio is not null)::int + (p.hourly_rate_atomic is not null)::int + (p.location is not null)::int
                      + (exists (select 1 from profile_skills where profile_id = p.id))::int)::int * 20 from profiles p where p.id = $1) as strength`, [profileId]),
  ]);
  const s = stats.rows[0];
  return { proposals, contracts: contracts.filter((c) => c.role === "freelancer"), pendingProposals: s.pending, activeContracts: s.active, earnedUsdc: usdc(s.earned), profileStrength: s.strength };
}

export { formatUsdc };
