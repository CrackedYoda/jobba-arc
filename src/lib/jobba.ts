import type { Address } from 'viem'
import { ARC_CHAIN_ID, ARC_USDC_ADDRESS, USDC_DECIMALS, formatUsdcFixed } from './chain'

export const CHAIN_ID = ARC_CHAIN_ID
export const ESCROW_ADDRESS = import.meta.env.VITE_JOBBA_ESCROW_ADDRESS as Address
export const USDC_ADDRESS: Address = ARC_USDC_ADDRESS
export const USDC_DECIMALS_ON_CHAIN = USDC_DECIMALS

export const REVIEW_PERIOD_SECONDS = 7 * 24 * 3600
export const ARBITER_TIMEOUT_SECONDS = 30 * 24 * 3600
export const MAX_REVISIONS = 3

export const CATEGORIES = [
  'Design',
  'Development',
  'Writing',
  'Marketing',
  'Video',
  'Audio',
  'Data',
  'Consulting',
] as const

export const JobStatus = {
  Open: 0,
  Funded: 1,
  Active: 2,
  Delivered: 3,
  Released: 4,
  Refunded: 5,
  Disputed: 6,
  Awarded: 7,
  Cancelled: 8,
} as const

export const PostKind = {
  Chat: 0,
  Deliverable: 1,
  Evidence: 2,
  Revision: 3,
} as const

export interface Job {
  id: bigint
  client: Address
  freelancer: Address
  budget: bigint
  escrowAmount: bigint
  createdAt: bigint
  deadline: bigint
  deliveredAt: bigint
  disputedAt: bigint
  durationDays: number
  revisions: number
  feeBps: number
  status: number
  title: string
  category: string
  description: string
}

export interface Proposal {
  freelancer: Address
  amount: bigint
  durationDays: number
  createdAt: bigint
  withdrawn: boolean
  coverLetter: string
}

export interface Post {
  author: Address
  timestamp: bigint
  kind: number
  body: string
}

export const STATUS_META: Record<number, { label: string; tone: 'blue' | 'amber' | 'green' | 'red' | 'grey' }> = {
  [JobStatus.Open]: { label: 'Open for proposals', tone: 'blue' },
  [JobStatus.Funded]: { label: 'Funded', tone: 'amber' },
  [JobStatus.Active]: { label: 'In progress', tone: 'amber' },
  [JobStatus.Delivered]: { label: 'Delivered', tone: 'amber' },
  [JobStatus.Released]: { label: 'Paid', tone: 'green' },
  [JobStatus.Refunded]: { label: 'Refunded', tone: 'grey' },
  [JobStatus.Disputed]: { label: 'In dispute', tone: 'red' },
  [JobStatus.Awarded]: { label: 'Awarded to freelancer', tone: 'green' },
  [JobStatus.Cancelled]: { label: 'Cancelled', tone: 'grey' },
}

/** Platform fee: floor(gross * bps / 10_000), same rounding as the contract. */
export const feeOf = (gross: bigint, bps: number) => (gross * BigInt(bps)) / 10_000n

export const usd = (raw: bigint) => `$${formatUsdcFixed(raw, 2)}`

export const shortAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

export const sameAddr = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

export const isZero = (a: string) => /^0x0{40}$/i.test(a)

export function timeAgo(ts: bigint): string {
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - Number(ts))
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export function countdown(targetTs: number): string {
  const secs = targetTs - Math.floor(Date.now() / 1000)
  if (secs <= 0) return 'now'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function parseTxError(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string; code?: number; name?: string }
  const msg = `${e?.shortMessage ?? ''} ${e?.message ?? ''}`.toLowerCase()
  if (msg.includes('user rejected') || msg.includes('user denied') || e?.code === 4001) return 'cancelled'
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) return 'Not enough USDC for this transaction.'
  if (msg.includes('deadlinepassed')) return 'The delivery deadline has passed.'
  if (msg.includes('deadlinenotpassed')) return 'The deadline has not passed yet.'
  if (msg.includes('reviewwindow')) return 'The review window rule blocks this action right now.'
  if (msg.includes('arbitertimeoutnotreached')) return 'The 30 day arbitration window is still running.'
  if (msg.includes('activeproposalexists')) return 'You already have an active proposal on this project.'
  if (msg.includes('unauthorized')) return 'This wallet is not allowed to do that.'
  if (msg.includes('invalidstatus')) return 'The project is not in the right state for this action.'
  if (msg.includes('revisionlimitreached')) return 'The revision limit was reached.'
  if (msg.includes('enforcedpause')) return 'New funding is paused by the platform. Try again later.'
  if (msg.includes('network') || msg.includes('timeout')) return 'Network issue. Check your connection and retry.'
  return e?.shortMessage ?? 'Transaction failed. Please try again.'
}
