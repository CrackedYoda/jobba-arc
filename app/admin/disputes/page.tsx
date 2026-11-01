import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/marketplace/site-footer";
import { SiteHeader } from "@/components/marketplace/site-header";
import { AdminDisputeList } from "@/features/disputes/admin-dispute-list";
import { getViewer } from "@/server/marketplace/service";

export const metadata: Metadata = { title: "Disputes | Jobba admin" };

export default async function AdminDisputesPage() {
  const viewer = await getViewer();
  if (!viewer.authenticated) redirect("/connect");
  if (!viewer.roles.includes("admin")) redirect("/dashboard");
  return (
    <>
      <SiteHeader active="admin" />
      <main className="shell pageSection">
        <header className="dashboardHeader"><div><span className="eyebrow">Escrow operations</span><h1>Resolve disputes with a clear <em>audit trail.</em></h1><p className="lead">Review contract terms and submitted evidence before preparing an irreversible devnet settlement.</p></div></header>
        <AdminDisputeList />
      </main>
      <SiteFooter />
    </>
  );
}

export const dynamic = "force-dynamic";
