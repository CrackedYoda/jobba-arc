"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminDisputeSummary, DisputeStatus } from "./types";

const statuses = ["", "open", "under_review", "awaiting_chain", "resolved"] as const;

export function AdminDisputeList() {
  const [status, setStatus] = useState<(typeof statuses)[number]>("");
  const [items, setItems] = useState<AdminDisputeSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string>();

  const load = useCallback(async (cursor?: string) => {
    setBusy(true); setMessage(undefined);
    try {
      const query = new URLSearchParams({ limit: "20" });
      if (status) query.set("status", status);
      if (cursor) query.set("cursor", cursor);
      const response = await fetch(`/api/v1/admin/disputes?${query}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not load the dispute queue.");
      setItems((current) => cursor ? [...current, ...body.data.items] : body.data.items);
      setNextCursor(body.data.nextCursor);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load the dispute queue."); }
    finally { setBusy(false); }
  }, [status]);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ limit: "20" });
    if (status) query.set("status", status);
    void fetch(`/api/v1/admin/disputes?${query}`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Could not load the dispute queue.");
      if (active) { setItems(body.data.items); setNextCursor(body.data.nextCursor); }
    }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Could not load the dispute queue."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [status]);

  return <section className="dashboardSection" aria-labelledby="dispute-queue-heading">
    <div className="workspacePanelHead"><div><span className="eyebrow">Administrator</span><h2 id="dispute-queue-heading">Dispute queue</h2></div>
      <label className="compactField">Status<select value={status} onChange={(event) => { setBusy(true); setStatus(event.target.value as "" | DisputeStatus); }}>{statuses.map((value) => <option key={value || "all"} value={value}>{value ? value.replaceAll("_", " ") : "All disputes"}</option>)}</select></label>
    </div>
    {message ? <p className="formNotice" role="alert">{message}</p> : null}
    <div className="tableWrap"><table><thead><tr><th>Project</th><th>Opened by</th><th>Category</th><th>Amount</th><th>Status</th><th>Opened</th></tr></thead><tbody>
      {items.map((item) => <tr key={item.id}><td><Link href={`/admin/disputes/${item.id}`}>{item.project_title}</Link></td><td>{item.opened_by_name}</td><td>{item.category.replaceAll("_", " ")}</td><td>{Number(item.amountAtomic) / 1_000_000} USDC</td><td><span className="statusPill">{item.status.replaceAll("_", " ")}</span></td><td>{new Date(item.createdAt).toLocaleDateString()}</td></tr>)}
      {!busy && items.length === 0 ? <tr><td colSpan={6}>No disputes match this filter.</td></tr> : null}
    </tbody></table></div>
    {busy ? <p className="mutedCopy" role="status">Loading disputes…</p> : null}
    {nextCursor ? <button className="button ghost" type="button" disabled={busy} onClick={() => void load(nextCursor)}>Load more</button> : null}
  </section>;
}
