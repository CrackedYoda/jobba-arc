import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { erc20Abi, type Address, type Hash } from 'viem'
import { toast } from 'sonner'
import { useAccount, usePublicClient, useReadContract, useSwitchChain } from 'wagmi'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { jobbaAbi } from '@/contracts/jobbaAbi'
import { CHAIN_ID, ESCROW_ADDRESS, USDC_ADDRESS, parseTxError, type Job, type Post, type Proposal } from '@/lib/jobba'

const POLL = 8000

export function useJobs() {
  const q = useReadContract({
    address: ESCROW_ADDRESS,
    abi: jobbaAbi,
    functionName: 'getJobs',
    args: [1n, 200n],
    chainId: CHAIN_ID,
    query: { refetchInterval: POLL },
  })
  const jobs = ((q.data) ?? []).slice().reverse()
  return { jobs, isLoading: q.isLoading, error: q.error }
}

export function useJob(jobId: bigint | undefined) {
  const q = useReadContract({
    address: ESCROW_ADDRESS,
    abi: jobbaAbi,
    functionName: 'getJob',
    args: jobId === undefined ? undefined : [jobId],
    chainId: CHAIN_ID,
    query: { enabled: jobId !== undefined, refetchInterval: POLL },
  })
  return { job: q.data, isLoading: q.isLoading, error: q.error }
}

export function useProposals(jobId: bigint) {
  const q = useReadContract({
    address: ESCROW_ADDRESS,
    abi: jobbaAbi,
    functionName: 'getProposals',
    args: [jobId],
    chainId: CHAIN_ID,
    query: { refetchInterval: POLL },
  })
  return { proposals: (q.data) ?? [], isLoading: q.isLoading }
}

export function usePosts(jobId: bigint) {
  const q = useReadContract({
    address: ESCROW_ADDRESS,
    abi: jobbaAbi,
    functionName: 'getPosts',
    args: [jobId, 0n, 300n],
    chainId: CHAIN_ID,
    query: { refetchInterval: 5000 },
  })
  return { posts: (q.data) ?? [], isLoading: q.isLoading }
}

export function useJobsProposedBy(address?: Address) {
  const q = useReadContract({
    address: ESCROW_ADDRESS,
    abi: jobbaAbi,
    functionName: 'jobsProposedBy',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address, refetchInterval: POLL },
  })
  return (q.data) ?? []
}

export function useClaimable(address?: Address) {
  const q = useReadContract({
    address: ESCROW_ADDRESS,
    abi: jobbaAbi,
    functionName: 'claimable',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address, refetchInterval: POLL },
  })
  return (q.data) ?? 0n
}

export function useIsArbiter(address?: Address) {
  const q = useReadContract({
    address: ESCROW_ADDRESS,
    abi: jobbaAbi,
    functionName: 'isArbiter',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  })
  return q.data === true
}

/** USDC balance in the 6-decimal ERC-20 view (the same pool as Arc's gas balance). */
export function useUsdcBalance(address?: Address) {
  const q = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address, refetchInterval: POLL },
  })
  return q.data
}

export function useAllowance(address?: Address) {
  const q = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, ESCROW_ADDRESS] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  })
  return q
}

/** Runs one wallet transaction with chain switching, receipt waiting, toasts, and cache refresh. */
export function useTx() {
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })
  const qc = useQueryClient()
  const [pending, setPending] = useState<string | null>(null)

  const send = useCallback(
    async (label: string, submit: () => Promise<Hash>): Promise<boolean> => {
      if (!address) {
        toast.error('Connect your wallet first.')
        return false
      }
      setPending(label)
      try {
        if (chainId !== CHAIN_ID) await switchChainAsync({ chainId: CHAIN_ID })
        const hash = await submit()
        setPending(`Confirming: ${label}`)
        const receipt = await publicClient?.waitForTransactionReceipt({ hash })
        if (receipt && receipt.status !== 'success') throw new Error('Transaction reverted')
        toast.success(`${label} confirmed`, {
          action: { label: 'View', onClick: () => window.open(buildTxExplorerUrl(CHAIN_ID, hash), '_blank', 'noopener') },
        })
        await qc.invalidateQueries()
        return true
      } catch (e) {
        const msg = parseTxError(e)
        if (msg !== 'cancelled') toast.error(msg)
        return false
      } finally {
        setPending(null)
      }
    },
    [address, chainId, switchChainAsync, publicClient, qc],
  )

  return { send, pending }
}

/** Current unix time in seconds, refreshed every 30 seconds. */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30000)
    return () => clearInterval(id)
  }, [])
  return now
}
