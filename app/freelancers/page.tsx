import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/marketplace/site-footer";
import { SiteHeader } from "@/components/marketplace/site-header";
import { listFreelancers, listSkillOptions } from "@/server/marketplace/service";

export const metadata: Metadata = { title: "Find talent | Jobba" };

export default async function FreelancersPage({ searchParams }: { searchParams: Promise<{ q?: string; skill?: string }> }) {
  const filters = await searchParams;
  const [people, skills] = await Promise.all([listFreelancers(filters), listSkillOptions()]);
  return (
    <>
      <SiteHeader active="talent" />
      <main className="shell pageSection">
        <div className="pageIntro"><h1>Find talent</h1><p className="lead">Independent professionals, paid in USDC through escrow.</p></div>
        <form className="searchPanel" role="search" action="/freelancers">
          <label><span>Search by name, headline or skill</span><input name="q" defaultValue={filters.q ?? ""} placeholder="Product design, Solana, copywriting…" /></label>
          <label><span>Skill</span><select name="skill" defaultValue={filters.skill ?? ""}><option value="">Any skill</option>{skills.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}</select></label>
          <button className="button primary" type="submit">Search</button>
        </form>
        <div className="resultsHeading"><h2>{people.length} freelancer{people.length === 1 ? "" : "s"}</h2></div>
        <div className="talentGrid">
          {people.map((person) => (
            <Link className="talentCard" href={`/freelancers/${person.id}`} key={person.id}>
              <span className="avatar small" aria-hidden="true">{person.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
              <strong>{person.name}</strong><span className="muted">{person.headline || "Freelancer"}</span>
              <div className="tagRow">{person.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div>
              <footer><span className="mono">{person.rateUsdc} USDC/hr</span><span className="muted">{person.completedContracts} completed</span></footer>
            </Link>
          ))}
        </div>
        {people.length === 0 ? <div className="emptyState"><h2>No freelancers match</h2><p>Try a different skill or clear the search.</p><Link className="button ghost" href="/freelancers">Clear filters</Link></div> : null}
      </main>
      <SiteFooter />
    </>
  );
}

export const dynamic = "force-dynamic";
