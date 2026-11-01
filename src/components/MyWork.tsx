import { useState } from 'react'
import { useAccount } from 'wagmi'
import { JobStatus, sameAddr } from '@/lib/jobba'
import { useJobs, useJobsProposedBy } from '@/hooks/useJobba'
import { JobCard } from './JobCard'
import { Empty } from './ui'

type Tab = 'client' | 'freelancer' | 'proposals'

export function MyWork({ onOpen, onPost }: { onOpen: (id: bigint) => void; onPost: () => void }) {
  const { address } = useAccount()
  const { jobs } = useJobs()
  const proposedIds = useJobsProposedBy(address)
  const [tab, setTab] = useState<Tab>('client')

  if (!address) {
    return <Empty title="Connect your wallet" body="Your projects, contracts, and proposals appear here once you connect." />
  }

  const asClient = jobs.filter((j) => sameAddr(j.client, address))
  const asFreelancer = jobs.filter((j) => sameAddr(j.freelancer, address))
  const proposed = jobs.filter((j) => proposedIds.some((id) => id === j.id) && !sameAddr(j.freelancer, address))
  const lists: Record<Tab, typeof jobs> = { client: asClient, freelancer: asFreelancer, proposals: proposed }
  const list = lists[tab]
  const ACTIVE = new Set<number>([JobStatus.Funded, JobStatus.Delivered, JobStatus.Disputed])
  const active = (j: (typeof jobs)[number]) => ACTIVE.has(j.status)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'client', label: `Hiring (${asClient.length})` },
    { id: 'freelancer', label: `Working (${asFreelancer.length})` },
    { id: 'proposals', label: `Proposals (${proposed.length})` },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">My work</h1>
        <p className="mt-2 text-mute">
          <span className="tnum font-semibold text-ink">{asClient.filter(active).length + asFreelancer.filter(active).length}</span> active contracts
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-medium transition ${
              tab === t.id ? 'border-navy bg-navy text-white' : 'border-line bg-white/60 text-mute hover:text-ink'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty
          title="Nothing here yet"
          body={tab === 'client' ? 'Post a project to start hiring.' : tab === 'freelancer' ? 'Contracts you win show up here.' : 'Proposals you send show up here.'}
          action={tab === 'client' ? <button className="btn-primary" onClick={onPost}>Post a project</button> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((j) => <JobCard key={j.id.toString()} job={j} onOpen={() => onOpen(j.id)} />)}
        </div>
      )}
    </div>
  )
}
