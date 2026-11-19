"use client";

import { useEffect, useState } from "react";
import { btnPrimary } from "@/components/ui";

type Check = { name: string; ok: boolean; problem: string | null } | null;

/**
 * The first post: pick a username right here (it's how people see whose outfit it is), checked as you type, then on to
 * the post. Never the email; it can be changed later in Profile.
 */
export function PickUsername({ onPicked }: { onPicked: (username: string) => void }) {
  const [value, setValue] = useState("");
  const [check, setCheck] = useState<Check>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = value.trim().replace(/^@+/, "").toLowerCase();

  // Is it free and allowed? Asked a moment after typing stops.
  useEffect(() => {
    if (!name) return;
    let gone = false;
    const timer = setTimeout(() => {
      fetch(`/api/me/public-profile?check=${encodeURIComponent(name)}`, { cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<{ username: string; ok: boolean; problem: string | null }>) : null))
        .then((data) => !gone && data && setCheck({ name: data.username, ok: data.ok, problem: data.problem }))
        .catch(() => {});
    }, 350);
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [name]);

  const current = check && check.name === name ? check : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/me/public-profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: name }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { username?: string; error?: string }) : {};
    if (res?.ok && data.username) return onPicked(data.username);
    setError(data.error ?? "Couldn't save that. Please try again.");
    setSaving(false);
  }

  return (
    <form onSubmit={save} className="mx-auto mt-10 max-w-sm rounded-[22px] bg-white p-5 text-left shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]">
      <h1 className="font-display text-[26px] leading-tight text-[#121821]">Pick a username</h1>
      <p className="mt-1 text-[13px] text-[#4f5b66]">It shows on your posts, so people know whose outfit it is. You only do this once.</p>
      <label htmlFor="pick-username" className="sr-only">
        Username
      </label>
      <div className="pill-field mt-4 flex h-11 items-center rounded-full bg-[#f4f5f6] pl-4 pr-1.5">
        <span className="text-[15px] text-[#5d6874]">@</span>
        <input
          id="pick-username"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.slice(0, 24));
            setError(null);
          }}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="yourname"
          className="min-w-0 flex-1 bg-transparent px-1 text-[16px] text-[#121821] outline-none placeholder:text-[#8a949e]"
        />
        <button type="submit" disabled={!current?.ok || saving} className={`${btnPrimary} !min-h-[34px] !px-4 !py-1 !text-[12.5px]`}>
          {saving ? "Saving…" : "Done"}
        </button>
      </div>
      <p aria-live="polite" className={`mt-2 min-h-[18px] text-[12px] ${current && !current.ok ? "text-[#a1312a]" : "text-[#3d7a4f]"}`}>
        {error ?? (name && current ? (current.ok ? `@${current.name} is yours to take.` : current.problem) : "")}
      </p>
    </form>
  );
}
