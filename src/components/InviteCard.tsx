"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { INVITE_TRIAL_DAYS } from "@/lib/plans";
import { btnSecondary, eyebrow } from "@/components/ui";

type Invite = { code: string; url: string; joined: number };

/** Profile: your invite code. Friends who join with it get a 14-day Plus trial. Hidden while billing is off. */
export function InviteCard() {
  const [invite, setInvite] = useState<Invite | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/invite", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as Invite) : null))
      .then(setInvite)
      .catch(() => {});
  }, []);

  if (!invite) return null;

  async function share() {
    if (!invite) return;
    const text = `Try VIRM with my code ${invite.code}: ${INVITE_TRIAL_DAYS} days of Plus, free.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "VIRM", text, url: invite.url });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${invite.url}`);
      showToast("Invite link copied.");
    } catch {
      showToast(invite.url);
    }
  }

  return (
    <div className="mt-6">
      <p className={eyebrow}>Invite a friend</p>
      <p className="mt-1.5 text-[13px] text-[#4f5b66]">Friends who join with your code get {INVITE_TRIAL_DAYS} days of Plus, free.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-[#f4f3f0] px-4 py-2 font-mono text-[14px] tracking-[1px] text-[#121821]">{invite.code}</span>
        <button onClick={share} className={btnSecondary}>
          Share
        </button>
      </div>
      {invite.joined > 0 && (
        <p className="mt-2 text-[12px] text-[#5d6874]">
          {invite.joined} {invite.joined === 1 ? "friend has" : "friends have"} joined.
        </p>
      )}
    </div>
  );
}
