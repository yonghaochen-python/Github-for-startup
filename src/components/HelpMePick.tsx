"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Outfit } from "@/components/OutfitCard";
import { useToast } from "@/components/Toast";
import { btnPrimary, btnSecondary, btnText, surface } from "@/components/ui";

/**
 * "Help me pick": choose two tried-on looks, share one link, and friends vote A or B without an account. The
 * link lands them on the vote, then on Try for fun. Picks end after 48 hours and their pictures are deleted.
 */

export type OpenPick = { code: string; labelA: string; labelB: string; votesA: number; votesB: number; expiresAt: string };

const SHARE_TEXT = "Which one tonight? Help me pick";

export const pickUrl = (code: string) => `${window.location.origin}/pick/${code}`;

/** Opens the phone's share sheet with the link, or copies it where sharing isn't available. */
export function useSharePick() {
  const { showToast } = useToast();
  return async function sharePick(code: string) {
    const url = pickUrl(code);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Which one tonight?", text: SHARE_TEXT, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return; // They closed the share sheet.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      window.prompt("Copy this link:", url);
    }
  };
}

export function hoursLeft(expiresAt: string): string {
  const hours = Math.max(0, (new Date(expiresAt).getTime() - Date.now()) / 3600000);
  return hours >= 1 ? `${Math.floor(hours)}h left` : "Ends soon";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = url;
  });
}

/** The side-by-side picture shown in link previews (Messages, WhatsApp…): look A and look B with their letters. */
async function makeCard(urls: [string, string]): Promise<Blob> {
  const [a, b] = await Promise.all(urls.map(loadImage));
  const W = 1200;
  const H = 800;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#eef1f3";
  ctx.fillRect(0, 0, W, H);
  [a, b].forEach((img, i) => {
    const boxW = W / 2 - 18;
    const boxX = i * (W / 2) + 9;
    const scale = Math.min(boxW / img.naturalWidth, (H - 18) / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, boxX + (boxW - w) / 2, (H - h) / 2, w, h);
    // The letter, top-left of each half.
    ctx.fillStyle = "#121821";
    ctx.beginPath();
    ctx.arc(boxX + 46, 46, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 32px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(i === 0 ? "A" : "B", boxX + 46, 47);
  });
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("card"))), "image/jpeg", 0.86));
}

const tryOnUrl = (look: Outfit) => `/api/outfits/${look.id}/try-on/image?v=${look.tryOn}`;
const lookName = (look: Outfit) => look.occasion?.trim() || `${look.layers.flatMap((l) => l.items).length}-piece look`;

/** The popup: choose two looks, agree to the link being viewable, then share it. */
function PickPopup({ looks, onClose, onStarted }: { looks: Outfit[]; onClose: () => void; onStarted: () => void }) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const sharePick = useSharePick();
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(id: string) {
    setChosen((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length < 2 ? [...list, id] : [list[1], id]));
  }

  async function start() {
    if (chosen.length !== 2) return;
    setBusy(true);
    setError(null);
    try {
      const [a, b] = chosen.map((id) => looks.find((l) => l.id === id)!);
      const card = await makeCard([tryOnUrl(a), tryOnUrl(b)]);
      const formData = new FormData();
      formData.append("outfitA", a.id);
      formData.append("outfitB", b.id);
      formData.append("card", card, "pick.jpg");
      const res = await fetch("/api/picks", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
      if (!res.ok || !data.code) throw new Error(data.error ?? "Couldn't start the pick right now. Please try again.");
      setCode(data.code);
      onStarted();
      overlayRef.current?.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the pick right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Help me pick"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#172027]/85 px-4 py-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="my-auto w-full max-w-xl shrink-0 rounded-[24px] bg-white p-6 sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[28px] leading-tight text-[#121821]">{code ? "Ready to send" : "Help me pick"}</h2>
            <p className="mt-1 text-[13.5px] text-[#445159]">
              {code ? "Send it to friends. They vote A or B, no account needed." : "Choose two looks. Friends vote on which one."}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 h-10 w-10 shrink-0 rounded-full text-[22px] text-[#5d6874] hover:bg-[#f0f2f3]">
            ×
          </button>
        </div>

        {error && <p className="mb-4 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {code ? (
          <>
            <div className="mb-5 grid grid-cols-2 gap-2">
              {chosen.map((id, i) => (
                <div key={id} className="relative aspect-[3/4] overflow-hidden rounded-[14px] bg-[#f4f5f6]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, owner-only image */}
                  <img src={tryOnUrl(looks.find((l) => l.id === id)!)} alt="" className="absolute inset-0 h-full w-full object-contain" />
                  <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#121821] text-[13px] font-semibold text-white">
                    {i === 0 ? "A" : "B"}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => sharePick(code)} className={`${btnPrimary} flex-1`}>
                Share
              </button>
              <Link href={`/pick/${code}`} className={btnSecondary}>
                See votes
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {looks.map((look) => {
                const at = chosen.indexOf(look.id);
                return (
                  <button
                    key={look.id}
                    onClick={() => toggle(look.id)}
                    aria-pressed={at >= 0}
                    aria-label={`${lookName(look)}${at >= 0 ? `, chosen as ${at === 0 ? "A" : "B"}` : ""}`}
                    className={`relative aspect-[3/4] overflow-hidden rounded-[14px] bg-[#f4f5f6] ${at >= 0 ? "ring-[3px] ring-[#121821]" : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, owner-only image */}
                    <img src={tryOnUrl(look)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
                    {at >= 0 && (
                      <span className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#121821] text-[13px] font-semibold text-white">
                        {at === 0 ? "A" : "B"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mb-4 text-[12.5px] text-[#445159]">Anyone with the link can see these two pictures for 48 hours. Then they&apos;re deleted.</p>
            <button onClick={start} disabled={busy || chosen.length !== 2} className={`${btnPrimary} w-full`}>
              {busy ? "Making your link…" : chosen.length === 2 ? "Make my link" : `Choose ${2 - chosen.length} more`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** The "Help me pick" button. Shown once there are two tried-on looks to choose from. */
export function HelpMePickButton({ looks, onStarted }: { looks: Outfit[]; onStarted: () => void }) {
  const [open, setOpen] = useState(false);
  const tried = looks.filter((l) => l.tryOn);
  if (tried.length < 2) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className={btnPrimary} data-tip="help-me-pick">
        Help me pick
      </button>
      {open && <PickPopup looks={tried} onClose={() => setOpen(false)} onStarted={onStarted} />}
    </>
  );
}

export function VoteBar({ a, b }: { a: number; b: number }) {
  const total = a + b;
  const shareA = total ? Math.round((a / total) * 100) : 50;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-[#e3e7ea]" aria-hidden>
      {total > 0 && <div className="h-full bg-[#121821]" style={{ width: `${shareA}%` }} />}
    </div>
  );
}

/** The person's open picks with the votes so far. Refreshes every so often while the page is open. */
export function OpenPicks({ refreshKey }: { refreshKey: number }) {
  const [picks, setPicks] = useState<OpenPick[]>([]);
  const sharePick = useSharePick();
  const { showToast } = useToast();

  const load = useCallback(async () => {
    const res = await fetch("/api/picks").catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { picks?: OpenPick[] };
    setPicks(data.picks ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads on open and after a new pick
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load, refreshKey]);

  async function end(code: string) {
    if (!window.confirm("End this pick? Its link stops working and the pictures are deleted.")) return;
    const res = await fetch(`/api/picks/${code}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Couldn't end the pick. Please try again.");
      return;
    }
    setPicks((list) => list.filter((p) => p.code !== code));
    showToast("Pick ended");
  }

  if (picks.length === 0) return null;
  return (
    <section aria-label="Your picks" className="mb-8">
      <h2 className="mb-3 text-[13px] font-semibold text-[#29343a]">Your picks</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {picks.map((pick) => (
          <div key={pick.code} className={`${surface} p-4`}>
            <Link href={`/pick/${pick.code}`} className="block">
              <div className="mb-2 flex items-baseline justify-between gap-3 text-[13px] text-[#29343a]">
                <span className="min-w-0 truncate">
                  <b>A</b> {pick.votesA} · <b>B</b> {pick.votesB}
                </span>
                <span className="shrink-0 text-[12px] text-[#5d6874]">{hoursLeft(pick.expiresAt)}</span>
              </div>
              <VoteBar a={pick.votesA} b={pick.votesB} />
            </Link>
            <div className="mt-2 flex gap-4">
              <button onClick={() => sharePick(pick.code)} className={btnText}>
                Share again
              </button>
              <button onClick={() => end(pick.code)} className={btnText}>
                End
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

