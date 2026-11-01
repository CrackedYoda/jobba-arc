"use client";

import { type FormEvent, useEffect, useState } from "react";

type Submission = { id: string; description: string; deliverable_urls: string[]; content_hash: string; status: string; created_at: string; freelancer_name?: string };

export function SubmissionPanel({ contractId }: { contractId: string }) {
  const [items, setItems] = useState<Submission[]>([]);
  const [description, setDescription] = useState("");
  const [urls, setUrls] = useState("");
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/contracts/${contractId}/submission`, { cache: "no-store" }).then(async (response) => {
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? "Could not load delivery metadata.");
      if (active) { setItems(payload.data.items as Submission[]); setCanSubmit(Boolean(payload.data.canSubmit)); }
    }).catch((error: unknown) => { if (active) setNotice(error instanceof Error ? error.message : "Could not load delivery metadata."); });
    return () => { active = false; };
  }, [contractId]);

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(undefined);
    try {
      const deliverableUrls = urls.split("\n").map((value) => value.trim()).filter(Boolean);
      const response = await fetch(`/api/v1/contracts/${contractId}/submission`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description, deliverableUrls }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? "Could not save delivery metadata.");
      setItems((current) => [payload.data as Submission, ...current.filter((item) => item.id !== payload.data.id)]); setNotice("Delivery metadata saved. Submit the matching on-chain action when ready.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save delivery metadata."); }
    finally { setBusy(false); }
  }

  return <section className="workspacePanel" aria-labelledby="submission-heading"><div className="workspacePanelHead"><div><span className="eyebrow">Delivery</span><h2 id="submission-heading">Work submission</h2></div></div>
    {items.length ? <div className="submissionHistory">{items.map((item) => <article key={item.id}><div><strong>{item.status === "submitted" ? "Current delivery" : "Earlier delivery"}</strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></div><p>{item.description}</p>{item.deliverable_urls.length ? <ul>{item.deliverable_urls.map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul> : null}<small>Content hash: {item.content_hash}</small></article>)}</div> : <p className="mutedCopy">No delivery metadata has been recorded.</p>}
    {canSubmit ? <form className="submissionForm" onSubmit={(event) => void save(event)}><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={1} maxLength={10_000} rows={5} required /></label><label>Deliverable links <small>One HTTPS URL per line</small><textarea value={urls} onChange={(event) => setUrls(event.target.value)} rows={3} placeholder="https://…" /></label><button className="button secondary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save delivery metadata"}</button></form> : null}
    {notice ? <p className="formNotice" role="status">{notice}</p> : null}
  </section>;
}
