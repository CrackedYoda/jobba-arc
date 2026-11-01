import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { useAccount, useWriteContract } from 'wagmi'
import { jobbaAbi } from '@/contracts/jobbaAbi'
import {
  ARBITER_TIMEOUT_SECONDS, CHAIN_ID, ESCROW_ADDRESS, JobStatus, MAX_REVISIONS, REVIEW_PERIOD_SECONDS,
  countdown, feeOf, sameAddr, usd, type Job,
} from '@/lib/jobba'
import { useIsArbiter, useNow, useTx } from '@/hooks/useJobba'
import { Spinner } from './ui'

function TextAction({ label, placeholder, cta, tone = 'ghost', onSubmit, busy }: {
  label: string; placeholder: string; cta: string; tone?: 'ghost' | 'danger'
  onSubmit: (text: string) => Promise<boolean>; busy: boolean
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  if (!open) {
    return <button className={tone === 'danger' ? 'btn-danger w-full' : 'btn-ghost w-full'} onClick={() => setOpen(true)}>{label}</button>
  }
  return (
    <div className="card-inner space-y-2 p-3">
      <textarea className="input min-h-[90px]" maxLength={2000} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex gap-2">
        <button className={tone === 'danger' ? 'btn-danger flex-1' : 'btn-primary flex-1'} disabled={!text.trim() || busy}
          onClick={() => { void onSubmit(text.trim()).then((ok) => { if (ok) { setText(''); setOpen(false) } }) }}>
          {busy ? <Spinner /> : cta}
        </button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

export function EscrowPanel({ job }: { job: Job }) {
  const { address } = useAccount()
  const isArbiter = useIsArbiter(address)
  const { writeContractAsync } = useWriteContract()
  const { send, pending } = useTx()

  const isClient = sameAddr(address, job.client)
  const isFreelancer = sameAddr(address, job.freelancer)
  const now = useNow()
  const deadline = Number(job.deadline)
  const reviewEnd = Number(job.deliveredAt) + REVIEW_PERIOD_SECONDS
  const staleAt = Number(job.disputedAt) + ARBITER_TIMEOUT_SECONDS
  const busy = !!pending

  const run = (label: string, submit: () => Promise<`0x${string}`>): void => {
    void send(label, submit)
  }
  const base = { address: ESCROW_ADDRESS, abi: jobbaAbi, chainId: CHAIN_ID } as const

  const s = job.status
  if (s === JobStatus.Open) {
    return isClient ? (
      <Shell job={job} note="Escrow is funded when you accept a proposal.">
        <button className="btn-ghost w-full" disabled={busy} onClick={() => run('Project cancelled', () => writeContractAsync({ ...base, functionName: 'cancelJob', args: [job.id] }))}>
          {busy ? <Spinner label={pending ?? ''} /> : 'Cancel project'}
        </button>
      </Shell>
    ) : null
  }
  if (s === JobStatus.Cancelled) return null

  const canDisputeFromWork =
    (s === JobStatus.Funded || s === JobStatus.Active) && (isClient || (isFreelancer && now <= deadline))
  const canDisputeDelivered = s === JobStatus.Delivered && (isFreelancer || (isClient && now < reviewEnd))

  return (
    <Shell job={job} note={noteFor(job, now, deadline, reviewEnd, staleAt)}>
      {s === JobStatus.Funded && isFreelancer && now <= deadline && (
        <button className="btn-primary w-full" disabled={busy} onClick={() => run('Work started', () => writeContractAsync({ ...base, functionName: 'startWork', args: [job.id] }))}>
          {busy ? <Spinner label={pending ?? ''} /> : 'Start work'}
        </button>
      )}
      {s === JobStatus.Funded && isClient && (
        <button className="btn-ghost w-full" disabled={busy} onClick={() => run('Escrow cancelled', () => writeContractAsync({ ...base, functionName: 'cancelFunded', args: [job.id] }))}>
          Cancel and refund {usd(job.escrowAmount)}
        </button>
      )}
      {s === JobStatus.Active && isFreelancer && now <= deadline && (
        <TextAction label="Submit delivery" placeholder="Link to files, repo, or a summary of what you delivered." cta="Submit delivery" busy={busy}
          onSubmit={(t) => send('Delivery submitted', () => writeContractAsync({ ...base, functionName: 'submitDelivery', args: [job.id, t] }))} />
      )}
      {(s === JobStatus.Funded || s === JobStatus.Active) && isClient && now > deadline && (
        <button className="btn-primary w-full" disabled={busy} onClick={() => run('Escrow refunded', () => writeContractAsync({ ...base, functionName: 'reclaimAfterDeadline', args: [job.id] }))}>
          Reclaim funds (deadline passed)
        </button>
      )}
      {s === JobStatus.Delivered && isClient && (
        <>
          <button className="btn-primary w-full" disabled={busy} onClick={() => run('Payment released', () => writeContractAsync({ ...base, functionName: 'approveAndRelease', args: [job.id] }))}>
            {busy ? <Spinner label={pending ?? ''} /> : `Approve and release ${usd(job.escrowAmount)}`}
          </button>
          {job.revisions < MAX_REVISIONS && now < reviewEnd && (
            <TextAction label={`Request revision (${MAX_REVISIONS - job.revisions} left)`} placeholder="What needs to change?" cta="Request revision" busy={busy}
              onSubmit={(t) => send('Revision requested', () => writeContractAsync({ ...base, functionName: 'requestRevision', args: [job.id, t] }))} />
          )}
        </>
      )}
      {s === JobStatus.Delivered && isFreelancer && now >= reviewEnd && (
        <button className="btn-primary w-full" disabled={busy} onClick={() => run('Payment claimed', () => writeContractAsync({ ...base, functionName: 'claimAfterReviewWindow', args: [job.id] }))}>
          Claim payment (review window ended)
        </button>
      )}
      {(canDisputeFromWork || canDisputeDelivered) && (
        <TextAction label="Open a dispute" tone="danger" placeholder="Explain the problem. This becomes public evidence for the arbiter." cta="Open dispute" busy={busy}
          onSubmit={(t) => send('Dispute opened', () => writeContractAsync({ ...base, functionName: 'openDispute', args: [job.id, t] }))} />
      )}
      {s === JobStatus.Disputed && (isClient || isFreelancer) && (
        <>
          <TextAction label="Add evidence" placeholder="Links, context, anything the arbiter should see." cta="Submit evidence" busy={busy}
            onSubmit={(t) => send('Evidence added', () => writeContractAsync({ ...base, functionName: 'submitEvidence', args: [job.id, t] }))} />
          {now >= staleAt && (
            <button className="btn-primary w-full" disabled={busy} onClick={() => run('Dispute settled', () => writeContractAsync({ ...base, functionName: 'resolveStaleDispute', args: [job.id] }))}>
              Settle after arbiter timeout
            </button>
          )}
        </>
      )}
      {s === JobStatus.Disputed && isArbiter && !isClient && !isFreelancer && <ResolveControl job={job} />}
    </Shell>
  )
}

function noteFor(job: Job, now: number, deadline: number, reviewEnd: number, staleAt: number): string {
  switch (job.status) {
    case JobStatus.Funded:
      return now <= deadline ? `Funded. The freelancer has ${countdown(deadline)} left to finish, and the client can still cancel for a full refund until work starts.` : 'The delivery deadline has passed.'
    case JobStatus.Active:
      return now <= deadline ? `Work is due in ${countdown(deadline)}.` : 'The delivery deadline has passed.'
    case JobStatus.Delivered:
      return now < reviewEnd ? `The client has ${countdown(reviewEnd)} to review before the freelancer can claim.` : 'The review window has ended.'
    case JobStatus.Disputed:
      return now < staleAt
        ? `Waiting for an arbiter. If none rules in ${countdown(staleAt)}, the dispute settles to the pre-dispute state: freelancer paid if work was delivered, otherwise client refunded.`
        : 'No ruling within 30 days. Either party can now settle automatically.'
    case JobStatus.Released: return 'The freelancer was paid.'
    case JobStatus.Refunded: return 'The escrow was refunded to the client.'
    case JobStatus.Awarded: return 'A dispute ruling or timeout awarded the payment to the freelancer.'
    default: return ''
  }
}

function Shell({ job, note, children }: { job: Job; note: string; children?: React.ReactNode }) {
  const held = job.status === JobStatus.Funded || job.status === JobStatus.Active || job.status === JobStatus.Delivered || job.status === JobStatus.Disputed
  const fee = feeOf(job.escrowAmount, job.feeBps)
  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-navy" />
        <h2 className="font-display text-xl font-semibold tracking-tight">Escrow</h2>
      </div>
      <div className="card-inner p-4">
        <p className="label !mb-1">{held ? 'Held in escrow' : job.status === JobStatus.Open ? 'Budget' : 'Contract value'}</p>
        <p className="tnum inline-flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
          <TokenUSDC variant="branded" size={26} />
          {usd(job.status === JobStatus.Open ? job.budget : job.escrowAmount).replace('$', '')}
        </p>
        {job.status !== JobStatus.Open && job.feeBps > 0 && (
          <p className="tnum mt-2 text-xs text-mute">
            Platform fee {(job.feeBps / 100).toString()}% ({usd(fee)}) is taken only when the freelancer is paid. Freelancer receives {usd(job.escrowAmount - fee)}.
          </p>
        )}
      </div>
      {note && <p className="text-pretty text-sm text-mute">{note}</p>}
      <div className="space-y-2">{children}</div>
    </section>
  )
}

export function ResolveControl({ job }: { job: Job }) {
  const { writeContractAsync } = useWriteContract()
  const { send, pending } = useTx()
  const fee = feeOf(job.escrowAmount, job.feeBps)
  const rule = (award: boolean) =>
    send(award ? 'Awarded to freelancer' : 'Refunded to client', () =>
      writeContractAsync({ address: ESCROW_ADDRESS, abi: jobbaAbi, functionName: 'resolveDispute', args: [job.id, award], chainId: CHAIN_ID }),
    )
  return (
    <div className="card-inner space-y-3 p-4">
      <p className="label !mb-0">Arbiter ruling</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button className="btn-primary" disabled={!!pending} onClick={() => { void rule(true) }}>
          {pending ? <Spinner /> : `Pay freelancer ${usd(job.escrowAmount - fee)}`}
        </button>
        <button className="btn-ghost" disabled={!!pending} onClick={() => { void rule(false) }}>
          Refund client {usd(job.escrowAmount)}
        </button>
      </div>
      <p className="text-xs text-mute">Awards follow the normal fee split. Refunds return the full amount.</p>
    </div>
  )
}
