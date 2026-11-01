"use client";

import { useEffect, useState, type FormEvent } from "react";

type Skill = { id: string; name: string; category: string };
type Profile = {
  displayName: string;
  headline: string | null;
  location: string | null;
  bio: string | null;
  hourlyRateAtomic: string | null;
  availability: "available" | "limited" | "unavailable";
  roles: ("client" | "freelancer" | "admin")[];
  skills: { id: string }[];
  portfolio: { title: string; url: string }[];
};

function formatAtomic(value: string | null): string {
  if (!value) return "";
  const padded = value.padStart(7, "0");
  const whole = padded.slice(0, -6);
  const fraction = padded.slice(-6).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function toAtomic(value: string): string | null {
  if (!value) return null;
  if (!/^\d+(\.\d{1,6})?$/.test(value)) throw new Error("Enter a valid USDC rate.");
  const [whole, fraction = ""] = value.split(".");
  return (BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"))).toString();
}

export function ProfileEditor({ onSaved }: { onSaved?: () => void } = {}) {
  const [data, setData] = useState<{ profile: Profile; availableSkills: Skill[] }>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    void fetch("/api/v1/profile", { cache: "no-store" }).then(async (response) => {
      const body = await response.json() as { data?: { profile: Profile; availableSkills: Skill[] }; error?: { message: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Could not load your profile.");
      setData(body.data);
      setRoles(body.data.profile.roles.filter((role) => role !== "admin"));
    }).catch((caught: unknown) => { setError(true); setMessage(caught instanceof Error ? caught.message : "Could not load your profile."); });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setMessage(undefined); setError(false);
    try {
      const portfolioUrl = String(form.get("portfolioUrl") ?? "").trim();
      const response = await fetch("/api/v1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.get("displayName"), headline: form.get("headline") || null, location: form.get("location") || null,
          bio: form.get("bio") || null, hourlyRateAtomic: toAtomic(String(form.get("rate") ?? "")), availability: form.get("availability"),
          roles, skillIds: form.getAll("skillIds"),
          portfolio: portfolioUrl ? [{ title: String(form.get("portfolioTitle") || "Portfolio"), url: portfolioUrl }] : [],
        }),
      });
      const body = await response.json() as { data?: { profile: Profile; availableSkills: Skill[] }; error?: { message: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Could not save your profile.");
      setData(body.data); setMessage("Profile saved."); onSaved?.();
    } catch (caught) { setError(true); setMessage(caught instanceof Error ? caught.message : "Could not save your profile."); }
    finally { setPending(false); }
  }

  if (!data) return <p className={`formNotice${error ? " error" : ""}`} role={error ? "alert" : "status"}>{message ?? "Loading your profile…"}</p>;
  const { profile, availableSkills } = data;
  const isFreelancer = roles.includes("freelancer");
  const toggleRole = (role: string) => setRoles((current) => current.includes(role) ? current.filter((r) => r !== role) : [...current, role]);
  return (
    <form className="marketForm" onSubmit={submit} aria-busy={pending}>
      <fieldset>
        <legend>How will you use Jobba?</legend>
        <div className="roleChoice fullField">
          {([["client", "I’m hiring", "Post projects, review proposals and fund escrow."], ["freelancer", "I’m freelancing", "Build a profile, send proposals and get paid in USDC."]] as const).map(([role, title, copy]) => (
            <label className={`roleCard${roles.includes(role) ? " on" : ""}`} key={role}>
              <input type="checkbox" name="roles" value={role} checked={roles.includes(role)} onChange={() => toggleRole(role)} />
              <strong>{title}</strong><span>{copy}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Your details</legend>
        <label><span>Display name</span><input name="displayName" required maxLength={80} defaultValue={profile.displayName} /></label>
        <label><span>Location</span><input name="location" required={isFreelancer} maxLength={120} defaultValue={profile.location ?? ""} placeholder="Lagos, NG" /></label>
        {isFreelancer ? (
          <>
            <label className="fullField"><span>Professional headline</span><input name="headline" required maxLength={120} defaultValue={profile.headline ?? ""} placeholder="Product designer for complex financial tools" /></label>
            <label className="fullField"><span>Bio</span><textarea name="bio" required maxLength={2000} rows={6} defaultValue={profile.bio ?? ""} /></label>
          </>
        ) : null}
      </fieldset>
      {isFreelancer ? (
        <fieldset>
          <legend>Rates, skills and work</legend>
          <label><span>Hourly guide</span><div className="inputSuffix"><input className="mono" name="rate" required inputMode="decimal" defaultValue={formatAtomic(profile.hourlyRateAtomic)} /><b>USDC</b></div></label>
          <label><span>Availability</span><select name="availability" required defaultValue={profile.availability}><option value="available">Available now</option><option value="limited">Limited availability</option><option value="unavailable">Not available</option></select></label>
          <div className="fullField"><span className="fieldLabel">Skills</span><div className="skillChecks">{availableSkills.map((skill) => <label className="checkField" key={skill.id}><input type="checkbox" name="skillIds" value={skill.id} defaultChecked={profile.skills.some((selected) => selected.id === skill.id)} /><span>{skill.name}</span></label>)}</div></div>
          <label><span>Portfolio title</span><input name="portfolioTitle" maxLength={120} defaultValue={profile.portfolio[0]?.title ?? ""} /></label>
          <label><span>Portfolio URL</span><input name="portfolioUrl" type="url" defaultValue={profile.portfolio[0]?.url ?? ""} /></label>
        </fieldset>
      ) : <input type="hidden" name="availability" value={profile.availability} />}
      <div className="formActions"><button className="button primary" disabled={pending || roles.length === 0} type="submit">{pending ? "Saving…" : "Save profile"}</button></div>
      {message ? <p className={`formNotice${error ? " error" : ""}`} role={error ? "alert" : "status"}>{message}</p> : null}
    </form>
  );
}
