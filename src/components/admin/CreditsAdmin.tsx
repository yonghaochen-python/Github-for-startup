"use client";

import { useEffect, useState } from "react";
import type { Balances } from "@/lib/credits";
import { PLAN_KEYS, PLAN_NAMES, type PlanKey } from "@/lib/plans";
import { btnSecondary } from "@/components/ui";

type Counts = { completed: number; released: number; reserved: number };
type Summary = Record<"photo" | "live", { users: Counts; admin: Counts; overLimit: number }>;
type Entry = { kind: string; type: string; source: string; amount: number; status: string; outcome: string | null; note: string | null; createdAt: string };

const field = "min-h-[40px] rounded-[10px] bg-[#f4f5f6] px-3 text-[13px] text-[#121821] outline-none focus:shadow-[inset_0_0_0_1px_#121821]";

/**
 * Admin: credit usage (real users and admin tests apart; live sessions as connected / failed / unclear), and a test
 * tool to set an account's plan or adjust its extra credits. No purchases exist yet; adjustments are labelled as such.
 */
export function CreditsAdmin() {
  const [summary, setSummary] = useState<{ summary: Summary; unclearLive: number } | null>(null);
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState<{ email: string; admin: boolean; balances: Balances; recent: Entry[] } | null>(null);
  const [plan, setPlan] = useState<PlanKey>("free");
  const [kind, setKind] = useState<"photo" | "live">("photo");
  const [amount, setAmount] = useState("5");
  const [note, setNote] = useState<string | null>(null);

  const loadSummary = () =>
    fetch("/api/admin/credits", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ summary: Summary; unclearLive: number }>) : null))
      .then(setSummary)
      .catch(() => {});
  useEffect(() => {
    loadSummary();
  }, []);

  async function lookUp() {
    setNote(null);
    const res = await fetch(`/api/admin/credits?email=${encodeURIComponent(email.trim())}`, { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      account: { email: string; admin: boolean };
      balances: Balances;
      recent: Entry[];
    };
    if (!res.ok) return setNote(data.error ?? "Couldn't look that up.");
    setAccount({ ...data.account, balances: data.balances, recent: data.recent });
    setPlan(data.balances.plan);
  }

  async function act(body: Record<string, unknown>) {
    setNote(null);
    const res = await fetch("/api/admin/credits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), ...body }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return setNote(data.error ?? "Couldn't do that.");
    setNote("Done.");
    await lookUp();
    loadSummary();
  }

  const s = summary?.summary;
  return (
    <div className="flex flex-col gap-5">
      {s && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["photo", "live"] as const).map((k) => (
            <div key={k} className="rounded-[18px] bg-white px-4 py-4 text-[12.5px] text-[#4f5b66] shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)]">
              <p className="text-[11px] font-semibold text-[#121821]">{k === "photo" ? "Photo try-ons" : "Live sessions"}</p>
              <p className="mt-1">
                Users: <b className="text-[#121821]">{s[k].users.completed}</b> {k === "live" ? "connected" : "completed"} · {s[k].users.released}{" "}
                {k === "live" ? "failed" : "given back"} · {s[k].users.reserved} {k === "live" ? "reserved" : "in progress"}
              </p>
              <p>
                Admin tests: {s[k].admin.completed} {k === "live" ? "connected" : "completed"} · {s[k].admin.released} {k === "live" ? "failed" : "given back"} ·{" "}
                {s[k].admin.reserved} reserved
              </p>
              <p>Over the limit (not blocked yet): {s[k].overLimit}</p>
              {k === "live" && <p>Unclear (no report after 2 min): {summary.unclearLive}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[18px] bg-white px-4 py-4 shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)]">
        <p className="text-[11px] font-semibold text-[#121821]">Test tool · plans and extra credits (no purchases exist yet)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Account email" aria-label="Account email" className={`${field} min-w-[220px] flex-1`} />
          <button onClick={lookUp} disabled={!email.trim()} className={btnSecondary}>
            Look up
          </button>
        </div>
        {note && <p className="mt-2 text-[12px] text-[#4f5b66]">{note}</p>}
        {account && (
          <div className="mt-4 flex flex-col gap-3 text-[12.5px] text-[#26313a]">
            <p>
              <b>{account.email}</b> {account.admin && "· admin (not limited)"} · {PLAN_NAMES[account.balances.plan]} · period{" "}
              {new Date(account.balances.period.start).toLocaleDateString()} – {new Date(account.balances.period.end).toLocaleDateString()}
            </p>
            {(["photo", "live"] as const).map((k) => {
              const b = account.balances[k];
              return (
                <p key={k}>
                  {k === "photo" ? "Photo" : "Live"}: {b.planLeft} of {b.allowance} plan left · {b.extraLeft} extra · <b>{b.total} total</b>
                  {b.overLimit ? ` · ${b.overLimit} over the limit` : ""}
                </p>
              );
            })}
            <div className="flex flex-wrap items-center gap-2">
              <select value={plan} onChange={(e) => setPlan(e.target.value as PlanKey)} aria-label="Plan" className={field}>
                {PLAN_KEYS.map((p) => (
                  <option key={p} value={p}>
                    {PLAN_NAMES[p]}
                  </option>
                ))}
              </select>
              <button onClick={() => act({ action: "setPlan", plan })} className={btnSecondary}>
                Set plan
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={kind} onChange={(e) => setKind(e.target.value as "photo" | "live")} aria-label="Credit kind" className={field}>
                <option value="photo">Photo</option>
                <option value="live">Live</option>
              </select>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" aria-label="Amount" className={`${field} w-20`} />
              <button onClick={() => act({ action: "adjust", kind, amount: Number(amount) })} className={btnSecondary}>
                Add extra credits
              </button>
            </div>
            {account.recent.length > 0 && (
              <ul className="mt-1 max-h-48 overflow-y-auto text-[11.5px] text-[#5d6874]">
                {account.recent.map((e, i) => (
                  <li key={i}>
                    {new Date(e.createdAt).toLocaleString()} · {e.kind} · {e.type} · {e.source} · {e.amount > 0 ? `+${e.amount}` : e.amount} · {e.status}
                    {e.outcome ? ` (${e.outcome})` : ""}
                    {e.note ? ` · ${e.note}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
