"use client";

import { hardNavigate } from "@/lib/navigation";
import { useAppKit, useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import type { Provider } from "@reown/appkit-adapter-solana/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ChallengeResponse, SessionResponse } from "@/features/auth/schemas";

export type AuthStatus = "idle" | "requesting" | "signing" | "verifying" | "authenticated" | "error";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
}

export function useWalletAuth() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount({ namespace: "solana" });
  const { walletProvider } = useAppKitProvider<Provider>("solana");
  const [session, setSession] = useState<SessionResponse>({ authenticated: false });
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const authenticatedWallet = useRef<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/auth/session", { cache: "no-store" })
      .then((response) => response.json() as Promise<SessionResponse>)
      .then((next) => {
        if (!active) return;
        setSession(next);
        authenticatedWallet.current = next.walletAddress;
        setStatus(next.authenticated ? "authenticated" : "idle");
        setLoaded(true);
      })
      .catch(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authenticatedWallet.current && address !== authenticatedWallet.current) {
      void fetch("/api/v1/auth/logout", { method: "POST" }).finally(() => {
        setSession({ authenticated: false });
        authenticatedWallet.current = undefined;
        setStatus("idle");
        window.location.reload();
      });
    }
  }, [address]);

  const signIn = useCallback(async () => {
    if (!address || !walletProvider) return;
    setError(undefined);
    try {
      setStatus("requesting");
      const challengeResponse = await fetch("/api/v1/auth/challenge", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }),
      });
      if (!challengeResponse.ok) throw new Error("Could not create a sign-in challenge.");
      const challenge = await challengeResponse.json() as ChallengeResponse;
      setMessage(challenge.message);

      setStatus("signing");
      const signature = await walletProvider.signMessage(new TextEncoder().encode(challenge.message));

      setStatus("verifying");
      const verifyResponse = await fetch("/api/v1/auth/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, nonce: challenge.nonce, signature: bytesToBase64(signature) }),
      });
      if (!verifyResponse.ok) throw new Error("The wallet signature was rejected.");
      const next = await verifyResponse.json() as SessionResponse;
      setSession(next);
      authenticatedWallet.current = next.walletAddress;
      setStatus("authenticated");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wallet sign-in failed.");
      setStatus("error");
    }
  }, [address, walletProvider]);

  const signOut = useCallback(async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    authenticatedWallet.current = undefined;
    setSession({ authenticated: false });
    setStatus("idle");
    hardNavigate("/");
  }, []);

  const connect = useCallback(() => { void open({ view: "Connect" }); }, [open]);

  const matched = session.authenticated && session.walletAddress === address;
  return { address, isConnected, session, matched, status, error, message, loaded, signIn, signOut, connect, ready: Boolean(walletProvider) };
}
