import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { CATEGORIES, JobStatus } from '@/lib/jobba'
import { useJobs } from '@/hooks/useJobba'
import { JobCard } from './JobCard'
import { Empty, Spinner } from './ui'

export function Browse({ onOpen, onPost }: { onOpen: (id: bigint) => void; onPost: () => void }) {
  const { jobs, isLoading, error } = useJobs()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [openOnly, setOpenOnly] = useState(true)

  const filtered = useMemo(
    () =>
      jobs.filter((j) => {
        if (openOnly && j.status !== JobStatus.Open) return false
        if (category !== 'All' && j.category !== category) return false
        const q = query.trim().toLowerCase()
        return !q || j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q)
      }),
    [jobs, query, category, openOnly],
  )

  return (
    <div className="space-y-6">
      <section className="card relative overflow-hidden p-6 sm:p-10">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-steel via-white to-steel" />
        <p className="label">Freelance marketplace on Arc</p>
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-balance sm:text-5xl">
          Hire and get paid in USDC, held safely in escrow.
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-mute">
          Clients fund fixed-price projects. Freelancers deliver. Funds release when the work is approved, and an
          arbiter steps in if there is a dispute.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={onPost} className="btn-primary">Post a project</button>
          <button onClick={() => setOpenOnly(true)} className="btn-ghost">Find work</button>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
          <input
            className="input pl-11"
            placeholder="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="h-4 w-4 accent-[#1B3158]" />
          Open for proposals only
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['All', ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`min-h-[40px] shrink-0 rounded-full border px-4 text-sm font-medium transition ${
              category === c ? 'border-navy bg-navy text-white' : 'border-line bg-white/60 text-mute hover:text-ink'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card flex justify-center p-14 text-mute"><Spinner label="Loading projects" /></div>
      ) : error ? (
        <Empty title="Could not load projects" body="The Arc Testnet RPC did not respond. Refresh in a moment." />
      ) : filtered.length === 0 ? (
        <Empty
          title={jobs.length === 0 ? 'No projects yet' : 'No projects match'}
          body={jobs.length === 0 ? 'Be the first to post a project and fund it in USDC.' : 'Try a different search or category.'}
          action={<button onClick={onPost} className="btn-primary">Post a project</button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((j) => (
            <JobCard key={j.id.toString()} job={j} onOpen={() => onOpen(j.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
