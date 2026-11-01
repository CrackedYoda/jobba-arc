import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { DevnetBanner } from "@/components/marketplace/devnet-banner";
import { SignOutButton } from "@/features/auth/wallet-sign-in";
import { getViewer, shortKey } from "@/server/marketplace/service";

function initials(name: string | undefined, fallback: string): string {
  const source = (name ?? fallback).replace(/^Wallet\s+/, "");
  const letters = source.split(/\s+/).map((part) => part[0]).join("").slice(0, 2);
  return letters.toUpperCase();
}

export async function SiteHeader({ active }: { active?: "work" | "talent" | "dashboard" | "contracts" | "admin" }) {
  const viewer = await getViewer();
  const link = (key: string, href: string, label: string) => (
    <Link href={href} aria-current={active === key ? "page" : undefined} className={active === key ? "on" : undefined}>{label}</Link>
  );
  return (
    <>
      <DevnetBanner />
      <header className="marketHeader">
        <nav className="shell marketNav" aria-label="Primary">
          <Logo />
          <div className="marketNavLinks">
            {link("work", "/projects", "Find work")}
            {link("talent", "/freelancers", "Find talent")}
            {viewer.authenticated ? link("dashboard", "/dashboard", "Dashboard") : null}
            {viewer.roles.includes("client") || !viewer.authenticated ? <Link className="mobileOnly" href="/projects/new">Post a project</Link> : null}
            {viewer.roles.includes("admin") ? link("admin", "/admin/disputes", "Disputes") : null}
          </div>
          <div className="headerActions">
            {viewer.roles.includes("freelancer") && !viewer.roles.includes("client") ? null : <Link className="button ghost compactButton" href="/projects/new">Post a project</Link>}
            {viewer.authenticated && viewer.walletAddress ? (
              <>
                <Link className="walletPill" href="/dashboard" aria-label="Open dashboard"><i aria-hidden="true" />{shortKey(viewer.walletAddress)}<b>{initials(viewer.displayName, viewer.walletAddress)}</b></Link>
                <SignOutButton />
              </>
            ) : <Link className="button primary compactButton" href="/connect">Connect wallet</Link>}
          </div>
        </nav>
      </header>
    </>
  );
}
