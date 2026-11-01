"use client";

import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import type { Provider } from "@reown/appkit-adapter-solana/react";
import { useState } from "react";
import type { UnsignedEscrowTransaction } from "@/lib/solana/types";
import { retryFinalization, signConfirmAndFinalize } from "./transaction";

export function ContractDisputePanel({ contractId }: { contractId: string }) {
  const { address } = useAppKitAccount({ namespace: "solana" });
  const { walletProvider } = useAppKitProvider<Provider>("solana");
  const [category, setCategory] = useState("scope_or_quality");
  const [statement, setStatement] = useState("");
  const [description, setDescription] = useState("");
  const [urls, setUrls] = useState("");
  const [prepared, setPrepared] = useState<UnsignedEscrowTransaction>();
  const [pendingActionId, setPendingActionId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function openDispute() {
    setBusy(true); setMessage(undefined);
    try {
      const evidenceUrls = urls.split(/\n|,/).map((url) => url.trim()).filter(Boolean);
      const response = await fetch("/api/v1/disputes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractId, category, statement, evidence: description ? [{ description, urls: evidenceUrls }] : [], idempotencyKey: crypto.randomUUID() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not open the dispute.");
      if (!body.data.chain) { setMessage("This dispute is already recorded."); return; }
      setPrepared(body.data.chain as UnsignedEscrowTransaction);
      setMessage("Dispute recorded. Review and sign the transaction to lock escrow settlement.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not open the dispute."); }
    finally { setBusy(false); }
  }

  async function sign() {
    if (!prepared || !walletProvider || !address) return;
    setBusy(true);
    try {
      const result = await signConfirmAndFinalize(prepared, walletProvider, address);
      setMessage(result.message); setPendingActionId(result.finalized ? undefined : prepared.action.id);
      if (result.finalized) setPrepared(undefined);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Transaction failed."); }
    finally { setBusy(false); }
  }

  async function retry() {
    if (!pendingActionId) return;
    setBusy(true);
    try { setMessage(await retryFinalization(pendingActionId)); setPendingActionId(undefined); setPrepared(undefined); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Finalization is still pending."); }
    finally { setBusy(false); }
  }

  return <section className="workspacePanel disputePanel" aria-labelledby="open-dispute-heading">
    <span className="eyebrow">Escrow protection</span><h2 id="open-dispute-heading">Open a dispute</h2>
    <p className="mutedCopy">Describe the problem clearly. Opening a dispute records your case before asking your wallet to lock ordinary settlement.</p>
    <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="scope_or_quality">Scope or quality</option><option value="missed_deadline">Missed deadline</option><option value="communication">Communication</option><option value="fraud_or_abuse">Fraud or abuse</option><option value="other">Other</option></select></label>
    <label>Statement<textarea rows={5} minLength={20} maxLength={10000} value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="Explain what happened, what the contract required, and the outcome you want." /></label>
    <label>Evidence description <small>Optional</small><textarea rows={3} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <label>Evidence links <small>Optional, one URL per line</small><textarea rows={3} value={urls} onChange={(event) => setUrls(event.target.value)} /></label>
    {!prepared ? <button className="button ghost" type="button" disabled={busy || statement.trim().length < 20} onClick={() => void openDispute()}>{busy ? "Preparing…" : "Prepare dispute"}</button> : <div className="transactionReview"><strong>Wallet review</strong><p>{prepared.action.amountAtomic} atomic USDC · escrow {prepared.action.escrowPda}</p><button className="button secondary" type="button" disabled={busy || !walletProvider} onClick={() => void sign()}>{busy ? "Submitting…" : "Sign and open dispute"}</button></div>}
    {pendingActionId ? <button className="button ghost" type="button" disabled={busy} onClick={() => void retry()}>Retry finalization</button> : null}
    {message ? <p className="formNotice" role="status">{message}</p> : null}
  </section>;
}
