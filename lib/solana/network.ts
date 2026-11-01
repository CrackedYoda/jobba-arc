import { solana, solanaDevnet, solanaTestnet } from "@reown/appkit/networks";

import { publicEnv } from "@/lib/config/public-env";

export const appKitNetwork =
  publicEnv.cluster === "mainnet-beta"
    ? solana
    : publicEnv.cluster === "testnet"
      ? solanaTestnet
      : solanaDevnet;

export const solanaChainId = `solana:${publicEnv.cluster}` as const;
