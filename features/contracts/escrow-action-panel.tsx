"use client";

import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import type { Provider } from "@reown/appkit-adapter-solana/react";
import { Transaction } from "@solana/web3.js";
import { useEffect, useState } from "react";
import { fromAtomic } from "@/lib/domain/money";
import type { EscrowAction, UnsignedEscrowTransaction } from "@/lib/solana/types";

const tone: Partial<Record<EscrowAction, string>> = { fund: "lime", release: "green", cancel: "dangerButton", refund: "dangerButton" };

const labels: Record<EscrowAction, string> = { fund: "Fund escrow", accept: "Accept contract", submit: "Submit work", release: "Approve and release", cancel: "Cancel and refund", open_dispute: "Open dispute", refund: "Refund client", award: "Award freelancer" };

export function EscrowActionPanel({ contractId }: { contractId: string }) {
  const { address } = useAppKitAccount({ namespace: "solana" });
  const { walletProvider } = useAppKitProvider<Provider>("solana");
  const [prepared, setPrepared] = useState<UnsignedEscrowTransaction>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [actions, setActions] = useState<readonly EscrowAction[]>([]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/contracts/${contractId}/chain-state`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not load available actions.");
      if (active) setActions(body.data.allowedActions as EscrowAction[]);
    }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Could not load available actions."); });
    return () => { active = false; };
  }, [contractId]);

  async function prepare(action: EscrowAction) {
    setBusy(true); setMessage(undefined); setPrepared(undefined);
    try {
      const response = await fetch(`/api/v1/contracts/${contractId}/transactions/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not prepare transaction.");
      setPrepared(body.data as UnsignedEscrowTransaction);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not prepare transaction."); }
    finally { setBusy(false); }
  }

  async function signAndSubmit() {
    if (!prepared || !walletProvider || !address) return;
    setBusy(true); setMessage(undefined);
    try {
      if (address !== prepared.feePayer) throw new Error("Connected wallet differs from the authorized fee payer.");
      const bytes = Uint8Array.from(window.atob(prepared.transactionBase64), (character) => character.charCodeAt(0));
      const transaction = Transaction.from(bytes);
      const signature = await walletProvider.signAndSendTransaction(transaction);
      const response = await fetch(`/api/v1/chain/actions/${prepared.action.id}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Submitted transaction could not be verified.");
      const finalizedResponse = await fetch(`/api/v1/chain/actions/${prepared.action.id}/finalize`, { method: "POST" });
      const finalized = await finalizedResponse.json();
      if (!finalizedResponse.ok) {
        setMessage(`Confirmed in slot ${body.data.slot}. Finalization is still pending; retry from the contract workspace.`);
      } else {
        setMessage(`Finalized in slot ${finalized.data.slot}.`);
      }
      setPrepared(undefined);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Transaction failed."); }
    finally { setBusy(false); }
  }

  return <section className="workspacePanel actionPanel" aria-labelledby="escrow-actions-heading"><span className="eyebrow">Escrow</span><h2 id="escrow-actions-heading">Next action</h2>
    <div>{actions.filter((action) => action !== "open_dispute").length ? actions.filter((action) => action !== "open_dispute").map((action) => <button className={`button ${tone[action] ?? "primary"}`} key={action} type="button" disabled={busy} onClick={() => void prepare(action)}>{labels[action]}</button>) : <p>No ordinary wallet action is available in the current state.</p>}</div>
    {prepared ? <div role="status"><div className="transactionReview"><strong>Review before signing</strong><p>{labels[prepared.action.kind]} · {fromAtomic(BigInt(prepared.action.amountAtomic))} USDC on {prepared.action.cluster}</p><p className="mono">Escrow {prepared.action.escrowPda}</p><p className="mono">Mint {prepared.action.mint}</p><p className="muted">Network fee is paid in SOL by {prepared.feePayer.slice(0, 4)}…{prepared.feePayer.slice(-4)}.</p><button className="button primary" type="button" disabled={busy || !walletProvider} onClick={() => void signAndSubmit()}>{busy ? "Waiting for wallet…" : "Sign and submit"}</button></div></div> : null}
    {message ? <p className="formNotice" role="status">{message}</p> : null}
  </section>;
}
