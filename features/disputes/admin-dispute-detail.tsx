"use client";

import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import type { Provider } from "@reown/appkit-adapter-solana/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { UnsignedEscrowTransaction } from "@/lib/solana/types";
import { retryFinalization, signConfirmAndFinalize } from "./transaction";
import type { DisputeDetail } from "./types";

export function AdminDisputeDetail({ disputeId }: { disputeId: string }) {
  const { address } = useAppKitAccount({ namespace: "solana" });
  const { walletProvider } = useAppKitProvider<Provider>("solana");
  const [dispute, setDispute] = useState<DisputeDetail>();
  const [outcome, setOutcome] = useState<"refund_client" | "award_freelancer">("refund_client");
  const [reason, setReason] = useState("");
  const [prepared, setPrepared] = useState<UnsignedEscrowTransaction>();
  const [pendingActionId, setPendingActionId] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string>();

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/admin/disputes/${disputeId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not load this dispute.");
      setDispute(body.data);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load this dispute."); }
    finally { setBusy(false); }
  }, [disputeId]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/admin/disputes/${disputeId}`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not load this dispute.");
      if (active) setDispute(body.data);
    }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Could not load this dispute."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [disputeId]);

  async function prepareResolution() {
    setBusy(true); setMessage(undefined);
    try {
      const response = await fetch(`/api/v1/admin/disputes/${disputeId}/resolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome, reason, idempotencyKey: crypto.randomUUID() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not prepare the resolution.");
      setPrepared(body.data.chain); setMessage("Decision recorded. Verify the recipient and amount before signing.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not prepare the resolution."); }
    finally { setBusy(false); }
  }

  async function signResolution() {
    if (!prepared || !walletProvider || !address) return;
    setBusy(true);
    try {
      const result = await signConfirmAndFinalize(prepared, walletProvider, address);
      setMessage(result.message); setPendingActionId(result.finalized ? undefined : prepared.action.id);
      if (result.finalized) { setPrepared(undefined); await refresh(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Resolution transaction failed."); }
    finally { setBusy(false); }
  }

  async function retry() {
    if (!pendingActionId) return;
    setBusy(true);
    try { setMessage(await retryFinalization(pendingActionId)); setPendingActionId(undefined); setPrepared(undefined); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Finalization is still pending."); }
    finally { setBusy(false); }
  }

  if (!dispute) return <section className="workspacePanel"><Link href="/admin/disputes">← Dispute queue</Link><p role="status">{message ?? (busy ? "Loading dispute…" : "Dispute unavailable.")}</p></section>;
  return <div className="adminDisputeGrid"><section className="workspacePanel"><Link href="/admin/disputes">← Dispute queue</Link><span className="eyebrow">{dispute.status.replaceAll("_", " ")}</span><h2>{dispute.project_title}</h2><p>{dispute.statement}</p><dl><dt>Category</dt><dd>{dispute.category.replaceAll("_", " ")}</dd><dt>Contract state</dt><dd>{dispute.contract_status}</dd><dt>Escrow</dt><dd className="walletValue">{dispute.escrowPda}</dd><dt>Amount</dt><dd>{Number(dispute.amountAtomic) / 1_000_000} USDC</dd><dt>Opened by</dt><dd>{dispute.opened_by_profile.displayName}</dd></dl><Link href={`/contracts/${dispute.contractId}`}>Open contract workspace</Link></section>
    <section className="workspacePanel"><span className="eyebrow">Evidence</span><h2>Case record</h2>{dispute.evidence.length ? dispute.evidence.map((evidence) => <article className="evidenceCard" key={evidence.id}><p>{evidence.description}</p>{evidence.urls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">{url}</a>)}<small>{new Date(evidence.createdAt).toLocaleString()}</small></article>) : <p className="mutedCopy">No supporting links were submitted.</p>}</section>
    <section className="workspacePanel adminResolution"><span className="eyebrow">Binding decision</span><h2>Resolve escrow</h2>{dispute.decision ? <><p><strong>{dispute.decision.outcome.replaceAll("_", " ")}</strong></p><p>{dispute.decision.reason}</p><p className="mutedCopy">Chain action: {dispute.decision.chainActionId}</p></> : <><label>Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value as typeof outcome)}><option value="refund_client">Refund client</option><option value="award_freelancer">Award freelancer</option></select></label><label>Decision reason<textarea rows={7} minLength={20} maxLength={10000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain how the contract terms and evidence support this decision." /></label><button className="button secondary" type="button" disabled={busy || reason.trim().length < 20} onClick={() => void prepareResolution()}>{busy ? "Preparing…" : "Prepare resolution"}</button></>}
      {prepared ? <div className="transactionReview"><strong>Final wallet review</strong><p>{prepared.action.kind === "refund" ? "Refund client" : "Award freelancer"} · {Number(prepared.action.amountAtomic) / 1_000_000} USDC</p><p className="walletValue">Escrow {prepared.action.escrowPda}</p><button className="button secondary" type="button" disabled={busy || !walletProvider} onClick={() => void signResolution()}>{busy ? "Submitting…" : "Sign resolution"}</button></div> : null}
      {pendingActionId ? <button className="button ghost" type="button" disabled={busy} onClick={() => void retry()}>Retry finalization</button> : null}{message ? <p className="formNotice" role="status">{message}</p> : null}
    </section></div>;
}
