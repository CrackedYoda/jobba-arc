import { useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, useWriteContract } from 'wagmi'
import { jobbaAbi } from '@/contracts/jobbaAbi'
import {
  CHAIN_ID, ESCROW_ADDRESS, JobStatus, USDC_ADDRESS, sameAddr, shortAddr, timeAgo, usd, type Job,
} from '@/lib/jobba'
import { parseUsdc } from '@/lib/chain'
import { useAllowance, useProposals, useTx } from '@/hooks/useJobba'
import { Avatar, Field, Spinner } from './ui'

export function Proposals({ job }: { job: Job }) {
  const { address } = useAccount()
  const { proposals } = useProposals(job.id)
  const { writeContractAsync } = useWriteContract()
  const { send, pending } = useTx()
  const allowance = useAllowance(address)

  const isClient = sameAddr(address, job.client)
  const isOpen = job.status === JobStatus.Open
  const mine = proposals.findIndex((p) => sameAddr(p.freelancer, address) && !p.withdrawn)

  const accept = async (index: number) => {
    const p = proposals[index]
    const current = (await allowance.refetch()).data ?? 0n
    if (current < p.amount) {
      const approved = await send('USDC approval', () =>
        writeContractAsync({
          address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve',
          args: [ESCROW_ADDRESS, p.amount], chainId: CHAIN_ID,
        }),
      )
      if (!approved) return
    }
    await send('Escrow funded', () =>
      writeContractAsync({
        address: ESCROW_ADDRESS, abi: jobbaAbi, functionName: 'acceptProposal',
        args: [job.id, BigInt(index), p.amount, p.durationDays], chainId: CHAIN_ID,
      }),
    )
  }

  const withdraw = (index: number) =>
    send('Proposal withdrawn', () =>
      writeContractAsync({
        address: ESCROW_ADDRESS, abi: jobbaAbi, functionName: 'withdrawProposal',
        args: [job.id, BigInt(index)], chainId: CHAIN_ID,
      }),
    )

  const visible = proposals.map((p, i) => ({ p, i })).filter(({ p }) => !p.withdrawn)

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-semibold tracking-tight">
        Proposals <span className="tnum text-mute">({visible.length})</span>
      </h2>

      {visible.length === 0 && (
        <div className="card-inner p-5 text-sm text-mute">No proposals yet.</div>
      )}

      {visible.map(({ p, i }) => (
        <article key={i} className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Avatar address={p.freelancer} />
              <div className="leading-tight">
                <p className="tnum text-sm font-semibold">{shortAddr(p.freelancer)}</p>
                <p className="text-xs text-mute">{timeAgo(p.createdAt)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="tnum font-display text-xl font-bold tracking-tight">{usd(p.amount)}</p>
              <p className="text-xs text-mute">{p.durationDays} {p.durationDays === 1 ? 'day' : 'days'}</p>
            </div>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-pretty text-sm">{p.coverLetter}</p>
          {isOpen && (isClient || sameAddr(p.freelancer, address)) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {isClient && (
                <button className="btn-primary" disabled={!!pending} onClick={() => void accept(i)}>
                  {pending ? <Spinner label={pending} /> : `Accept and fund ${usd(p.amount)}`}
                </button>
              )}
              {sameAddr(p.freelancer, address) && (
                <button className="btn-ghost" disabled={!!pending} onClick={() => void withdraw(i)}>Withdraw</button>
              )}
            </div>
          )}
        </article>
      ))}

      {isOpen && !isClient && mine === -1 && <ProposalForm job={job} />}
    </section>
  )
}

function ProposalForm({ job }: { job: Job }) {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const { send, pending } = useTx()
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState('7')
  const [letter, setLetter] = useState('')

  let raw = 0n
  try {
    raw = amount ? parseUsdc(amount) : 0n
  } catch {
    raw = 0n
  }
  const d = Number(days)
  const valid = raw > 0n && raw <= job.budget && Number.isInteger(d) && d >= 1 && d <= 365 && letter.trim().length > 0

  const submit = async () => {
    const ok = await send('Proposal sent', () =>
      writeContractAsync({
        address: ESCROW_ADDRESS, abi: jobbaAbi, functionName: 'submitProposal',
        args: [job.id, raw, d, letter.trim()], chainId: CHAIN_ID,
      }),
    )
    if (ok) { setAmount(''); setLetter('') }
  }

  return (
    <div className="card space-y-4 p-5">
      <h3 className="font-display text-lg font-semibold tracking-tight">Send a proposal</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your price (USDC)" hint={`Up to ${usd(job.budget)}`}>
          <input className="input tnum" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="250.00" />
        </Field>
        <Field label="Delivery time (days)">
          <input className="input tnum" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))} />
        </Field>
      </div>
      <Field label="Cover letter">
        <textarea className="input min-h-[110px]" maxLength={2000} value={letter} onChange={(e) => setLetter(e.target.value)} placeholder="Why you are a good fit and how you will approach the work." />
      </Field>
      <button className="btn-primary w-full" disabled={!valid || !!pending || !address} onClick={() => void submit()}>
        {pending ? <Spinner label={pending} /> : address ? 'Send proposal' : 'Connect a wallet to apply'}
      </button>
    </div>
  )
}
