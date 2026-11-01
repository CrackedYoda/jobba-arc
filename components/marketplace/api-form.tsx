"use client";

import { useState, type FormEvent, type ReactNode } from "react";

type ApiFormProps = {
  children: ReactNode;
  endpoint: string;
  kind: "project" | "proposal";
  className?: string;
};

function usdcToAtomic(value: FormDataEntryValue | null): string {
  const input = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,6})?$/.test(input)) throw new Error("Enter a valid USDC amount with up to six decimals.");
  const [whole, fraction = ""] = input.split(".");
  return (BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"))).toString();
}

function payloadFor(kind: ApiFormProps["kind"], data: FormData): Record<string, unknown> {
  if (kind === "project") return {
    title: String(data.get("title") ?? ""),
    description: String(data.get("description") ?? ""),
    category: String(data.get("category") ?? ""),
    budgetAtomic: usdcToAtomic(data.get("budget")),
    skillIds: [],
    status: data.get("intent") === "draft" ? "draft" : "open",
  };
  if (kind === "proposal") return {
    coverLetter: String(data.get("coverLetter") ?? ""),
    amountAtomic: usdcToAtomic(data.get("amount")),
    estimatedDays: Number(data.get("deliveryDays")),
  };
  return {};
}

export function ApiForm({ children, endpoint, kind, className = "marketForm" }: ApiFormProps) {
  const [state, setState] = useState<{ pending: boolean; message?: string; error?: boolean }>({ pending: false });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.name) data.set(submitter.name, submitter.value);
    setState({ pending: true });
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFor(kind, data)),
      });
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "The request could not be completed.");
      setState({ pending: false, message: kind === "project" ? "Project saved." : "Proposal submitted." });
      form.reset();
    } catch (error) {
      setState({ pending: false, error: true, message: error instanceof Error ? error.message : "Something went wrong." });
    }
  }
  return <form className={className} onSubmit={submit} aria-busy={state.pending}>{children}{state.message ? <p className={`formNotice${state.error ? " error" : ""}`} role={state.error ? "alert" : "status"}>{state.message}</p> : null}<button className="srSubmit" type="submit" disabled={state.pending}>{state.pending ? "Saving…" : "Submit"}</button></form>;
}
