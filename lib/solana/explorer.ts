import type { SolanaCluster } from "@/lib/solana/types";

function suffix(cluster: SolanaCluster): string {
  if (cluster === "mainnet-beta") return "";
  if (cluster === "localnet") return "?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899";
  return `?cluster=${encodeURIComponent(cluster)}`;
}

export function explorerTransactionUrl(signature: string, cluster: SolanaCluster): string {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}${suffix(cluster)}`;
}

export function explorerAccountUrl(address: string, cluster: SolanaCluster): string {
  return `https://explorer.solana.com/address/${encodeURIComponent(address)}${suffix(cluster)}`;
}
