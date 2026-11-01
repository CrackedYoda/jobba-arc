import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/marketplace/dashboard-shell";
import { StatusChip } from "@/components/marketplace/status-chip";
import { clientDashboard, getViewer } from "@/server/marketplace/service";

export const metadata: Metadata = { title: "Client dashboard | Jobba" };

export default async function ClientDashboardPage() {
  const viewer = await getViewer();
  if (!viewer.authenticated) redirect("/connect");
  if (!viewer.roles.includes("client")) redirect("/onboarding");
  const data = await clientDashboard(viewer.profileId!);
  return (
    <DashboardShell viewer={viewer} active="client">
      <header className="dashboardHeader"><div><p className="eyebrow">Client workspace</p><h1>Keep projects <em>moving.</em></h1></div><Link className="button primary" href="/projects/new">Post a project</Link></header>
      <section className="statGrid" aria-label="Summary">
        <article><span>Open projects</span><strong>{data.openProjects}</strong></article>
        <article><span>Active contracts</span><strong>{data.activeContracts}</strong></article>
        <article><span>Proposals to review</span><strong>{data.pendingProposals}</strong></article>
        <article><span>Protected in escrow</span><strong className="mono">{data.escrowedUsdc} USDC</strong></article>
      </section>
      <section className="dashboardSection">
        <div className="sectionHeading"><div><p className="eyebrow">Contracts</p><h2>Active and past work</h2></div></div>
        {data.contracts.length ? (
          <div className="tableWrap"><table><thead><tr><th>Project</th><th>Freelancer</th><th>Amount</th><th>Status</th></tr></thead><tbody>
            {data.contracts.map((contract) => <tr key={contract.id}><td><Link href={`/contracts/${contract.id}`}>{contract.projectTitle}</Link></td><td>{contract.counterpart}</td><td className="mono">{contract.amountUsdc} USDC</td><td><StatusChip status={contract.status} /></td></tr>)}
          </tbody></table></div>
        ) : <p className="muted">No contracts yet. Select a proposal on one of your projects to start one.</p>}
      </section>
      <section className="dashboardSection">
        <div className="sectionHeading"><div><p className="eyebrow">Projects</p><h2>Your projects</h2></div></div>
        {data.projects.length ? (
          <div className="tableWrap"><table><thead><tr><th>Project</th><th>Budget</th><th>Proposals</th><th>Status</th></tr></thead><tbody>
            {data.projects.map((project) => <tr key={project.id}><td><Link href={`/projects/${project.id}`}>{project.title}</Link></td><td className="mono">{project.budgetUsdc} USDC</td><td>{project.proposals}</td><td><StatusChip status={project.status} /></td></tr>)}
          </tbody></table></div>
        ) : <p className="muted">You have not posted a project yet.</p>}
      </section>
    </DashboardShell>
  );
}

export const dynamic = "force-dynamic";
