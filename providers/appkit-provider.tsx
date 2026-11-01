"use client";

import { createAppKit } from "@reown/appkit/react";
import { SolanaAdapter } from "@reown/appkit-adapter-solana/react";
import type { ReactNode } from "react";

import { publicEnv } from "@/lib/config/public-env";
import { appKitNetwork } from "@/lib/solana/network";

export const isWalletConfigured = Boolean(publicEnv.reownProjectId);

if (publicEnv.reownProjectId) {
  createAppKit({
    adapters: [new SolanaAdapter()],
    networks: [appKitNetwork],
    defaultNetwork: appKitNetwork,
    projectId: publicEnv.reownProjectId,
    metadata: {
      name: "Jobba Freelance",
      description: "Freelance work settled through USDC escrow on Solana.",
      url: publicEnv.appUrl,
      icons: [`${publicEnv.appUrl}/icon.png`],
    },
    features: {
      analytics: false,
      email: false,
      socials: [],
    },
    themeMode: "light",
  });
}

export function AppKitProvider({ children }: { children: ReactNode }) {
  return children;
}
