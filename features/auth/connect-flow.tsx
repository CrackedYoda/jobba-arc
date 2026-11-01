"use client";

import { hardNavigate } from "@/lib/navigation";
import Link from "next/link";

import { useWalletAuth } from "@/features/auth/use-wallet-auth";
import { ProfileEditor } from "@/features/profiles/profile-editor";
import { isWalletConfigured } from "@/providers/appkit-provider";

const steps = [
  ["Connect wallet", "Reown AppKit · WalletConnect"],
  ["Sign a message", "Single-use nonce, verified server-side"],
  ["Set up profile", "Client or freelancer role"],
];

function Rail({ current }: { current: number }) {
  return (
    <ol className="connectSteps" aria-label="Sign-in progress">
      {steps.map(([title, sub], index) => (
        <li key={title} aria-current={index === current ? "step" : undefined} className={index < current ? "done" : index === current ? "now" : ""}>
          <span className="mono">{index < current ? "✓" : index + 1}</span>
          <div><strong>{title}</strong><small>{sub}</small></div>
        </li>
      ))}
    </ol>
  );
}

function Flow({ initiallyAuthenticated }: { initiallyAuthenticated: boolean }) {
  const auth = useWalletAuth();
  const busy = ["requesting", "signing", "verifying"].includes(auth.status);
  const authed = auth.matched || (initiallyAuthenticated && auth.session.authenticated);
  const step = authed ? 2 : auth.isConnected ? 1 : 0;

  return (
    <div className="connectPanel">
      <Rail current={step} />
      {step === 0 ? (
        <section aria-labelledby="c0">
          <span className="eyebrow">Step 1 of 3</span>
          <h2 id="c0">Connect a Solana wallet</h2>
          <p className="lead">Pick Phantom, Solflare, Backpack or any WalletConnect wallet. Use a different wallet for the client and freelancer side when testing.</p>
          <button className="button primary wide" type="button" onClick={auth.connect}>Choose a wallet</button>
          <p className="fine">By connecting you agree to the devnet test terms.</p>
        </section>
      ) : null}
      {step === 1 ? (
        <section aria-labelledby="c1">
          <span className="eyebrow">Step 2 of 3</span>
          <h2 id="c1">Sign in with Solana</h2>
          <p className="lead">Your wallet will show an exact message. It expires in 5 minutes and can be used once.</p>
          <div className="messageCard">
            <div><span className="mono">{auth.address}</span><span className="chip open mono">DEVNET</span></div>
            <pre className="mono">{auth.message ?? "The message is created by the server when you press Sign message."}</pre>
          </div>
          {busy ? <p className="formNotice" role="status">{auth.status === "signing" ? "Waiting for your wallet… approve the request to continue." : "Working…"}</p> : null}
          {auth.error ? <p className="formNotice error" role="alert">{auth.error}</p> : null}
          <div className="formActions row">
            <button className="button ghost" type="button" onClick={auth.connect}>Change wallet</button>
            <button className="button primary grow" type="button" disabled={!auth.ready || busy} onClick={() => void auth.signIn()}>{busy ? "Check your wallet…" : "Sign message"}</button>
          </div>
        </section>
      ) : null}
      {step === 2 ? (
        <section aria-labelledby="c2">
          <span className="eyebrow">Step 3 of 3</span>
          <h2 id="c2">How will you use Jobba?</h2>
          <p className="lead">You can change roles later from your profile. Saving takes you to your dashboard.</p>
          <ProfileEditor onSaved={() => hardNavigate("/dashboard")} />
          <p className="fine"><Link href="/dashboard">Skip for now</Link> · <button className="textButton" type="button" onClick={() => void auth.signOut()}>Sign out</button></p>
        </section>
      ) : null}
    </div>
  );
}

export function ConnectFlow({ initiallyAuthenticated }: { initiallyAuthenticated: boolean }) {
  if (!isWalletConfigured) {
    return <div className="connectPanel"><h2>Wallet unavailable</h2><p className="formNotice error" role="alert">Set NEXT_PUBLIC_REOWN_PROJECT_ID in .env.local and restart the server to enable wallet sign-in.</p></div>;
  }
  return <Flow initiallyAuthenticated={initiallyAuthenticated} />;
}
