import type { Metadata } from "next";
import { WalletSessionGuard } from "@/features/auth/wallet-sign-in";
import { AppKitProvider } from "@/providers/appkit-provider";
import "./styles.css";

export const metadata: Metadata = {
  title: "Jobba Freelance",
  description: "Hire and get paid through USDC escrow on Solana.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AppKitProvider><WalletSessionGuard />{children}</AppKitProvider></body>
    </html>
  );
}
