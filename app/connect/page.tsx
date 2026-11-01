import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { ConnectFlow } from "@/features/auth/connect-flow";
import { getViewer } from "@/server/marketplace/service";

export const metadata: Metadata = { title: "Sign in with Solana | Jobba" };

export default async function ConnectPage() {
  const viewer = await getViewer();
  if (viewer.authenticated && viewer.roles.length > 0) redirect("/dashboard");
  return (
    <div className="connectPage">
      <aside className="connectRail">
        <Logo onDark size={36} />
        <div className="connectCopy">
          <h1>Your wallet is your account.</h1>
          <p>Connecting shows us your public key. Signing a one-time message proves you own it — no transaction, no fee, no password.</p>
        </div>
        <p className="connectNote">Devnet build. Switching wallet, account or cluster signs you out and asks for a fresh signature.</p>
      </aside>
      <main className="connectMain"><ConnectFlow initiallyAuthenticated={viewer.authenticated} /></main>
    </div>
  );
}

export const dynamic = "force-dynamic";
