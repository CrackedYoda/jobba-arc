import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useAccount } from 'wagmi'
import { addressUrl } from '@/lib/chain'
import { JobStatus, isZero, sameAddr, shortAddr, timeAgo, usd } from '@/lib/jobba'
import { useJob } from '@/hooks/useJobba'
import { Avatar, Chip, Empty, Spinner, StatusBadge } from './ui'
import { Proposals } from './Proposals'
import { EscrowPanel } from './EscrowPanel'
import { Thread } from './Thread'

export function JobDetail({ jobId, onBack }: { jobId: bigint; onBack: () => void }) {
  const { address } = useAccount()
  const { job, isLoading, error } = useJob(jobId)

  if (isLoading) return <div className="card flex justify-center p-14 text-mute"><Spinner label="Loading project" /></div>
  if (error || !job) {
    return <Empty title="Project not found" body="This project does not exist onchain." action={<button className="btn-primary" onClick={onBack}>Back to browse</button>} />
  }

  const role = sameAddr(address, job.client) ? 'You are the client' : sameAddr(address, job.freelancer) ? 'You are the freelancer' : null
  const hasFreelancer = !isZero(job.freelancer)

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-mute hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={job.status} />
              <Chip>{job.category}</Chip>
              {role && <Chip>{role}</Chip>}
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-[-0.03em] text-balance">{job.title}</h1>
            <p className="mt-4 whitespace-pre-wrap text-pretty text-[15px] leading-relaxed">{job.description}</p>
            <dl className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
              <div>
                <dt className="label">Client</dt>
                <dd className="flex items-center gap-2"><Avatar address={job.client} />
                  <a className="tnum inline-flex items-center gap-1 text-sm font-medium hover:underline" href={addressUrl(job.client)} target="_blank" rel="noopener noreferrer">
                    {shortAddr(job.client)}<ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
              <div>
                <dt className="label">Freelancer</dt>
                <dd className="text-sm font-medium">
                  {hasFreelancer ? (
                    <span className="flex items-center gap-2"><Avatar address={job.freelancer} /><span className="tnum">{shortAddr(job.freelancer)}</span></span>
                  ) : 'Not hired yet'}
                </dd>
              </div>
              <div>
                <dt className="label">Posted</dt>
                <dd className="text-sm font-medium">{timeAgo(job.createdAt)}</dd>
              </div>
            </dl>
            {job.status === JobStatus.Open && (
              <p className="tnum mt-4 text-sm text-mute">Budget up to <span className="font-semibold text-ink">{usd(job.budget)}</span> USDC</p>
            )}
          </section>

          {job.status === JobStatus.Open && <Proposals job={job} />}
          <Thread job={job} />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <EscrowPanel job={job} />
        </aside>
      </div>
    </div>
  )
}
