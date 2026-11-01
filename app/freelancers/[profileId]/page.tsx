import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/marketplace/site-footer";
import { SiteHeader } from "@/components/marketplace/site-header";
import { getFreelancer, getViewer, shortKey } from "@/server/marketplace/service";

export const metadata: Metadata = { title: "Freelancer profile | Jobba" };

export default async function FreelancerPage({ params }: { params: Promise<{ profileId: string }> }) {
  const [{ profileId }, viewer] = await Promise.all([params, getViewer()]);
  const profile = await getFreelancer(profileId);
  if (!profile) notFound();
  const own = viewer.profileId === profile.id;
  return (
    <>
      <SiteHeader active="talent" />
      <main className="shell profilePage pageSection">
        <section className="profileHero">
          <div className="avatar" aria-hidden="true">{profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
          <div><p className="eyebrow">{profile.availability}</p><h1>{profile.name}</h1><p className="lead">{profile.headline}</p><div className="profileMeta"><span>{profile.location}</span><span className="mono">{shortKey(profile.wallet)}</span></div></div>
          {own ? <Link className="button ghost" href="/onboarding">Edit profile</Link> : <Link className="button primary" href="/projects/new">Discuss a project</Link>}
        </section>
        <div className="profileGrid">
          <article>
            <section className="contentSection"><h2>About</h2><p className="prose">{profile.bio || "No bio yet."}</p></section>
            <section className="contentSection"><h2>Expertise</h2><div className="tagRow">{profile.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></section>
            <section className="contentSection"><h2>Selected work</h2>{profile.portfolio.length ? <div className="portfolioGrid">{profile.portfolio.map((item) => <a href={item.url} target="_blank" rel="noreferrer noopener" key={item.url}><strong>{item.label}</strong><i>View project ↗</i></a>)}</div> : <p className="muted">No portfolio links yet.</p>}</section>
          </article>
          <aside className="profileStats">
            <div><span>Hourly guide</span><strong className="mono">{profile.rateUsdc} USDC</strong></div>
            <div><span>Completed contracts</span><strong>{profile.completedContracts}</strong></div>
            <div><span>Lifetime earnings</span><strong className="mono">{profile.earnedUsdc} USDC</strong></div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export const dynamic = "force-dynamic";
