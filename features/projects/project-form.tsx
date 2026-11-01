"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PLATFORM_FEE_BPS, fromAtomic, platformFee, toAtomic } from "@/lib/domain/money";

type Skill = { id: string; name: string };

export function ProjectForm({ skills, categories }: { skills: Skill[]; categories: string[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState("21");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [state, setState] = useState<{ busy: boolean; message?: string }>({ busy: false });

  const units = toAtomic(budget);
  const fee = units ? platformFee(units, PLATFORM_FEE_BPS) : 0n;

  function toggle(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "draft" ? "draft" : "open";
    if (!units) { setState({ busy: false, message: "Enter a valid USDC budget with up to six decimals." }); return; }
    setState({ busy: true });
    try {
      const response = await fetch("/api/v1/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, budgetAtomic: units.toString(), deliveryDays: Number(days), skillIds: [...picked], status: intent }),
      });
      const body = await response.json().catch(() => ({})) as { data?: { id: string }; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "The project could not be saved.");
      router.push(intent === "open" ? `/projects/${body.data.id}` : "/dashboard/client");
      router.refresh();
    } catch (error) {
      setState({ busy: false, message: error instanceof Error ? error.message : "Something went wrong." });
    }
  }

  return (
    <form className="marketForm" onSubmit={submit} aria-busy={state.busy}>
      <fieldset>
        <legend>Project basics</legend>
        <label className="fullField"><span>Project title</span><input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={8} maxLength={120} placeholder="e.g. Build an Anchor event indexer" /></label>
        <label><span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} required><option value="" disabled>Select a category</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="fullField"><span>What needs to be delivered?</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} required minLength={40} maxLength={4000} rows={7} placeholder="Describe the outcome, important context, and what a strong delivery includes." /><small>Do not include private credentials or sensitive customer data.</small></label>
      </fieldset>
      <fieldset>
        <legend>Skills</legend>
        <div className="fullField pillRow" role="group" aria-label="Required skills">
          {skills.map((skill) => <button key={skill.id} type="button" className={`pillButton${picked.has(skill.id) ? " on" : ""}`} aria-pressed={picked.has(skill.id)} onClick={() => toggle(skill.id)}>{skill.name}</button>)}
        </div>
      </fieldset>
      <fieldset>
        <legend>Terms</legend>
        <label><span>Fixed budget</span><div className="inputSuffix"><input className="mono" value={budget} onChange={(e) => setBudget(e.target.value)} required inputMode="decimal" placeholder="2400" /><b>USDC</b></div>
          <small>{units ? `Stored as ${units.toString()} atomic units` : "Up to six decimal places"}</small></label>
        <label><span>Delivery target</span><div className="inputSuffix"><input value={days} onChange={(e) => setDays(e.target.value)} type="number" required min={1} max={365} /><b>days</b></div></label>
        <aside className="escrowNotice fullField"><strong>How funding works</strong><p>You pick a proposal, then fund {units ? `${fromAtomic(units)} USDC` : "the agreed amount"} into escrow with one signature. The platform fee ({(PLATFORM_FEE_BPS / 100).toFixed(2)}%{units ? `, ${fromAtomic(fee)} USDC` : ""}) is deducted from the freelancer’s payout, not added to your cost.</p></aside>
      </fieldset>
      {state.message ? <p className="formNotice error" role="alert">{state.message}</p> : null}
      <div className="formActions">
        <button className="button ghost" type="submit" name="intent" value="draft" disabled={state.busy}>Save draft</button>
        <button className="button primary" type="submit" name="intent" value="open" disabled={state.busy}>{state.busy ? "Saving…" : "Publish project"}</button>
      </div>
    </form>
  );
}
