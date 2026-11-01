"use client";

import { useEffect, useState } from "react";
import { StatusChip } from "@/components/marketplace/status-chip";
import { fromAtomic } from "@/lib/domain/money";
import { explorerAccountUrl, explorerTransactionUrl } from "@/lib/solana/explorer";
import type { SolanaCluster } from "@/lib/solana/types";

type State = { contractStatus: string; amountAtomic: string; cluster: SolanaCluster; escrowAddress: string; escrow: null | { state: string; grossAmount: string; feeAmount: string }; actions: Array<{ id: string; kind: string; status: string; cluster: SolanaCluster; signature?: string }> };

export function ChainStateCard({ contractId }: { contractId: string }) {
  const [state, setState] = useState<State>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/contracts/${contractId}/chain-state`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not load chain state.");
      if (active) setState(body.data as State);
    }).catch((caught: unknown) => { if (active) setError(caught instanceof Error && caught.message ? caught.message : "Could not load chain state."); });
    return () => { active = false; };
  }, [contractId]);
  if (error) return <section className="workspacePanel" aria-labelledby="chain-state-heading"><h2 id="chain-state-heading">Escrow state</h2><p role="alert">{error}</p></section>;
  if (!state) return <section className="workspacePanel" aria-labelledby="chain-state-heading"><h2 id="chain-state-heading">Escrow state</h2><p>Checking confirmed chain state…</p></section>;
  return <section className="workspacePanel" aria-labelledby="chain-state-heading">
    <h2 id="chain-state-heading">Escrow state</h2>
    <dl><dt>Database status</dt><dd><StatusChip status={state.contractStatus} /></dd><dt>On-chain status</dt><dd>{state.escrow ? <StatusChip status={state.escrow.state.toLowerCase()} /> : "Not funded"}</dd><dt>Gross amount</dt><dd className="mono">{fromAtomic(BigInt(state.amountAtomic))} USDC</dd></dl>
    <p><a href={explorerAccountUrl(state.escrowAddress, state.cluster)} target="_blank" rel="noreferrer">View escrow account</a></p>
    {state.actions.length ? <ul>{state.actions.map((action) => <li key={action.id}>{action.kind}: {action.status}{action.signature ? <> · <a href={explorerTransactionUrl(action.signature, action.cluster)} target="_blank" rel="noreferrer">transaction</a></> : null}</li>)}</ul> : <p>No chain actions yet.</p>}
  </section>;
}
