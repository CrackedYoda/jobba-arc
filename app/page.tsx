import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ProjectCard } from "@/components/marketplace/project-card";
import { SiteFooter } from "@/components/marketplace/site-footer";
import { SiteHeader } from "@/components/marketplace/site-header";
import { HowItWorks, LandingHero } from "@/features/landing/hero";
import { hasDatabase } from "@/server/db/client";
import { listProjects } from "@/server/marketplace/service";

const categories = [
  ["Development", "Smart contracts, web apps, indexers"],
  ["Design & Creative", "Product, brand, motion"],
  ["Writing", "Docs, launch copy, research"],
  ["Marketing", "Growth, community, ops"],
  ["Data & AI", "Analytics, notebooks, models"],
  ["Video & animation", "Explainers and edits"],
];

const faq = [
  ["Is this real money?", "No. Jobba runs on Solana devnet with Mock USDC, and the escrow program is unaudited. Use test funds only."],
  ["Who holds the funds?", "A vault account owned by the escrow program, not by Jobba or either party. Only valid program instructions can move the funds."],
  ["What happens if we disagree?", "Either party opens a dispute with evidence. Normal release locks, an administrator reviews the terms, chat and deliverables, and refunds the client or awards the freelancer in full."],
  ["Do I need SOL?", "A little devnet SOL pays network fees. Contract amounts are in USDC."],
  ["Can I cancel?", "The client can cancel and recover the full amount while the escrow is Funded and the freelancer has not yet accepted."],
];

export default async function Home() {
  const featured = hasDatabase() ? (await listProjects({})).slice(0, 3) : [];
  return (
    <main id="top">
      <SiteHeader />
      <LandingHero />
      <section className="trustStrip" aria-label="Platform facts">
        <div><span><strong>USDC</strong> settlement, SOL for network fees</span><span><strong>Sign-In With Solana</strong> — no passwords</span><span><strong>One vault</strong> per contract</span><span><strong>Explorer links</strong> on every transaction</span></div>
      </section>
      <HowItWorks />
      <section className="shell" style={{ paddingBlock: "40px 24px" }}>
        <div className="darkBand">
          <div className="splitIntro">
            <div><span className="eyebrow" style={{ color: "var(--lime)" }}>The escrow lifecycle</span><h2>Every state is on-chain. Every move needs the right signer.</h2></div>
            <p style={{ maxWidth: 400 }}>The program checks the actor, state, amount, mint and terms hash on every instruction. Release is locked the moment a dispute opens.</p>
          </div>
          <div className="lifecycle" aria-label="Happy path"><span>Funded</span>→<span>Active</span>→<span>Submitted</span>→<span className="last">Released</span></div>
          <div className="branchGrid">
            <div><small>FUNDED → CANCELLED</small><strong>Changed your mind before work starts?</strong><p>The client can cancel and recover the full amount while the escrow is still Funded and the freelancer has not accepted.</p></div>
            <div><small className="warn">ANY ACTIVE STATE → DISPUTED</small><strong>Something went wrong?</strong><p>Either party opens a dispute with evidence. Normal release locks; an admin reviews the terms, chat and deliverables.</p></div>
            <div><small>DISPUTED → REFUNDED | AWARDED</small><strong>A recorded, signed decision</strong><p>The admin refunds the client or awards the freelancer in full, with a written reason and an Explorer link in the case history.</p></div>
          </div>
        </div>
      </section>
      <section className="shell" style={{ paddingBlock: "56px 24px" }}>
        <div className="splitIntro"><div><span className="eyebrow">Browse by category</span><h2>Work that ships.</h2></div><Link className="button ghost" href="/projects">All projects</Link></div>
        <div className="catGrid">
          {categories.map(([name, blurb]) => <Link className="catCard" key={name} href={`/projects?category=${encodeURIComponent(name)}`}><strong>{name}</strong><span>{blurb}</span></Link>)}
        </div>
      </section>
      {featured.length ? (
        <section className="shell" style={{ paddingBlock: "40px 24px" }}>
          <div className="splitIntro"><div><span className="eyebrow">Open now</span><h2>Fresh projects.</h2></div></div>
          <div className="listingStack" style={{ marginTop: 24 }}>{featured.map((project) => <ProjectCard project={project} key={project.id} />)}</div>
        </section>
      ) : null}
      <section id="faq" className="shell narrowPage" style={{ paddingBlock: "72px 0" }}>
        <span className="eyebrow">FAQ</span><h2>Questions, answered plainly.</h2>
        <div style={{ marginTop: 24 }}>{faq.map(([q, a]) => <details className="faq" key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
      </section>
      <section className="shell" style={{ paddingBlock: "72px 0" }}>
        <div className="ctaBand"><Logo onDark size={44} /><h2>Start with a wallet. Finish with a payment.</h2><div className="actions" style={{ margin: 0 }}><Link className="button lime big" href="/connect">Connect wallet</Link><Link className="button wline big" href="/projects">Browse projects</Link></div></div>
      </section>
      <SiteFooter />
    </main>
  );
}

export const dynamic = "force-dynamic";
