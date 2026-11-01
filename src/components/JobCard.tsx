import { ArrowUpRight } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { formatUnitsFixed } from '@/onchain-money'
import { USDC_DECIMALS_ON_CHAIN, shortAddr, timeAgo, type Job } from '@/lib/jobba'
import { Avatar, Chip, StatusBadge } from './ui'

export function JobCard({ job, onOpen }: { job: Job; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="card group flex w-full flex-col gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:bg-white">
      <div className="flex items-start justify-between gap-3">
        <StatusBadge status={job.status} />
        <ArrowUpRight className="h-4 w-4 text-mute transition group-hover:text-ink" />
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold leading-snug tracking-tight text-balance">{job.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-pretty text-sm text-mute">{job.description}</p>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Avatar address={job.client} />
          <div className="leading-tight">
            <p className="tnum text-xs font-medium">{shortAddr(job.client)}</p>
            <p className="text-[11px] text-mute">{timeAgo(job.createdAt)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="tnum inline-flex items-center gap-1 font-display text-xl font-bold tracking-tight">
            <TokenUSDC variant="branded" size={18} />
            {formatUnitsFixed(job.budget, USDC_DECIMALS_ON_CHAIN, 2)}
          </p>
          <Chip>{job.category}</Chip>
        </div>
      </div>
    </button>
  )
}
