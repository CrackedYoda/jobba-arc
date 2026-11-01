import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { jobbaAbi } from '@/contracts/jobbaAbi'
import { CATEGORIES, CHAIN_ID, ESCROW_ADDRESS } from '@/lib/jobba'
import { parseUsdc } from '@/onchain-money'
import { useTx } from '@/hooks/useJobba'
import { Field, Spinner } from './ui'

export function PostJob({ onDone }: { onDone: () => void }) {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const { send, pending } = useTx()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState('')

  let budgetRaw = 0n
  try {
    budgetRaw = budget ? parseUsdc(budget) : 0n
  } catch {
    budgetRaw = 0n
  }
  const valid = title.trim().length > 0 && description.trim().length > 0 && budgetRaw > 0n

  const submit = async () => {
    const ok = await send('Project posted', () =>
      writeContractAsync({
        address: ESCROW_ADDRESS,
        abi: jobbaAbi,
        functionName: 'postJob',
        args: [title.trim(), category, description.trim(), budgetRaw],
        chainId: CHAIN_ID,
      }),
    )
    if (ok) onDone()
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">Post a project</h1>
        <p className="mt-2 text-pretty text-mute">
          Describe the work and your maximum budget. You only fund the escrow when you accept a proposal.
        </p>
      </div>
      <div className="card space-y-5 p-6">
        <Field label="Title">
          <input className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Landing page redesign" />
        </Field>
        <Field label="Category">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Description">
          <textarea className="input min-h-[140px] resize-y" maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Scope, deliverables, and anything a freelancer should know." />
        </Field>
        <Field label="Maximum budget (USDC)" hint="Freelancers can bid up to this amount. Payment is a single fixed price.">
          <input className="input tnum" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="500.00" />
        </Field>
        <button className="btn-primary w-full" disabled={!valid || !!pending || !address} onClick={() => void submit()}>
          {pending ? <Spinner label={pending} /> : address ? 'Post project' : 'Connect a wallet to post'}
        </button>
      </div>
    </div>
  )
}
