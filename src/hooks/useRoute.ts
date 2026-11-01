import { useCallback, useEffect, useState } from 'react'

export type View = 'browse' | 'post' | 'mine' | 'admin'
export interface Route {
  view: View
  jobId?: bigint
}

function read(): Route {
  const p = new URLSearchParams(window.location.search)
  const job = p.get('job')
  if (job && /^\d+$/.test(job)) return { view: 'browse', jobId: BigInt(job) }
  const v = p.get('view')
  if (v === 'post' || v === 'mine' || v === 'admin') return { view: v }
  return { view: 'browse' }
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(read)

  useEffect(() => {
    const onPop = () => setRoute(read())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((next: Route) => {
    const q = next.jobId !== undefined ? `?job=${next.jobId}` : next.view === 'browse' ? '' : `?view=${next.view}`
    window.history.pushState({}, '', `${window.location.pathname}${q}`)
    setRoute(next)
    window.scrollTo({ top: 0 })
  }, [])

  return { route, go }
}
