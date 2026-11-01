import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/marketplace/site-footer";
import { SiteHeader } from "@/components/marketplace/site-header";
import { ProposalComposer } from "@/features/proposals/proposal-composer";
import { ProposalList } from "@/features/proposals/proposal-list";
import { findMyProposal, getProject, getViewer, listProjectProposals, shortKey } from "@/server/marketplace/service";

export const metadata: Metadata = { title: "Project details | Jobba" };

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [project, viewer] = await Promise.all([getProject(projectId), getViewer()]);
  if (!project) notFound();
  const isOwner = viewer.profileId === project.clientId;
  const isFreelancer = viewer.roles.includes("freelancer");
  const proposals = isOwner ? await listProjectProposals(projectId) : [];
  const mine = viewer.profileId && !isOwner ? await findMyProposal(projectId, viewer.profileId) : undefined;
  return (
    <>
      <SiteHeader active="work" />
      <main className="shell pageSection">
        <nav className="crumbs" aria-label="Breadcrumb"><Link href="/projects">Find work</Link> / {project.category} / <span>{project.title}</span></nav>
        <div className="detailLayout">
          <article className="detailContent">
            <div className="detailTitle">
              <div className="pillRow"><span className={`chip ${project.status}`}>{project.status.toUpperCase()}</span><span className="muted">Posted {project.postedAt} · {project.proposals} proposals</span></div>
              <h1>{project.title}</h1>
            </div>
            <div className="factGrid">
              <div><span>Fixed budget</span><strong className="mono">{project.budgetUsdc} USDC</strong></div>
              <div><span>Delivery</span><strong>{project.deliveryDays} days</strong></div>
              <div><span>Payment</span><strong>Escrow · 1 milestone</strong></div>
            </div>
            <section className="workspacePanel">
              <h2>About the project</h2>
              <p className="prose">{project.description}</p>
              <h3>Skills</h3>
              <div className="tagRow">{project.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
            </section>
            <section className="workspacePanel clientCard">
              <span className="avatarSq">{project.client.name[0]}</span>
              <div><strong>{project.client.name}</strong> <span className="chip open" style={{ height: 24 }}>Wallet verified</span><br /><span className="muted">{project.client.location} · {project.client.projectsFunded} projects funded through escrow</span></div>
              <span className="mono muted">{shortKey(project.client.wallet)}</span>
            </section>
            <section className="escrowPromise"><strong>How payment works</strong><p>If your proposal is selected, the client funds your price into escrow first. You accept only after you can see the funded vault.</p></section>
            {isOwner ? <section className="workspacePanel"><h2>Proposals ({proposals.length})</h2><ProposalList proposals={proposals} canSelect={project.status === "open"} /></section> : null}
          </article>
          <aside className="detailRail">
            {isOwner ? (
              <div className="composerBox"><h2>Your project</h2><p className="muted">Select a proposal to create the contract and fund escrow. Funding needs one wallet signature.</p><dl className="kv"><div><dt>Proposals</dt><dd>{project.proposals}</dd></div><div><dt>Budget</dt><dd className="mono">{project.budgetUsdc} USDC</dd></div></dl></div>
            ) : !viewer.authenticated ? (
              <div className="composerBox"><h2>Send a proposal</h2><p className="muted">Connect a wallet and sign in to propose on this project.</p><Link className="button primary wide" href="/connect">Connect wallet</Link></div>
            ) : !isFreelancer ? (
              <div className="composerBox"><h2>Send a proposal</h2><p className="muted">Add the freelancer role to your profile to propose.</p><Link className="button primary wide" href="/onboarding">Update profile</Link></div>
            ) : project.status !== "open" ? (
              <div className="composerBox"><h2>Not accepting proposals</h2><p className="muted">This project is {project.status}.</p></div>
            ) : (
              <ProposalComposer projectId={project.id} budgetUsdc={project.budgetUsdc} defaultDays={project.deliveryDays} existing={mine ? { id: mine.id, status: mine.status, amountUsdc: mine.amountUsdc, deliveryDays: mine.deliveryDays, coverLetter: mine.coverLetter } : undefined} />
            )}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export const dynamic = "force-dynamic";
