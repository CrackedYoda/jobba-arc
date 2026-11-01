"use client";

import { hardNavigate } from "@/lib/navigation";
import { useWalletAuth } from "@/features/auth/use-wallet-auth";
import { isWalletConfigured } from "@/providers/appkit-provider";

/** Keeps the cookie session in step with the connected wallet; renders nothing. */
function Guard() {
  useWalletAuth();
  return null;
}

export function WalletSessionGuard() {
  if (!isWalletConfigured) return null;
  return <Guard />;
}

function SignOutInner() {
  const { signOut } = useWalletAuth();
  return <button type="button" className="textButton" onClick={() => void signOut()}>Sign out</button>;
}

export function SignOutButton() {
  if (!isWalletConfigured) {
    return <button type="button" className="textButton" onClick={() => { void fetch("/api/v1/auth/logout", { method: "POST" }).then(() => hardNavigate("/")); }}>Sign out</button>;
  }
  return <SignOutInner />;
}
