import { useWriteContract, useAccount } from 'wagmi'
import { jobbaAbi } from '@/contracts/jobbaAbi'
import { CHAIN_ID, ESCROW_ADDRESS, usd } from '@/lib/jobba'
import { useClaimable, useTx } from '@/hooks/useJobba'
import { useRoute } from '@/hooks/useRoute'
import { Header } from '@/components/Header'
import { Browse } from '@/components/Browse'
import { PostJob } from '@/components/PostJob'
import { JobDetail } from '@/components/JobDetail'
import { MyWork } from '@/components/MyWork'
import { Disputes } from '@/components/Disputes'
import { Spinner } from '@/components/ui'

function ClaimBanner() {
  const { address } = useAccount()
  const claimable = useClaimable(address)
  const { writeContractAsync } = useWriteContract()
  const { send, pending } = useTx()
  if (claimable === 0n) return null
  return (
    <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="text-sm">
        <span className="tnum font-semibold">{usd(claimable)}</span> USDC could not be sent directly and is waiting for you.
      </p>
      <button
        className="btn-primary"
        disabled={!!pending}
        onClick={() => {
          void send('Withdrawal', () =>
            writeContractAsync({ address: ESCROW_ADDRESS, abi: jobbaAbi, functionName: 'withdraw', chainId: CHAIN_ID }),
          )
        }}
      >
        {pending ? <Spinner label={pending} /> : 'Withdraw'}
      </button>
    </div>
  )
}

export default function App() {
  const { route, go } = useRoute()

  return (
    <div className="min-h-dvh">
      <Header route={route} go={go} />
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">
        <ClaimBanner />
        {route.jobId !== undefined ? (
          <JobDetail jobId={route.jobId} onBack={() => go({ view: 'browse' })} />
        ) : route.view === 'post' ? (
          <PostJob onDone={() => go({ view: 'browse' })} />
        ) : route.view === 'mine' ? (
          <MyWork onOpen={(id) => go({ view: 'browse', jobId: id })} onPost={() => go({ view: 'post' })} />
        ) : route.view === 'admin' ? (
          <Disputes onOpen={(id) => go({ view: 'browse', jobId: id })} />
        ) : (
          <Browse onOpen={(id) => go({ view: 'browse', jobId: id })} onPost={() => go({ view: 'post' })} />
        )}
      </main>
    </div>
  )
}
