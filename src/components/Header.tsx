import { ConnectKitButton } from 'connectkit'
import { Briefcase, Gavel, LayoutList, PlusCircle } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { useAccount } from 'wagmi'
import { formatUnitsFixed } from '@/onchain-money'
import { USDC_DECIMALS_ON_CHAIN, shortAddr } from '@/lib/jobba'
import { useUsdcBalance } from '@/hooks/useJobba'
import type { Route, View } from '@/hooks/useRoute'

const TABS: { view: View; label: string; icon: typeof Briefcase }[] = [
  { view: 'browse', label: 'Browse', icon: LayoutList },
  { view: 'post', label: 'Post a project', icon: PlusCircle },
  { view: 'mine', label: 'My work', icon: Briefcase },
  { view: 'admin', label: 'Disputes', icon: Gavel },
]

export function Header({ route, go }: { route: Route; go: (r: Route) => void }) {
  const { address } = useAccount()
  const balance = useUsdcBalance(address)

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <button onClick={() => go({ view: 'browse' })} className="flex items-center gap-2" aria-label="Jobba home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy font-display text-lg font-bold text-white">J</span>
          <span className="font-display text-xl font-bold tracking-tight">Jobba</span>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {TABS.map(({ view, label }) => {
            const active = route.view === view && route.jobId === undefined
            return (
              <button
                key={view}
                onClick={() => go({ view })}
                className={`min-h-[44px] rounded-full px-4 text-sm font-medium transition ${
                  active ? 'bg-white text-ink shadow-sm' : 'text-mute hover:text-ink'
                }`}
              >
                {label}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          {address && balance !== undefined && (
            <span className="tnum hidden items-center gap-1.5 rounded-full border border-line bg-white/70 px-3 py-2 text-sm font-semibold sm:inline-flex">
              <TokenUSDC variant="branded" size={16} />
              {formatUnitsFixed(balance, USDC_DECIMALS_ON_CHAIN, 2)}
            </span>
          )}
          <ConnectKitButton.Custom>
            {({ isConnected, show, address: a }) => (
              <button onClick={show} className="btn-primary">
                {isConnected && a ? shortAddr(a) : 'Connect wallet'}
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </div>

      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {TABS.map(({ view, label, icon: Icon }) => {
          const active = route.view === view && route.jobId === undefined
          return (
            <button
              key={view}
              onClick={() => go({ view })}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium ${
                active ? 'bg-white text-ink shadow-sm' : 'text-mute'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
