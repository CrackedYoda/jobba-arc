import { useAccount } from 'wagmi'
import { JobStatus, sameAddr, shortAddr, usd } from '@/lib/jobba'
import { useIsArbiter, useJobs, usePosts } from '@/hooks/useJobba'
import { Empty, StatusBadge } from './ui'
import { ResolveControl } from './EscrowPanel'
import type { Job } from '@/lib/jobba'

function DisputeRow({ job, canRule, onOpen }: { job: Job; canRule: boolean; onOpen: () => void }) {
  const { posts } = usePosts(job.id)
  const evidence = posts.filter((p) => p.kind === 2)
  return (
    <article className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <StatusBadge status={job.status} />
          <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">{job.title}</h3>
          <p className="tnum mt-1 text-xs text-mute">Client {shortAddr(job.client)} · Freelancer {shortAddr(job.freelancer)}</p>
        </div>
        <p className="tnum font-display text-2xl font-bold tracking-tight">{usd(job.escrowAmount)}</p>
      </div>
      <div className="space-y-2">
        <p className="label !mb-0">Evidence ({evidence.length})</p>
        {evidence.length === 0 && <p className="text-sm text-mute">No evidence yet.</p>}
        {evidence.slice(-4).map((p, i) => (
          <p key={i} className="card-inner whitespace-pre-wrap p-3 text-sm">
            <span className="tnum mr-2 text-xs font-semibold text-mute">
              {sameAddr(p.author, job.client) ? 'Client' : 'Freelancer'}
            </span>
            {p.body}
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <button className="btn-ghost" onClick={onOpen}>Open full thread</button>
        {canRule && <div className="flex-1"><ResolveControl job={job} /></div>}
      </div>
    </article>
  )
}

export function Disputes({ onOpen }: { onOpen: (id: bigint) => void }) {
  const { address } = useAccount()
  const isArbiter = useIsArbiter(address)
  const { jobs } = useJobs()
  const disputed = jobs.filter((j) => j.status === JobStatus.Disputed)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">Disputes</h1>
        <p className="mt-2 max-w-xl text-pretty text-mute">
          {isArbiter
            ? 'Review the evidence, then pay the freelancer or refund the client.'
            : 'Open disputes are ruled on by an arbiter. If none rules within 30 days, either party can settle automatically.'}
        </p>
      </div>
      {disputed.length === 0 ? (
        <Empty title="No open disputes" body="Everything is running smoothly." />
      ) : (
        disputed.map((j) => (
          <DisputeRow
            key={j.id.toString()}
            job={j}
            canRule={isArbiter && !sameAddr(address, j.client) && !sameAddr(address, j.freelancer)}
            onOpen={() => onOpen(j.id)}
          />
        ))
      )}
    </div>
  )
}
