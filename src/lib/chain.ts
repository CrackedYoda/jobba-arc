import { formatUnits, parseUnits } from 'viem'
import { arcTestnet } from 'viem/chains'

/** Arc Testnet facts. Source: Arc docs (docs.arc.io) and Circle's use-arc reference. */
export const ARC_CHAIN_ID = arcTestnet.id
export const ARC_EXPLORER = 'https://explorer.testnet.arc.io'
/** USDC is a fixed predeploy on Arc. ERC-20 view has 6 decimals (the native gas view has 18). */
export const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const
export const USDC_DECIMALS = 6

export const txUrl = (hash: string) => `${ARC_EXPLORER}/tx/${hash}`
export const addressUrl = (address: string) => `${ARC_EXPLORER}/address/${address}`

/** Parses a user-entered USDC amount (max 6 decimals) into 6-decimal base units. */
export function parseUsdc(value: string): bigint {
  const v = value.trim()
  if (!/^\d+(\.\d{1,6})?$/.test(v)) throw new Error('Invalid USDC amount')
  return parseUnits(v, USDC_DECIMALS)
}

/** Formats 6-decimal USDC base units with a fixed number of fraction digits. */
export function formatUsdcFixed(raw: bigint, fractionDigits = 2): string {
  const [whole, fraction = ''] = formatUnits(raw, USDC_DECIMALS).split('.')
  return `${whole}.${fraction.padEnd(fractionDigits, '0').slice(0, fractionDigits)}`
}
