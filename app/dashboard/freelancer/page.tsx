import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/marketplace/dashboard-shell";
import { StatusChip } from "@/components/marketplace/status-chip";
import { freelancerDashboard, getViewer } from "@/server/marketplace/service";

export const metadata: Metadata = { title: "Freelancer dashboard | Jobba" };

export default async function FreelancerDashboardPage() {
  const viewer = await getViewer();
  if (!viewer.authenticated) redirect("/connect");
  if (!viewer.roles.includes("freelancer")) redirect("/onboarding");
  const data = await freelancerDashboard(viewer.profileId!);
  return (
    <DashboardShell viewer={viewer} active="freelancer">
      <header className="dashboardHeader"><div><p className="eyebrow">Freelancer workspace</p><h1>Work worth <em>winning.</em></h1></div><Link className="button primary" href="/projects">Find projects</Link></header>
      <section className="statGrid" aria-label="Summary">
        <article><span>Active contracts</span><strong>{data.activeContracts}</strong></article>
        <article><span>Pending proposals</span><strong>{data.pendingProposals}</strong></article>
        <article><span>Profile strength</span><strong>{data.profileStrength}%</strong></article>
        <article><span>Earned (released)</span><strong className="mono">{data.earnedUsdc} USDC</strong></article>
      </section>
      <section className="dashboardSection">
        <div className="sectionHeading"><div><p className="eyebrow">Contracts</p><h2>Your contracts</h2></div></div>
        {data.contracts.length ? (
          <div className="tableWrap"><table><thead><tr><th>Project</th><th>Client</th><th>Amount</th><th>Status</th></tr></thead><tbody>
            {data.contracts.map((contract) => <tr key={contract.id}><td><Link href={`/contracts/${contract.id}`}>{contract.projectTitle}</Link></td><td>{contract.counterpart}</td><td className="mono">{contract.amountUsdc} USDC</td><td><StatusChip status={contract.status} /></td></tr>)}
          </tbody></table></div>
        ) : <p className="muted">No contracts yet. When a client selects and funds your proposal it appears here.</p>}
      </section>
      <section className="dashboardSection">
        <div className="sectionHeading"><div><p className="eyebrow">Pipeline</p><h2>Recent proposals</h2></div><Link href="/projects">Find another project →</Link></div>
        {data.proposals.length ? data.proposals.map((proposal) => (
          <article className="proposalCard detailedProposal" key={proposal.id}>
            <div className="listingTopline"><StatusChip status={proposal.status} /><span className="mono">{proposal.amountUsdc} USDC · {proposal.deliveryDays} days</span></div>
            <h3><Link href={`/projects/${proposal.projectId}`}>{proposal.projectTitle}</Link></h3>
            <p>{proposal.coverLetter}</p>
            {proposal.contractId ? <Link className="button lime compactButton" href={`/contracts/${proposal.contractId}`}>Open contract</Link> : null}
          </article>
        )) : <p className="muted">You have not sent a proposal yet.</p>}
      </section>
    </DashboardShell>
  );
}

export const dynamic = "force-dynamic";
