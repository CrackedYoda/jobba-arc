import { useAccount, useReadContract } from 'wagmi'
import { jobbaAbi } from '@/contracts/jobbaAbi'
import { CHAIN_ID, ESCROW_ADDRESS, isZero, sameAddr } from '@/lib/jobba'
import { useIsArbiter } from '@/hooks/useJobba'

const common = {
  address: ESCROW_ADDRESS,
  abi: jobbaAbi,
  chainId: CHAIN_ID,
  query: { refetchInterval: 8000 },
} as const

/** Platform settings and the connected wallet's roles. */
export function useAdminState() {
  const { address } = useAccount()
  const owner = useReadContract({ ...common, functionName: 'owner' })
  const pendingOwner = useReadContract({ ...common, functionName: 'pendingOwner' })
  const treasury = useReadContract({ ...common, functionName: 'treasury' })
  const fee = useReadContract({ ...common, functionName: 'feeBps' })
  const maxFee = useReadContract({ ...common, functionName: 'MAX_FEE_BPS' })
  const paused = useReadContract({ ...common, functionName: 'paused' })
  const isArbiter = useIsArbiter(address)

  const pending = pendingOwner.data && !isZero(pendingOwner.data) ? pendingOwner.data : undefined
  return {
    address,
    owner: owner.data,
    pendingOwner: pending,
    treasury: treasury.data,
    feeBps: Number(fee.data ?? 0),
    maxFeeBps: Number(maxFee.data ?? 1000),
    paused: paused.data === true,
    isOwner: sameAddr(address, owner.data),
    isPendingOwner: sameAddr(address, pending),
    isArbiter,
    loaded: owner.data !== undefined,
  }
}
