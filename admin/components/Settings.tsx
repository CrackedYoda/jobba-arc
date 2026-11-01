import { useState, type ReactNode } from 'react'
import { isAddress } from 'viem'
import { useWriteContract } from 'wagmi'
import { jobbaAbi } from '@/contracts/jobbaAbi'
import { CHAIN_ID, ESCROW_ADDRESS } from '@/lib/jobba'
import { useTx } from '@/hooks/useJobba'
import { Field, Spinner } from '@/components/ui'
import type { useAdminState } from '../hooks/useAdminState'

type Admin = ReturnType<typeof useAdminState>
const base = { address: ESCROW_ADDRESS, abi: jobbaAbi, chainId: CHAIN_ID } as const

function Panel({ title, body, locked, children }: { title: string; body: string; locked: boolean; children: ReactNode }) {
  return (
    <div className={`card space-y-4 p-5 ${locked ? 'opacity-70' : ''}`}>
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-pretty text-sm text-mute">{body}</p>
      </div>
      {children}
    </div>
  )
}

function FeePanel({ admin }: { admin: Admin }) {
  const { writeContractAsync } = useWriteContract()
  const { send, pending } = useTx()
  const [pct, setPct] = useState('')
  const num = Number(pct)
  const bps = Math.round(num * 100)
  const valid = pct !== '' && /^\d+(\.\d{1,2})?$/.test(pct) && bps >= 0 && bps <= admin.maxFeeBps && bps !== admin.feeBps

  return (
    <Panel title="Platform fee" body="Taken from the freelancer's payout only. Jobs keep the fee that applied when they were funded." locked={!admin.isOwner}>
      <Field label="New fee (%)" hint={`Currently ${(admin.feeBps / 100).toFixed(2)}%. Maximum ${(admin.maxFeeBps / 100).toFixed(0)}%.`}>
        <input className="input tnum" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="2.5" />
      </Field>
      <button className="btn-primary w-full" disabled={!admin.isOwner || !valid || !!pending}
        onClick={() => { void send('Fee updated', () => writeContractAsync({ ...base, functionName: 'setFeeBps', args: [bps] })).then((ok) => ok && setPct('')) }}>
        {pending ? <Spinner label={pending} /> : 'Update fee'}
      </button>
    </Panel>
  )
}

function TreasuryPanel({ admin }: { admin: Admin }) {
  const { writeContractAsync } = useWriteContract()
  const { send, pending } = useTx()
  const [addr, setAddr] = useState('')
  const valid = isAddress(addr) && addr.toLowerCase() !== admin.treasury?.toLowerCase() && !/^0x0{40}$/i.test(addr)

  return (
    <Panel title="Treasury" body="Wallet that receives platform fees. It cannot be cleared once set." locked={!admin.isOwner}>
      <Field label="New treasury address">
        <input className="input tnum" value={addr} onChange={(e) => setAddr(e.target.value.trim())} placeholder="0x..." spellCheck={false} />
      </Field>
      <button className="btn-primary w-full" disabled={!admin.isOwner || !valid || !!pending}
        onClick={() => { void send('Treasury updated', () => writeContractAsync({ ...base, functionName: 'setTreasury', args: [addr as `0x${string}`] })).then((ok) => ok && setAddr('')) }}>
        {pending ? <Spinner label={pending} /> : 'Update treasury'}
      </button>
    </Panel>
  )
}

function PausePanel({ admin }: { admin: Admin }) {
  const { writeContractAsync } = useWriteContract()
  const { send, pending } = useTx()
  return (
    <Panel title="Pause new funding" body="Stops clients from funding new escrows. Deliveries, releases, refunds, disputes and withdrawals keep working." locked={!admin.isOwner}>
      <button className={admin.paused ? 'btn-primary w-full' : 'btn-danger w-full'} disabled={!admin.isOwner || !!pending}
        onClick={() => { void send(admin.paused ? 'Funding resumed' : 'Funding paused', () => writeContractAsync({ ...base, functionName: admin.paused ? 'unpause' : 'pause' })) }}>
        {pending ? <Spinner label={pending} /> : admin.paused ? 'Resume funding' : 'Pause funding'}
      </button>
    </Panel>
  )
}

function ArbiterPanel({ admin }: { admin: Admin }) {
  const { writeContractAsync } = useWriteContract()
  const { send, pending } = useTx()
  const [addr, setAddr] = useState('')
  const valid = isAddress(addr)
  const set = (allowed: boolean) =>
    send(allowed ? 'Arbiter added' : 'Arbiter removed', () =>
      writeContractAsync({ ...base, functionName: 'setArbiter', args: [addr as `0x${string}`, allowed] }),
    ).then((ok) => ok && setAddr(''))

  return (
    <Panel title="Arbiters" body="Arbiters rule on disputes. A wallet that is a party to a job cannot rule on it." locked={!admin.isOwner}>
      <Field label="Wallet address">
        <input className="input tnum" value={addr} onChange={(e) => setAddr(e.target.value.trim())} placeholder="0x..." spellCheck={false} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary" disabled={!admin.isOwner || !valid || !!pending} onClick={() => { void set(true) }}>Add arbiter</button>
        <button className="btn-ghost" disabled={!admin.isOwner || !valid || !!pending} onClick={() => { void set(false) }}>Remove</button>
      </div>
    </Panel>
  )
}

function OwnershipPanel({ admin }: { admin: Admin }) {
  const { writeContractAsync } = useWriteContract()
  const { send, pending } = useTx()
  const [addr, setAddr] = useState('')
  const valid = isAddress(addr) && addr.toLowerCase() !== admin.owner?.toLowerCase()

  return (
    <Panel title="Ownership" body="Transfers are two steps: the current owner nominates, then the new wallet accepts." locked={!admin.isOwner && !admin.isPendingOwner}>
      {admin.pendingOwner && (
        <p className="card-inner tnum p-3 text-xs">Pending owner: {admin.pendingOwner}</p>
      )}
      {admin.isPendingOwner && (
        <button className="btn-primary w-full" disabled={!!pending}
          onClick={() => { void send('Ownership accepted', () => writeContractAsync({ ...base, functionName: 'acceptOwnership' })) }}>
          {pending ? <Spinner label={pending} /> : 'Accept ownership'}
        </button>
      )}
      <Field label="Nominate new owner">
        <input className="input tnum" value={addr} onChange={(e) => setAddr(e.target.value.trim())} placeholder="0x..." spellCheck={false} />
      </Field>
      <button className="btn-ghost w-full" disabled={!admin.isOwner || !valid || !!pending}
        onClick={() => { void send('Owner nominated', () => writeContractAsync({ ...base, functionName: 'transferOwnership', args: [addr as `0x${string}`] })).then((ok) => ok && setAddr('')) }}>
        Nominate
      </button>
    </Panel>
  )
}

export function Settings({ admin }: { admin: Admin }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">Platform settings</h2>
        {!admin.isOwner && (
          <p className="mt-1 text-sm text-mute">Only the contract owner can change these. Connect the owner wallet to enable the controls.</p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FeePanel admin={admin} />
        <TreasuryPanel admin={admin} />
        <PausePanel admin={admin} />
        <ArbiterPanel admin={admin} />
        <OwnershipPanel admin={admin} />
      </div>
    </section>
  )
}
