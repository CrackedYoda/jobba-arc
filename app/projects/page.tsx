import type { Metadata } from "next";
import Link from "next/link";

import { ProjectCard } from "@/components/marketplace/project-card";
import { SiteFooter } from "@/components/marketplace/site-footer";
import { SiteHeader } from "@/components/marketplace/site-header";
import { listCategories, listProjects, listSkillOptions } from "@/server/marketplace/service";

export const metadata: Metadata = { title: "Find work | Jobba" };

type Search = { q?: string; category?: string; skill?: string; budget?: string; sort?: string };
const budgets = [["", "Any budget"], ["lt1k", "Under 1,000"], ["1k3k", "1,000 – 3,000"], ["gt3k", "Over 3,000"]] as const;

function href(current: Search, patch: Search): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/projects?${query}` : "/projects";
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const filters = await searchParams;
  const [projects, categories, skills] = await Promise.all([listProjects(filters), listCategories(), listSkillOptions()]);
  const category = filters.category ?? "All";
  return (
    <>
      <SiteHeader active="work" />
      <main className="shell pageSection">
        <div className="pageIntro splitIntro">
          <div><h1>Find work</h1><p className="lead">Fixed-price projects. Every hire is funded into escrow before you start.</p></div>
          <span className="muted">{projects.length} open project{projects.length === 1 ? "" : "s"}</span>
        </div>
        <form className="searchPanel" role="search" action="/projects">
          <label><span>Search projects</span><input name="q" defaultValue={filters.q ?? ""} placeholder="Search by title, skill or client" /></label>
          <label><span>Sort</span>
            <select name="sort" defaultValue={filters.sort ?? "new"}>
              <option value="new">Newest first</option><option value="hi">Budget: high to low</option><option value="lo">Budget: low to high</option><option value="few">Fewest proposals</option>
            </select></label>
          {category !== "All" ? <input type="hidden" name="category" value={category} /> : null}
          {filters.skill ? <input type="hidden" name="skill" value={filters.skill} /> : null}
          {filters.budget ? <input type="hidden" name="budget" value={filters.budget} /> : null}
          <button className="button primary" type="submit">Search</button>
        </form>
        <nav className="pillRow scrollRow" aria-label="Categories">
          {["All", ...categories].map((item) => <Link key={item} className={`pillButton${category === item ? " on" : ""}`} aria-current={category === item ? "true" : undefined} href={href(filters, { category: item === "All" ? "" : item })}>{item}</Link>)}
        </nav>
        <div className="browseLayout">
          <aside className="filterRail" aria-label="Filters">
            <section><h2>Budget (USDC)</h2>{budgets.map(([value, label]) => <Link key={label} className={`filterLink${(filters.budget ?? "") === value ? " on" : ""}`} href={href(filters, { budget: value })}>{label}</Link>)}</section>
            <section><h2>Skills</h2>{skills.map((skill) => <Link key={skill.id} className={`filterLink${filters.skill === skill.slug ? " on" : ""}`} href={href(filters, { skill: filters.skill === skill.slug ? "" : skill.slug })}>{skill.name}</Link>)}</section>
            <div className="escrowNotice"><strong>Verified funding</strong><p>“Funded” counts contracts a client has paid into escrow on-chain before.</p></div>
          </aside>
          <div className="listingStack">
            {projects.map((project) => <ProjectCard project={project} key={project.id} />)}
            {projects.length === 0 ? <div className="emptyState"><h2>No projects match these filters</h2><p>Try a wider budget or fewer skills.</p><Link className="button ghost" href="/projects">Clear filters</Link></div> : null}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export const dynamic = "force-dynamic";
