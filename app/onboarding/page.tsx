import Link from "next/link";

import { SiteFooter } from "@/components/marketplace/site-footer";
import { SiteHeader } from "@/components/marketplace/site-header";
import { ProfileEditor } from "@/features/profiles/profile-editor";
import { getViewer } from "@/server/marketplace/service";

export default async function OnboardingPage() {
  const viewer = await getViewer();
  return (
    <>
      <SiteHeader />
      <main className="shell narrowPage pageSection">
        <div className="pageIntro"><p className="eyebrow">Your profile</p><h1>Show people how you <em>work best.</em></h1><p className="lead">Choose how you use Jobba and keep your public details current.</p></div>
        {viewer.authenticated ? <ProfileEditor />
          : <div className="emptyState"><h2>Sign in to edit your profile</h2><Link className="button primary" href="/connect">Connect wallet</Link></div>}
      </main>
      <SiteFooter />
    </>
  );
}

export const dynamic = "force-dynamic";
