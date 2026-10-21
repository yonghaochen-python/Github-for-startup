"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { hoursLeft, useSharePick } from "@/components/HelpMePick";
import { useToast } from "@/components/Toast";
import { PageShell, btnPrimary, btnSecondary, btnText, surface } from "@/components/ui";

type PickData = {
  pick: { labelA: string; labelB: string; votesA: number; votesB: number; expiresAt: string; ownerName: string | null };
  isOwner: boolean;
  myVote: "a" | "b" | null;
};

const SIDES = ["a", "b"] as const;

export function PickView({ code }: { code: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const sharePick = useSharePick();
  const [data, setData] = useState<PickData | null>(null);
  const [ended, setEnded] = useState(false);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    let stop = false;
    async function load() {
      const res = await fetch(`/api/picks/${code}`).catch(() => null);
      if (stop) return;
      if (res?.status === 404) return setEnded(true);
      if (res?.ok) setData((await res.json()) as PickData);
    }
    load();
    // The owner watches the votes come in.
    const timer = setInterval(load, 15000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [code]);

  async function vote(choice: "a" | "b") {
    if (!data || data.isOwner || data.myVote || voting) return;
    setVoting(true);
    try {
      const res = await fetch(`/api/picks/${code}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      const result = (await res.json().catch(() => ({}))) as { votesA?: number; votesB?: number; myVote?: "a" | "b"; error?: string };
      if (res.status === 404) return setEnded(true);
      if (!res.ok) throw new Error(result.error);
      setData({ ...data, pick: { ...data.pick, votesA: result.votesA ?? 0, votesB: result.votesB ?? 0 }, myVote: result.myVote ?? choice });
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : "Couldn't send your vote. Please try again.");
    } finally {
      setVoting(false);
    }
  }

  const tryVirm = (
    <div className={`${surface} mt-8 p-6 text-center`}>
      <h2 className="font-display text-[26px] leading-tight text-[#121821]">Your turn</h2>
      <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-[#445159]">Put outfits on a model and see what works. Free, no account.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link href="/try" className={btnPrimary}>
          Try it on yourself
        </Link>
        <Link href="/login?create=1" className={btnSecondary}>
          Create your closet
        </Link>
      </div>
    </div>
  );

  if (ended) {
    return (
      <main className="flex-1 pb-16">
        <PageShell className="pt-10">
          <div className={`${surface} mx-auto max-w-md p-8 text-center`}>
            <h1 className="font-display text-[30px] leading-tight text-[#121821]">These looks aren&apos;t shared anymore</h1>
            <p className="mt-2 text-[13.5px] text-[#445159]">Shared links close after 48 hours, and the pictures are deleted.</p>
          </div>
          {!user && tryVirm}
        </PageShell>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex-1 pb-16">
        <PageShell className="pt-10">
          <p className="text-center text-[13.5px] text-[#445159]">Loading…</p>
        </PageShell>
      </main>
    );
  }

  const { pick, isOwner, myVote } = data;
  const total = pick.votesA + pick.votesB;
  const showResults = isOwner || Boolean(myVote);
  const who = pick.ownerName ?? "Your friend";
  const percent = (side: "a" | "b") => (total ? Math.round(((side === "a" ? pick.votesA : pick.votesB) / total) * 100) : 0);

  return (
    <main className="flex-1 pb-16">
      <PageShell className="pt-8">
        <div className="mb-6 text-center">
          <p className="text-[13px] text-[#5d6874]">{isOwner ? "Your shared looks" : `${who} can't decide.`}</p>
          <h1 className="font-display text-[34px] leading-tight text-[#121821] sm:text-[42px]">Which one tonight?</h1>
          {!isOwner && !myVote && <p className="mt-1 text-[13.5px] text-[#445159]">Tap the one you like.</p>}
        </div>

        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:gap-5">
          {SIDES.map((side) => {
            const mine = myVote === side;
            return (
              <button
                key={side}
                onClick={() => vote(side)}
                disabled={isOwner || Boolean(myVote) || voting}
                aria-label={`Vote ${side.toUpperCase()}: ${side === "a" ? pick.labelA : pick.labelB}`}
                className={`${surface} group relative block overflow-hidden text-left transition disabled:cursor-default ${
                  mine ? "ring-[3px] ring-[#121821]" : !showResults ? "hover:-translate-y-0.5" : ""
                }`}
              >
                <div className="relative aspect-[3/4] bg-[#f4f5f6]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- shared by link, short-lived */}
                  <img src={`/api/picks/${code}/image/${side}`} alt={`Look ${side.toUpperCase()}`} className="absolute inset-0 h-full w-full object-contain" />
                  <span className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#121821] text-[14px] font-semibold text-white">
                    {side.toUpperCase()}
                  </span>
                  {showResults && (
                    <span className="absolute bottom-2 right-2 rounded-full bg-white/95 px-3 py-1 text-[15px] font-semibold text-[#121821] shadow-sm">
                      {percent(side)}%
                    </span>
                  )}
                </div>
                <p className="truncate px-3 py-2.5 text-[13px] text-[#29343a]">
                  {mine && <b>Your vote · </b>}
                  {side === "a" ? pick.labelA : pick.labelB}
                </p>
              </button>
            );
          })}
        </div>

        {showResults && (
          <div className="mx-auto mt-4 max-w-3xl">
            <p className="text-center text-[13px] text-[#445159]">
              {total} {total === 1 ? "vote" : "votes"} · {hoursLeft(pick.expiresAt)}
              {!isOwner && ` · Thanks! ${who === "Your friend" ? "They'll" : `${who} will`} see your vote.`}
            </p>
          </div>
        )}

        {isOwner ? (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={() => sharePick(code)} className={btnPrimary}>
              Share
            </button>
            <Link href="/outfits/saved" className={btnText}>
              Back to Saved
            </Link>
          </div>
        ) : user ? (
          <div className="mt-8 text-center">
            <Link href="/outfits/saved" className={btnSecondary}>
              Make your own pick
            </Link>
          </div>
        ) : (
          myVote && tryVirm
        )}
      </PageShell>
    </main>
  );
}
