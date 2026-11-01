import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/marketplace/site-footer";
import { SiteHeader } from "@/components/marketplace/site-header";
import { AdminDisputeDetail } from "@/features/disputes/admin-dispute-detail";
import { getViewer } from "@/server/marketplace/service";

export const metadata: Metadata = { title: "Dispute review | Jobba admin" };

export default async function AdminDisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer.authenticated) redirect("/connect");
  if (!viewer.roles.includes("admin")) redirect("/dashboard");
  return (
    <>
      <SiteHeader active="admin" />
      <main className="shell pageSection">
        <nav className="crumbs" aria-label="Breadcrumb"><Link href="/admin/disputes">Disputes</Link> / <span>Review</span></nav>
        <header className="workspaceHero"><span className="eyebrow">Administrator review</span><h1>Evidence and escrow decision.</h1></header>
        <AdminDisputeDetail disputeId={id} />
      </main>
      <SiteFooter />
    </>
  );
}

export const dynamic = "force-dynamic";
