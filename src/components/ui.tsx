import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { STATUS_META } from '@/lib/jobba'

const TONES = {
  blue: 'bg-steel/40 text-navy',
  amber: 'bg-amber-100 text-amber-800',
  green: 'bg-emerald-100 text-emerald-800',
  red: 'bg-red-100 text-red-700',
  grey: 'bg-stone-200/70 text-stone-600',
} as const

export function StatusBadge({ status }: { status: number }) {
  const meta = STATUS_META[status] ?? { label: 'Unknown', tone: 'grey' as const }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONES[meta.tone]}`}>
      {meta.label}
    </span>
  )
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-white/60 px-2.5 py-1 text-[11px] font-medium text-mute">
      {children}
    </span>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-mute">{hint}</p>}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </span>
  )
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
      <h3 className="font-display text-xl font-semibold tracking-tight">{title}</h3>
      <p className="max-w-sm text-pretty text-sm text-mute">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Avatar({ address }: { address: string }) {
  const hue = parseInt(address.slice(2, 8), 16) % 360
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ background: `hsl(${hue} 35% 38%)` }}
    >
      {address.slice(2, 4).toUpperCase()}
    </span>
  )
}
