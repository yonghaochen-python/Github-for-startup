"use client";

import { useEffect, useState } from "react";
import { refreshCredits } from "@/components/Credits";

type Kind = "photo" | "live" | "outfit" | "stylist";

/**
 * "How was this?" with Good / Bad, under a try-on, a live session, a Style it outfit or an AI Stylist report. The
 * month's first Bad on a real result adds extra try-ons (the server decides); the page just says so.
 */
export function Feedback({ kind, targetId, dark = false, className = "" }: { kind: Kind; targetId: string | null | undefined; dark?: boolean; className?: string }) {
  const [rating, setRating] = useState<"good" | "bad" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // A new result starts unrated.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the result changes
    setRating(null);
    setNote(null);
  }, [targetId]);

  if (!targetId) return null;

  async function send(next: "good" | "bad") {
    if (sending || next === rating) return;
    setSending(true);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, targetId, rating: next }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { rewarded?: boolean } | undefined;
    setSending(false);
    if (!res?.ok) {
      setNote("Couldn't send that. Please try again.");
      return;
    }
    setRating(next);
    if (data?.rewarded) {
      setNote("Sorry it wasn't great. We added 2 photo try-ons and 2 live try-ons to your account.");
      refreshCredits();
    } else setNote(next === "good" ? "Thanks!" : "Thanks for telling us. We'll use it to improve.");
  }

  const muted = dark ? "text-white/70" : "text-[#5d6874]";
  const button = (active: boolean) =>
    `inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium transition ${
      active ? (dark ? "bg-white text-[#121821]" : "bg-[#121821] text-white") : dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-[#eef1f4] text-[#2b3540] hover:bg-[#e2e7ec]"
    }`;

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] ${className}`} role="group" aria-label="Rate this result">
      <span className={muted}>How was this?</span>
      <button onClick={() => send("good")} disabled={sending} aria-pressed={rating === "good"} className={button(rating === "good")}>
        👍 Good
      </button>
      <button onClick={() => send("bad")} disabled={sending} aria-pressed={rating === "bad"} className={button(rating === "bad")}>
        👎 Bad
      </button>
      {note && (
        <span role="status" className={`w-full ${muted} ${className.includes("justify-center") ? "text-center" : ""}`}>
          {note}
        </span>
      )}
    </div>
  );
}
