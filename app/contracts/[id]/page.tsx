import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteFooter } from "@/components/marketplace/site-footer";
import { SiteHeader } from "@/components/marketplace/site-header";
import { StatusChip } from "@/components/marketplace/status-chip";
import { ChainStateCard } from "@/features/contracts/chain-state-card";
import { ContractChat } from "@/features/contracts/contract-chat";
import { EscrowActionPanel } from "@/features/contracts/escrow-action-panel";
import { SubmissionPanel } from "@/features/contracts/submission-panel";
import { ContractDisputePanel } from "@/features/disputes/contract-dispute-panel";
import { PLATFORM_FEE_BPS, fromAtomic, platformFee } from "@/lib/domain/money";
import { getContractFor, getViewer, shortKey, viewerActor } from "@/server/marketplace/service";

export const metadata: Metadata = { title: "Contract workspace | Jobba" };

const path = ["funding_pending", "funded", "active", "submitted", "released"] as const;
const pathLabels = ["Funding", "Funded", "Active", "Submitted", "Released"];

export default async function ContractWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await viewerActor();
  if (!actor) redirect("/connect");
  const [contract, viewer] = await Promise.all([getContractFor(id, actor), getViewer()]);
  if (!contract) notFound();
  const isParticipant = contract.client.id === actor.profileId || contract.freelancer.id === actor.profileId;
  const index = path.indexOf(contract.status as (typeof path)[number]);
  const gross = BigInt(contract.amountAtomic);
  const recorded = BigInt(contract.feeAtomic);
  const fee = recorded > 0n ? recorded : platformFee(gross, PLATFORM_FEE_BPS);
  const canDispute = isParticipant && ["funded", "active", "submitted"].includes(contract.status);
  const role = contract.client.id === actor.profileId ? "client" : "freelancer";
  return (
    <>
      <SiteHeader active="dashboard" />
      <main className="shell pageSection contractWorkspace">
        <nav className="crumbs" aria-label="Breadcrumb"><Link href={`/dashboard/${role}`}>Dashboard</Link> / Contract / <span>{contract.projectTitle}</span></nav>
        <header className="workspaceHero">
          <div className="pillRow"><StatusChip status={contract.status} /><span className="eyebrow">Contract workspace</span></div>
          <h1>{contract.projectTitle}</h1>
          <div className="partyRow">
            <span>Client · <b>{contract.client.name}</b> <i className="mono">{shortKey(contract.client.wallet)}</i></span>
            <span>Freelancer · <b>{contract.freelancer.name}</b> <i className="mono">{shortKey(contract.freelancer.wallet)}</i></span>
          </div>
          {index >= 0 ? (
            <ol className="stateTrack" aria-label="Contract progress">
              {pathLabels.map((label, i) => <li key={label} className={i < index ? "done" : i === index ? "now" : ""} aria-current={i === index ? "step" : undefined}><span>{label}</span></li>)}
            </ol>
          ) : null}
        </header>
        <div className="workspaceGrid">
          <div className="workspaceMain">
            <section className="workspacePanel" aria-labelledby="terms-heading">
              <span className="eyebrow">Terms</span><h2 id="terms-heading">What was agreed</h2>
              <dl className="termsList">
                <div><dt>Fixed price</dt><dd className="mono">{fromAtomic(gross)} USDC</dd></div>
                <div><dt>Platform fee{recorded > 0n ? "" : " (estimate)"}, deducted from payout</dt><dd className="mono">{fromAtomic(fee)} USDC</dd></div>
                <div><dt>Freelancer receives on release</dt><dd className="mono">{fromAtomic(gross - fee)} USDC</dd></div>
                <div><dt>Delivery target</dt><dd>{contract.deliveryDays} days</dd></div>
                <div><dt>Terms hash</dt><dd className="mono wrap">{contract.termsHash}</dd></div>
              </dl>
              <p className="prose clamp">{contract.description}</p>
              <Link className="verifiedMark" href={`/projects/${contract.projectId}`}>View original project →</Link>
            </section>
            <SubmissionPanel contractId={id} />
            <ContractChat contractId={id} />
            {canDispute ? <ContractDisputePanel contractId={id} /> : null}
            {contract.disputeId && viewer.roles.includes("admin") ? <Link className="button ghost" href={`/admin/disputes/${contract.disputeId}`}>Open admin dispute workspace</Link> : null}
          </div>
          <aside className="workspaceRail">
            <EscrowActionPanel contractId={id} />
            <ChainStateCard contractId={id} />
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export const dynamic = "force-dynamic";
