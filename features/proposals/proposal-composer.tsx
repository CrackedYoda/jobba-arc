"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PLATFORM_FEE_BPS, fromAtomic, platformFee, toAtomic } from "@/lib/domain/money";

type Existing = { id: string; status: string; amountUsdc: string; deliveryDays: number; coverLetter: string } | undefined;

export function ProposalComposer({ projectId, budgetUsdc, defaultDays, existing }: { projectId: string; budgetUsdc: string; defaultDays: number; existing?: Existing }) {
  const router = useRouter();
  const [amount, setAmount] = useState(budgetUsdc.replace(/,/g, ""));
  const [days, setDays] = useState(String(defaultDays));
  const [letter, setLetter] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [state, setState] = useState<{ busy: boolean; message?: string; error?: boolean }>({ busy: false });

  const units = toAtomic(amount);
  const budget = toAtomic(budgetUsdc);
  const fee = units ? platformFee(units, PLATFORM_FEE_BPS) : 0n;
  const over = units && budget ? units > budget : false;
  const invalid = !units || letter.trim().length < 20 || letter.length > 2000 || !Number.isInteger(Number(days)) || Number(days) < 1;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!units) return;
    setState({ busy: true });
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/proposals`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverLetter: letter.trim(), amountAtomic: units.toString(), estimatedDays: Number(days), portfolioUrl: portfolio.trim() || null }),
      });
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "The proposal could not be sent.");
      router.refresh();
    } catch (error) {
      setState({ busy: false, error: true, message: error instanceof Error ? error.message : "Something went wrong." });
    }
  }

  async function withdraw() {
    if (!existing) return;
    setState({ busy: true });
    const response = await fetch(`/api/v1/proposals/${existing.id}/withdraw`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      setState({ busy: false, error: true, message: body.error?.message ?? "Could not withdraw." });
      return;
    }
    router.refresh();
  }

  if (existing && existing.status !== "withdrawn") {
    return (
      <div className="composerBox">
        <div className="between"><h2>Proposal sent</h2><span className={`chip ${existing.status}`}>{existing.status.toUpperCase()}</span></div>
        <dl className="kv"><div><dt>Price</dt><dd className="mono">{existing.amountUsdc} USDC</dd></div><div><dt>Delivery</dt><dd>{existing.deliveryDays} days</dd></div></dl>
        <p className="quote">{existing.coverLetter}</p>
        <ol className="miniSteps"><li className="on">Client reviews proposals</li><li>If selected, client funds escrow</li><li>You accept the funded contract</li></ol>
        {existing.status === "pending" ? <button className="button dangerButton" type="button" disabled={state.busy} onClick={() => void withdraw()}>Withdraw proposal</button> : null}
        {state.message ? <p className={`formNotice${state.error ? " error" : ""}`} role="alert">{state.message}</p> : null}
      </div>
    );
  }

  return (
    <form className="composerBox" onSubmit={submit} aria-busy={state.busy}>
      <h2>Send a proposal</h2>
      {existing ? <p className="formNotice">Your earlier proposal was withdrawn. You can send a new one while the project is open.</p> : null}
      <div className="twoCol">
        <label><span>Your price (USDC)</span><input className="mono" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
        <label><span>Delivery (days)</span><input className="mono" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} required /></label>
      </div>
      <div className="feeBox">
        <div><span>Client funds into escrow</span><b className="mono">{units ? fromAtomic(units) : "—"} USDC</b></div>
        <div><span>Platform fee ({(PLATFORM_FEE_BPS / 100).toFixed(2)}%)</span><b className="mono">− {fromAtomic(fee)} USDC</b></div>
        <div className="total"><span>You receive on release</span><b className="mono">{units ? fromAtomic(units - fee) : "—"} USDC</b></div>
      </div>
      {over ? <p className="formNotice error">Above the client’s {budgetUsdc} USDC budget — explain why in your cover letter.</p> : null}
      <label><span>Cover letter</span><textarea rows={6} value={letter} onChange={(e) => setLetter(e.target.value)} placeholder="Explain your approach, relevant experience, and the first step you would take." required /><small className="counter">{letter.length} / 2,000</small></label>
      <label><span>Portfolio link (optional)</span><input type="url" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://" /></label>
      <button className="button primary wide" type="submit" disabled={invalid || state.busy}>{state.busy ? "Sending…" : "Submit proposal"}</button>
      <p className="fine">No signature needed. Proposals are off-chain until a client funds one.</p>
      {state.message ? <p className={`formNotice${state.error ? " error" : ""}`} role="alert">{state.message}</p> : null}
    </form>
  );
}
