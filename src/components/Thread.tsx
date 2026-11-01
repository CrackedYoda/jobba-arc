import { useState } from 'react'
import { Send } from 'lucide-react'
import { useAccount, useWriteContract } from 'wagmi'
import { jobbaAbi } from '@/contracts/jobbaAbi'
import { CHAIN_ID, ESCROW_ADDRESS, JobStatus, PostKind, sameAddr, shortAddr, timeAgo, type Job } from '@/lib/jobba'
import { useIsArbiter, usePosts, useTx } from '@/hooks/useJobba'
import { Avatar, Spinner } from './ui'

const KIND_LABEL: Record<number, string> = {
  [PostKind.Deliverable]: 'Delivery',
  [PostKind.Evidence]: 'Evidence',
  [PostKind.Revision]: 'Revision request',
}

export function Thread({ job }: { job: Job }) {
  const { address } = useAccount()
  const { posts } = usePosts(job.id)
  const isArbiter = useIsArbiter(address)
  const { writeContractAsync } = useWriteContract()
  const { send, pending } = useTx()
  const [body, setBody] = useState('')

  const isParty = sameAddr(address, job.client) || sameAddr(address, job.freelancer)
  const canPost =
    job.status !== JobStatus.Open &&
    job.status !== JobStatus.Cancelled &&
    (isParty || (isArbiter && job.status === JobStatus.Disputed))

  const post = async () => {
    const ok = await send('Message sent', () =>
      writeContractAsync({
        address: ESCROW_ADDRESS, abi: jobbaAbi, functionName: 'postMessage',
        args: [job.id, body.trim()], chainId: CHAIN_ID,
      }),
    )
    if (ok) setBody('')
  }

  if (job.status === JobStatus.Open || job.status === JobStatus.Cancelled) return null

  return (
    <section className="card flex flex-col p-5">
      <h2 className="font-display text-xl font-semibold tracking-tight">Project thread</h2>
      <p className="mt-1 text-xs text-mute">Messages are stored onchain and visible to anyone. Do not share private information.</p>

      <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
        {posts.length === 0 && <p className="text-sm text-mute">No messages yet. Say hello to start.</p>}
        {posts.map((p, i) => {
          const mine = sameAddr(p.author, address)
          const role = sameAddr(p.author, job.client) ? 'Client' : sameAddr(p.author, job.freelancer) ? 'Freelancer' : 'Arbiter'
          const tag = KIND_LABEL[p.kind]
          return (
            <div key={i} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
              <Avatar address={p.author} />
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-navy text-white' : 'border border-line bg-white/80'}`}>
                <p className={`mb-1 text-[11px] ${mine ? 'text-white/70' : 'text-mute'}`}>
                  {role} <span className="tnum">{shortAddr(p.author)}</span> · {timeAgo(p.timestamp)}
                  {tag && <span className="ml-1.5 rounded-full bg-steel/50 px-1.5 py-0.5 font-semibold text-navy">{tag}</span>}
                </p>
                <p className="whitespace-pre-wrap break-words text-pretty">{p.body}</p>
              </div>
            </div>
          )
        })}
      </div>

      {canPost && (
        <div className="mt-4 flex gap-2">
          <input
            className="input"
            maxLength={2000}
            placeholder="Write a message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && body.trim() && !pending) void post() }}
          />
          <button className="btn-primary px-4" aria-label="Send message" disabled={!body.trim() || !!pending} onClick={() => void post()}>
            {pending ? <Spinner /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      )}
    </section>
  )
}
