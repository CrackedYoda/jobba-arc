import Link from "next/link";

import type { ProjectSummary } from "@/features/marketplace/types";

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <article className="listingCard">
      <div className="listingTopline"><span>{project.category} · {project.postedAt}</span><span>{project.proposals} proposals</span></div>
      <h3><Link href={`/projects/${project.id}`}>{project.title}</Link></h3>
      <p>{project.summary}</p>
      <div className="tagRow" aria-label="Required skills">{project.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
      <div className="listingFooter">
        <div className="listingMoney"><strong className="display">{project.budgetUsdc} <small>USDC</small></strong><span>{project.deliveryDays}-day delivery</span></div>
        <span className="verifiedMark">✓ {project.client.name} · {project.client.projectsFunded} funded</span>
      </div>
    </article>
  );
}
