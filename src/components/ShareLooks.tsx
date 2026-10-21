"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Outfit } from "@/components/OutfitCard";
import { useToast } from "@/components/Toast";
import { btnPrimary, btnSecondary, btnText, surface } from "@/components/ui";

/**
 * "Share looks": share 2–4 tried-on looks in one link, and friends vote for one without an account. The link
 * lands them on the vote, then on Try for fun. Links end after 48 hours and their pictures are deleted.
 *
 * Looks are chosen two ways: the share arrow on a look in Studio adds it to a "to share" list (open another
 * outfit and tap its arrow to add that too), or Share looks on Saved lets you pick several at once.
 */

export const MIN_LOOKS = 2;
export const MAX_LOOKS = 4;
export const LETTERS = "ABCD";

/** A look to share: its outfit, its try-on picture's version, and a name. */
export type ShareLook = { id: string; v: string; label: string };
export type OpenPick = { code: string; labels: string[]; counts: number[]; expiresAt: string };

const SHARE_TEXT = "Which one tonight? Tap to vote";

export const pickUrl = (code: string) => `${window.location.origin}/pick/${code}`;
const pictureUrl = (look: ShareLook) => `/api/outfits/${look.id}/try-on/image?v=${look.v}`;

/* The "to share" list, kept on this device so it survives moving between outfits and pages. */
const TRAY_KEY = "virm-share-tray";
const TRAY_EVENT = "virm-share-tray";
let trayCache: { raw: string | null; looks: ShareLook[] } = { raw: null, looks: [] };

function readTray(): ShareLook[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(TRAY_KEY);
  } catch {}
  if (raw !== trayCache.raw) {
    let looks: ShareLook[] = [];
    try {
      looks = raw ? (JSON.parse(raw) as ShareLook[]).filter((l) => l && typeof l.id === "string").slice(0, MAX_LOOKS) : [];
    } catch {}
    trayCache = { raw, looks };
  }
  return trayCache.looks;
}

function writeTray(looks: ShareLook[]) {
  try {
    if (looks.length) localStorage.setItem(TRAY_KEY, JSON.stringify(looks));
    else localStorage.removeItem(TRAY_KEY);
  } catch {}
  window.dispatchEvent(new Event(TRAY_EVENT));
}

function subscribeTray(onChange: () => void) {
  window.addEventListener(TRAY_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(TRAY_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const NO_LOOKS: ShareLook[] = [];

export function useShareTray() {
  const looks = useSyncExternalStore(subscribeTray, readTray, () => NO_LOOKS);
  return {
    looks,
    toggle: (look: ShareLook) =>
      writeTray(looks.some((l) => l.id === look.id) ? looks.filter((l) => l.id !== look.id) : [...looks, look].slice(-MAX_LOOKS)),
    remove: (id: string) => writeTray(looks.filter((l) => l.id !== id)),
    clear: () => writeTray([]),
  };
}

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

/** The picture shown in link previews (Messages, WhatsApp…): the looks side by side with their letters. */
async function makeCard(urls: string[]): Promise<Blob> {
  const images = await Promise.all(urls.map(loadImage));
  const W = 1200;
  const H = 800;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#eef1f3";
  ctx.fillRect(0, 0, W, H);
  const colW = W / images.length;
  images.forEach((img, i) => {
    const boxW = colW - 18;
    const boxX = i * colW + 9;
    const scale = Math.min(boxW / img.naturalWidth, (H - 18) / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, boxX + (boxW - w) / 2, (H - h) / 2, w, h);
    ctx.fillStyle = "#121821";
    ctx.beginPath();
    ctx.arc(boxX + 40, 40, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 28px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(LETTERS[i], boxX + 40, 41);
  });
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("card"))), "image/jpeg", 0.86));
}

function Letter({ i, className = "" }: { i: number; className?: string }) {
  return (
    <span className={`absolute flex h-7 w-7 items-center justify-center rounded-full bg-[#121821] text-[13px] font-semibold text-white ${className}`}>
      {LETTERS[i]}
    </span>
  );
}

/** The popup: choose 2–4 looks, agree to the link being viewable, then share it. */
function SharePopup({
  looks,
  initial = [],
  onClose,
  onShared,
}: {
  looks: ShareLook[];
  initial?: string[];
  onClose: () => void;
  onShared?: () => void;
}) {
  // The looks as they were when the popup opened, so clearing the "to share" list doesn't empty it.
  const [shown] = useState(looks);
  const [chosen, setChosen] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const sharePick = useSharePick();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const byId = (id: string) => shown.find((l) => l.id === id)!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(id: string) {
    setChosen((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length < MAX_LOOKS ? [...list, id] : list));
  }

  async function start() {
    if (chosen.length < MIN_LOOKS) return;
    setBusy(true);
    setError(null);
    try {
      const card = await makeCard(chosen.map((id) => pictureUrl(byId(id))));
      const formData = new FormData();
      chosen.forEach((id) => formData.append("outfit", id));
      formData.append("card", card, "looks.jpg");
      const res = await fetch("/api/picks", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
      if (!res.ok || !data.code) throw new Error(data.error ?? "Couldn't make the link right now. Please try again.");
      setCode(data.code);
      onShared?.();
      overlayRef.current?.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make the link right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const need = MIN_LOOKS - chosen.length;
  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Share looks"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#172027]/85 px-4 py-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="my-auto w-full max-w-xl shrink-0 rounded-[24px] bg-white p-6 sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[28px] leading-tight text-[#121821]">{code ? "Ready to send" : "Share looks"}</h2>
            <p className="mt-1 text-[13.5px] text-[#445159]">
              {code ? "Friends tap the one they like. No account needed." : `Choose ${MIN_LOOKS} to ${MAX_LOOKS} looks. Friends vote for one.`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 h-10 w-10 shrink-0 rounded-full text-[22px] text-[#5d6874] hover:bg-[#f0f2f3]">
            ×
          </button>
        </div>

        {error && <p className="mb-4 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {code ? (
          <>
            <div className={`mb-5 grid gap-2 ${chosen.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {chosen.map((id, i) => (
                <div key={id} className="relative aspect-[3/4] overflow-hidden rounded-[14px] bg-[#f4f5f6]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, owner-only image */}
                  <img src={pictureUrl(byId(id))} alt="" className="absolute inset-0 h-full w-full object-contain" />
                  <Letter i={i} className="left-2 top-2" />
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
              {shown.map((look) => {
                const at = chosen.indexOf(look.id);
                return (
                  <button
                    key={look.id}
                    onClick={() => toggle(look.id)}
                    aria-pressed={at >= 0}
                    aria-label={`${look.label}${at >= 0 ? `, look ${LETTERS[at]}` : ""}`}
                    className={`relative aspect-[3/4] overflow-hidden rounded-[14px] bg-[#f4f5f6] ${at >= 0 ? "ring-[3px] ring-[#121821]" : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, owner-only image */}
                    <img src={pictureUrl(look)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
                    {at >= 0 && <Letter i={at} className="left-1.5 top-1.5" />}
                  </button>
                );
              })}
            </div>
            <p className="mb-4 text-[12.5px] text-[#445159]">Anyone with the link can see these pictures for 48 hours. Then they&apos;re deleted.</p>
            <button onClick={start} disabled={busy || need > 0} className={`${btnPrimary} w-full`}>
              {busy ? "Making your link…" : need > 0 ? `Choose ${need} more` : `Make my link (${chosen.length} looks)`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export const shareLookFrom = (outfit: Outfit): ShareLook => ({
  id: outfit.id,
  v: outfit.tryOn ?? "1",
  label: outfit.occasion?.trim() || `${outfit.layers.flatMap((l) => l.items).length}-piece look`,
});

/** Saved: "Share looks", shown once there are two tried-on looks to choose from. */
export function ShareLooksButton({ looks, onShared }: { looks: Outfit[]; onShared: () => void }) {
  const [open, setOpen] = useState(false);
  const tried = looks.filter((l) => l.tryOn).map(shareLookFrom);
  if (tried.length < MIN_LOOKS) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className={btnPrimary}>
        <ShareIcon className="h-4 w-4" /> Share looks
      </button>
      {open && <SharePopup looks={tried} onClose={() => setOpen(false)} onShared={onShared} />}
    </>
  );
}

/** The share arrow (a box with an arrow coming out of it). */
export function ShareIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 15V3.5" />
      <path d="m7.5 8 4.5-4.5L16.5 8" />
      <path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v7A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  );
}

/** Studio: the share arrow on a tried-on look. Adds it to (or takes it out of) the "to share" list. */
export function ShareArrowButton({ look, className = "" }: { look: ShareLook; className?: string }) {
  const tray = useShareTray();
  const { showToast } = useToast();
  const at = tray.looks.findIndex((l) => l.id === look.id);
  return (
    <button
      onClick={() => {
        if (at < 0 && tray.looks.length >= MAX_LOOKS) return showToast(`You can share up to ${MAX_LOOKS} looks at once.`);
        tray.toggle(look);
      }}
      aria-pressed={at >= 0}
      aria-label={at >= 0 ? `Look ${LETTERS[at]} to share. Tap to take it out` : "Share this look"}
      title={at >= 0 ? "Added to share" : "Share this look"}
      className={`flex h-11 w-11 items-center justify-center rounded-full shadow-sm ${
        at >= 0 ? "bg-[#121821] text-white" : "bg-white/90 text-[#121821] hover:bg-white"
      } ${className}`}
    >
      {at >= 0 ? <span className="text-[15px] font-semibold">{LETTERS[at]}</span> : <ShareIcon className="h-5 w-5" />}
    </button>
  );
}

/** Studio: the looks waiting to be shared, and the button that shares them. */
export function ShareTray({ onShared }: { onShared?: () => void }) {
  const tray = useShareTray();
  const [open, setOpen] = useState(false);
  if (tray.looks.length === 0 && !open) return null;
  const ready = tray.looks.length >= MIN_LOOKS;
  return (
    <>
      {tray.looks.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-[16px] bg-[#f4f5f6] p-2.5" aria-label="Looks to share">
          <ul className="flex shrink-0 gap-1.5">
            {tray.looks.map((look, i) => (
              <li key={look.id} className="relative h-14 w-11 overflow-hidden rounded-[8px] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, owner-only image */}
                <img src={pictureUrl(look)} alt={look.label} className="absolute inset-0 h-full w-full object-cover" />
                <button
                  onClick={() => tray.remove(look.id)}
                  aria-label={`Take look ${LETTERS[i]} out`}
                  className="absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#121821] text-[10px] font-semibold text-white"
                >
                  {LETTERS[i]}
                </button>
              </li>
            ))}
          </ul>
          {/* On phones the letters say it; the count only shows where there's room. */}
          <p className={`min-w-0 flex-1 text-[12.5px] leading-snug text-[#445159] ${ready ? "invisible sm:visible" : ""}`}>
            {ready ? `${tray.looks.length} looks to share` : "Open another outfit and tap its arrow to add it."}
          </p>
          <button onClick={() => setOpen(true)} disabled={!ready} className={`${btnPrimary} min-h-[40px] shrink-0 px-4`}>
            <ShareIcon className="h-4 w-4" /> Share
          </button>
        </div>
      )}
      {open && (
        <SharePopup
          looks={tray.looks}
          initial={tray.looks.map((l) => l.id)}
          onClose={() => setOpen(false)}
          onShared={() => {
            tray.clear();
            onShared?.();
          }}
        />
      )}
    </>
  );
}

export function VoteBar({ counts }: { counts: number[] }) {
  const total = counts.reduce((a, b) => a + b, 0);
  const shades = ["#121821", "#5d6874", "#9aa5ad", "#c9d0d5"];
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-[#e3e7ea]" aria-hidden>
      {total > 0 && counts.map((n, i) => <div key={i} className="h-full" style={{ width: `${(n / total) * 100}%`, background: shades[i] }} />)}
    </div>
  );
}

/** Saved: the person's open shares with the votes so far. Refreshes every so often while the page is open. */
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads on open and after a new share
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load, refreshKey]);

  async function end(code: string) {
    if (!window.confirm("Stop sharing? The link stops working and the pictures are deleted.")) return;
    const res = await fetch(`/api/picks/${code}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Couldn't stop sharing. Please try again.");
      return;
    }
    setPicks((list) => list.filter((p) => p.code !== code));
    showToast("Stopped sharing");
  }

  if (picks.length === 0) return null;
  return (
    <section aria-label="Shared looks" className="mb-8">
      <h2 className="mb-3 text-[13px] font-semibold text-[#29343a]">Shared looks</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {picks.map((pick) => (
          <div key={pick.code} className={`${surface} p-4`}>
            <Link href={`/pick/${pick.code}`} className="block">
              <div className="mb-2 flex items-baseline justify-between gap-3 text-[13px] text-[#29343a]">
                <span className="min-w-0 truncate">
                  {pick.counts.map((n, i) => (
                    <span key={i} className="mr-2.5">
                      <b>{LETTERS[i]}</b> {n}
                    </span>
                  ))}
                </span>
                <span className="shrink-0 text-[12px] text-[#5d6874]">{hoursLeft(pick.expiresAt)}</span>
              </div>
              <VoteBar counts={pick.counts} />
            </Link>
            <div className="mt-2 flex gap-4">
              <button onClick={() => sharePick(pick.code)} className={btnText}>
                Share again
              </button>
              <button onClick={() => end(pick.code)} className={btnText}>
                Stop sharing
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
