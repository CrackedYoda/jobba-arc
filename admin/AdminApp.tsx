import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { ShieldCheck } from 'lucide-react'
import { shortAddr } from '@/lib/jobba'
import { Disputes } from '@/components/Disputes'
import { Empty, Spinner } from '@/components/ui'
import { useAdminState } from './hooks/useAdminState'
import { Overview } from './components/Overview'
import { Settings } from './components/Settings'

function RoleBadge({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${on ? 'bg-navy text-white' : 'bg-stone-200/70 text-stone-500'}`}>
      {label}
    </span>
  )
}

export function AdminApp() {
  const { address } = useAccount()
  const admin = useAdminState()

  const openJob = (id: bigint) => {
    window.location.assign(`/?job=${id}`)
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white"><ShieldCheck className="h-5 w-5" /></span>
            <span className="font-display text-xl font-bold tracking-tight">Jobba Admin</span>
          </div>
          <div className="flex items-center gap-2">
            {address && (
              <span className="hidden items-center gap-1.5 sm:flex">
                <RoleBadge label="Owner" on={admin.isOwner} />
                <RoleBadge label="Arbiter" on={admin.isArbiter} />
              </span>
            )}
            <ConnectKitButton.Custom>
              {({ isConnected, show, address: a }) => (
                <button onClick={show} className="btn-primary">{isConnected && a ? shortAddr(a) : 'Connect wallet'}</button>
              )}
            </ConnectKitButton.Custom>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-6 pb-24">
        {!admin.loaded ? (
          <div className="card flex justify-center p-14 text-mute"><Spinner label="Loading platform" /></div>
        ) : (
          <>
            <Overview admin={admin} />
            {!address && (
              <Empty title="Connect the owner or an arbiter wallet" body="You can view platform stats without a wallet. Settings and rulings need the right wallet." />
            )}
            <Settings admin={admin} />
            <Disputes onOpen={openJob} />
          </>
        )}
      </main>
    </div>
  )
}
