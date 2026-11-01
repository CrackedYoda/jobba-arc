import Link from "next/link";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/marketplace/site-footer";
import { SiteHeader } from "@/components/marketplace/site-header";
import type { Viewer } from "@/features/marketplace/types";

export function DashboardShell({ children, active, viewer }: { children: ReactNode; active: "client" | "freelancer" | "profile"; viewer: Viewer }) {
  const links = [
    ...(viewer.roles.includes("client") ? [["client", "Client workspace", "/dashboard/client"] as const] : []),
    ...(viewer.roles.includes("freelancer") ? [["freelancer", "Freelancer workspace", "/dashboard/freelancer"] as const] : []),
    ["profile", "Profile", "/onboarding"] as const,
  ];
  return (
    <>
      <SiteHeader active="dashboard" />
      <div className="dashboardLayout shell">
        <aside className="dashboardRail">
          <p className="eyebrow">Workspace</p>
          <nav aria-label="Dashboard navigation">{links.map(([key, label, href]) => <Link className={active === key ? "active" : ""} aria-current={active === key ? "page" : undefined} href={href} key={key}>{label}</Link>)}</nav>
          <div className="networkNote"><i aria-hidden="true" /> Solana devnet</div>
        </aside>
        <main className="dashboardMain">{children}</main>
      </div>
      <SiteFooter />
    </>
  );
}
