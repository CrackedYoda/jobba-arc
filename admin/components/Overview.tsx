import { TokenUSDC } from '@web3icons/react'
import { addressUrl } from '@/lib/chain'
import { ESCROW_ADDRESS, JobStatus, feeOf, shortAddr, usd } from '@/lib/jobba'
import { useJobs } from '@/hooks/useJobba'
import type { useAdminState } from '../hooks/useAdminState'

type Admin = ReturnType<typeof useAdminState>

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-inner p-4">
      <p className="label !mb-1">{label}</p>
      <p className="tnum font-display text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-mute">{sub}</p>}
    </div>
  )
}

export function Overview({ admin }: { admin: Admin }) {
  const { jobs } = useJobs()
  const held = new Set<number>([JobStatus.Funded, JobStatus.Active, JobStatus.Delivered, JobStatus.Disputed])
  const settled = new Set<number>([JobStatus.Released, JobStatus.Awarded])

  const escrowed = jobs.filter((j) => held.has(j.status)).reduce((a, j) => a + j.escrowAmount, 0n)
  const volume = jobs.filter((j) => settled.has(j.status)).reduce((a, j) => a + j.escrowAmount, 0n)
  const fees = jobs.filter((j) => settled.has(j.status)).reduce((a, j) => a + feeOf(j.escrowAmount, j.feeBps), 0n)
  const disputes = jobs.filter((j) => j.status === JobStatus.Disputed).length
  const open = jobs.filter((j) => j.status === JobStatus.Open).length

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">Overview</h2>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${admin.paused ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
          {admin.paused ? 'Funding paused' : 'Funding live'}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Held in escrow" value={usd(escrowed)} sub="Funded, active, delivered, disputed" />
        <Stat label="Settled volume" value={usd(volume)} sub="Released and awarded" />
        <Stat label="Fees earned" value={usd(fees)} sub="Calculated from settled jobs" />
        <Stat label="Needs attention" value={`${disputes}`} sub={`${open} open projects`} />
      </div>
      <dl className="card-inner grid gap-3 p-4 text-sm sm:grid-cols-2">
        <Row label="Contract" value={ESCROW_ADDRESS} href={addressUrl(ESCROW_ADDRESS)} />
        <Row label="Owner" value={admin.owner} href={admin.owner ? addressUrl(admin.owner) : undefined} />
        <Row label="Treasury" value={admin.treasury} href={admin.treasury ? addressUrl(admin.treasury) : undefined} />
        <div>
          <dt className="label">Platform fee</dt>
          <dd className="tnum inline-flex items-center gap-1.5 font-semibold">
            <TokenUSDC variant="branded" size={14} />
            {(admin.feeBps / 100).toFixed(2)}% (max {(admin.maxFeeBps / 100).toFixed(0)}%)
          </dd>
        </div>
      </dl>
    </section>
  )
}

function Row({ label, value, href }: { label: string; value?: string; href?: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="tnum font-semibold">
        {value && href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline" title={value}>{shortAddr(value)}</a>
        ) : '...'}
      </dd>
    </div>
  )
}
