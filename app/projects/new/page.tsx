import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/marketplace/site-footer";
import { SiteHeader } from "@/components/marketplace/site-header";
import { ProjectForm } from "@/features/projects/project-form";
import { getViewer, listCategories, listSkillOptions } from "@/server/marketplace/service";

export const metadata: Metadata = { title: "Post a project | Jobba" };

export default async function NewProjectPage() {
  const viewer = await getViewer();
  const [skills, categories] = await Promise.all([listSkillOptions(), listCategories()]);
  return (
    <>
      <SiteHeader />
      <main className="shell narrowPage pageSection">
        <div className="pageIntro"><p className="eyebrow">New project</p><h1>Give great work a <em>clear start.</em></h1><p className="lead">Set the outcome, fixed USDC budget, and delivery expectations freelancers will propose against.</p></div>
        {!viewer.authenticated ? (
          <div className="emptyState"><h2>Connect a wallet to post</h2><p>Your wallet is your account. Sign in with Solana to publish a project.</p><Link className="button primary" href="/connect">Connect wallet</Link></div>
        ) : !viewer.roles.includes("client") ? (
          <div className="emptyState"><h2>Add the client role</h2><p>Your profile is set up for freelancing only. Enable “I hire freelancers” to post projects.</p><Link className="button primary" href="/onboarding">Update profile</Link></div>
        ) : <ProjectForm skills={skills.map(({ id, name }) => ({ id, name }))} categories={categories} />}
      </main>
      <SiteFooter />
    </>
  );
}

export const dynamic = "force-dynamic";
