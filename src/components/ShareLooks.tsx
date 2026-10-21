"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Outfit } from "@/components/OutfitCard";
import { useToast } from "@/components/Toast";
import { btnPrimary, btnText, surface } from "@/components/ui";

/**
 * "Share looks": share 1–4 tried-on looks in one link. With one look, friends can tap Love it; with more, they vote
 * for one. No account needed either way, and the page invites them to Try for fun. Links end after 48 hours and
 * their pictures are deleted.
 *
 * Looks are chosen two ways: the share arrow on a look in Studio adds it to a "to share" list (open another
 * outfit and tap its arrow to add that too), or Share looks on Saved lets you pick several at once.
 */

export const MIN_LOOKS = 1;
export const MAX_LOOKS = 4;
export const LETTERS = "ABCD";

/** A look to share: its outfit, its try-on picture's version, and a name. */
export type ShareLook = { id: string; v: string; label: string };
export type OpenPick = { code: string; labels: string[]; counts: number[]; expiresAt: string };

/** The message that goes with the link: a vote for several looks, a quick opinion for one. */
export const shareText = (looks: number) => (looks > 1 ? "Which one tonight? Tap to vote" : "How does this look?");
export const shareTitle = (looks: number) => (looks > 1 ? "Which one tonight?" : "How does this look?");

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
  };
}

/** Copies the link. Returns false where copying isn't allowed, so the link can be shown to copy by hand. */
export function useCopyLink() {
  const { showToast } = useToast();
  return async function copyLink(code: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(pickUrl(code));
      showToast("Link copied");
      return true;
    } catch {
      return false;
    }
  };
}

/**
 * Opens the device's own share sheet (Messages, Instagram, WhatsApp, Mail…). The preview picture goes along with
 * the link, so apps that only take pictures still get the looks. Without a share sheet, the link is copied.
 * Returns false only when nothing worked (no share sheet and copying blocked).
 */
export function useSharePick() {
  const copyLink = useCopyLink();
  return async function sharePick(code: string, looks: number, card?: Blob | null): Promise<boolean> {
    const url = pickUrl(code);
    if (navigator.share) {
      const file = card ? new File([card], "which-one.jpg", { type: "image/jpeg" }) : null;
      try {
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: `${shareText(looks)}\n${url}` });
        } else {
          await navigator.share({ title: shareTitle(looks), text: shareText(looks), url });
        }
        return true;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return true; // They closed the share sheet.
      }
    }
    return copyLink(code);
  };
}

/** The picture as a PNG file, for saving (and posting to Instagram by hand). */
async function toPng(image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}

const shareIcon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
    <path d={d} />
  </svg>
);
const SEND_ICONS = {
  message: shareIcon("M4 5h16v11H8l-4 4z"),
  whatsapp: shareIcon("M5 19l1.3-3.8A7.5 7.5 0 1 1 9 18z"),
  x: shareIcon("M5 5l14 14M19 5 5 19"),
  pinterest: shareIcon("M12 21l2-8m-3.5 1A4.5 4.5 0 1 1 16.5 10c0 3-2 5-4 4"),
  email: shareIcon("M4 6h16v12H4zM4 7l8 6 8-6"),
  link: shareIcon("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"),
  save: shareIcon("M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 20h14"),
};

/**
 * The ways to send a share link: the device's share sheet (with the picture), then iMessage, WhatsApp, X, Pinterest,
 * Email, Copy link and Save image (for Instagram, which only takes pictures).
 */
export function ShareOptions({ code, looks, card }: { code: string; looks: number; card?: Blob | null }) {
  const sharePick = useSharePick();
  const copyLink = useCopyLink();
  const { showToast } = useToast();
  // Shown when the browser won't copy for us (browser pop-ups can be blocked too, so it's on the page).
  const [showLink, setShowLink] = useState(false);
  // The preview picture is fetched ahead of time: share sheets only open straight from a tap.
  const [picture, setPicture] = useState<Blob | null>(card ?? null);
  useEffect(() => {
    if (card) return;
    let stop = false;
    fetch(`/api/picks/${code}/image/card`)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => !stop && setPicture(blob))
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [code, card]);

  const link = typeof window === "undefined" ? "" : pickUrl(code);
  const text = encodeURIComponent(shareText(looks));
  const both = encodeURIComponent(`${shareText(looks)} ${link}`);
  const url = encodeURIComponent(link);
  const media = encodeURIComponent(`${typeof window === "undefined" ? "" : window.location.origin}/api/picks/${code}/image/card`);
  const sends: { label: string; href: string; icon: React.ReactNode }[] = [
    { label: "iMessage", href: `sms:?&body=${both}`, icon: SEND_ICONS.message },
    { label: "WhatsApp", href: `https://wa.me/?text=${both}`, icon: SEND_ICONS.whatsapp },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${text}&url=${url}`, icon: SEND_ICONS.x },
    { label: "Pinterest", href: `https://pinterest.com/pin/create/button/?url=${url}&media=${media}&description=${text}`, icon: SEND_ICONS.pinterest },
    { label: "Email", href: `mailto:?subject=${encodeURIComponent(shareTitle(looks))}&body=${both}`, icon: SEND_ICONS.email },
  ];

  /** One look saves its own picture; several save the side-by-side picture. */
  async function saveImage() {
    try {
      const res = await fetch(`/api/picks/${code}/image/${looks === 1 ? "0" : "card"}`);
      if (!res.ok) throw new Error();
      const png = await toPng(await res.blob());
      const a = document.createElement("a");
      a.href = URL.createObjectURL(png);
      a.download = looks === 1 ? "virm-look.png" : "virm-which-one.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch {
      showToast("Couldn't save the picture. Please try again.");
    }
  }

  const tile = "flex flex-col items-center gap-1.5 rounded-[14px] px-1 py-2.5 text-[11.5px] font-medium text-[#29343a] hover:bg-[#f0f2f3]";
  const circle = "flex h-11 w-11 items-center justify-center rounded-full bg-[#f0f2f3] text-[#121821]";
  return (
    <div className="flex flex-col gap-2.5">
      <button onClick={async () => setShowLink(!(await sharePick(code, looks, picture)))} className={`${btnPrimary} w-full`}>
        <ShareIcon className="h-4 w-4" /> Share
      </button>
      <div className="grid grid-cols-4 gap-1">
        {sends.map((s) => (
          <a key={s.label} href={s.href} target={s.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={tile}>
            <span className={circle}>{s.icon}</span>
            {s.label}
          </a>
        ))}
        <button onClick={async () => setShowLink(!(await copyLink(code)))} className={tile}>
          <span className={circle}>{SEND_ICONS.link}</span>
          Copy link
        </button>
        <button onClick={saveImage} className={tile}>
          <span className={circle}>{SEND_ICONS.save}</span>
          Save image
        </button>
      </div>
      <p className="text-center text-[11.5px] text-[#5d6874]">Save the image to post it to Instagram or your Story</p>
      {showLink && (
        <input
          readOnly
          autoFocus
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Link to copy"
          className="w-full rounded-[12px] bg-[#f0f2f3] px-3 py-2.5 text-[12.5px] text-[#121821]"
        />
      )}
    </div>
  );
}

/** "Stop sharing" with a confirmation on the page itself (browser pop-ups can be blocked, which made it do nothing). */
export function StopSharing({ code, onStopped, className = btnText }: { code: string; onStopped: () => void; className?: string }) {
  const { showToast } = useToast();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function stop() {
    setBusy(true);
    const res = await fetch(`/api/picks/${code}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      showToast("Couldn't stop sharing. Please try again.");
      return;
    }
    showToast("Stopped sharing");
    writeTray([]);
    onStopped();
  }

  if (!asking) {
    return (
      <button onClick={() => setAsking(true)} className={className}>
        Stop sharing
      </button>
    );
  }
  return (
    <span className="block basis-full pt-1 text-[13px] text-[#445159]">
      Delete the link and pictures?
      <span className="flex gap-5">
        <button onClick={stop} disabled={busy} className="min-h-[44px] font-semibold text-[#c23a2c] underline-offset-4 hover:underline">
          {busy ? "Stopping…" : "Yes, stop"}
        </button>
        <button onClick={() => setAsking(false)} disabled={busy} className="min-h-[44px] font-medium text-[#121821] underline-offset-4 hover:underline">
          Keep
        </button>
      </span>
    </span>
  );
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
    if (images.length === 1) return;
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

/** Makes a share link for these looks (with its preview picture) and takes them off the "to share" list. */
async function createShare(looks: ShareLook[]): Promise<{ code: string; card: Blob }> {
  const card = await makeCard(looks.map(pictureUrl));
  const formData = new FormData();
  looks.forEach((l) => formData.append("outfit", l.id));
  formData.append("card", card, "looks.jpg");
  const res = await fetch("/api/picks", { method: "POST", body: formData });
  const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
  if (!res.ok || !data.code) throw new Error(data.error ?? "Couldn't make the link right now. Please try again.");
  // These looks are shared now, so they leave the "to share" list (whether this was made from Studio or Saved).
  writeTray(readTray().filter((l) => !looks.some((x) => x.id === l.id)));
  return { code: data.code, card };
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
  makeNow = false,
  onClose,
  onShared,
}: {
  looks: ShareLook[];
  initial?: string[];
  /** Make the link as soon as it opens (the looks are already chosen), so it opens on Ready to send. */
  makeNow?: boolean;
  onClose: () => void;
  onShared?: () => void;
}) {
  // The looks as they were when the popup opened, so clearing the "to share" list doesn't empty it.
  const [shown] = useState(looks);
  const [chosen, setChosen] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [card, setCard] = useState<Blob | null>(null);
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
      const made = await createShare(chosen.map(byId));
      setCard(made.card);
      setCode(made.code);
      onShared?.();
      overlayRef.current?.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make the link right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Make the link once when opened from Studio's Share (the guard stops a second link if this runs twice).
  const madeOnOpen = useRef(false);
  useEffect(() => {
    if (!makeNow || madeOnOpen.current) return;
    madeOnOpen.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once when the popup opens
  }, []);

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
            <h2 className="font-display text-[28px] leading-tight text-[#121821]">{code || makeNow ? "Ready to send" : "Share looks"}</h2>
            <p className="mt-1 text-[13.5px] text-[#445159]">
              {code
                ? chosen.length > 1
                  ? "Friends tap the one they like. No account needed."
                  : "Friends can tap Love it. No account needed."
                : `Choose up to ${MAX_LOOKS}. Two or more makes it a vote.`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 h-10 w-10 shrink-0 rounded-full text-[22px] text-[#5d6874] hover:bg-[#f0f2f3]">
            ×
          </button>
        </div>

        {error && <p className="mb-4 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {makeNow && !code ? (
          <div className="flex flex-col items-center gap-3 py-10">
            {busy && <span className="h-8 w-8 animate-spin rounded-full border-2 border-black/[0.07] border-t-[#29343a]" aria-hidden />}
            <p className="text-[13.5px] text-[#445159]">{busy ? "Making your link…" : "Couldn't make the link."}</p>
            {!busy && (
              <button onClick={start} className={btnText}>
                Try again
              </button>
            )}
          </div>
        ) : code ? (
          <>
            <div className={`mx-auto mb-5 grid gap-2 ${chosen.length === 1 ? "max-w-[240px] grid-cols-1" : chosen.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {chosen.map((id, i) => (
                <div key={id} className="relative aspect-[3/4] overflow-hidden rounded-[14px] bg-[#f4f5f6]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, owner-only image */}
                  <img src={pictureUrl(byId(id))} alt="" className="absolute inset-0 h-full w-full object-contain" />
                  {chosen.length > 1 && <Letter i={i} className="left-2 top-2" />}
                </div>
              ))}
            </div>
            <ShareOptions code={code} looks={chosen.length} card={card} />
            <p className="mt-2 text-center text-[11.5px] text-[#5d6874]">
              Anyone with the link can see {chosen.length === 1 ? "this" : "these"} for 48 hours.
            </p>
            <Link href={`/pick/${code}`} className={`${btnText} mt-2 w-full justify-center`}>
              {chosen.length > 1 ? "See votes" : "See loves"}
            </Link>
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
            <p className="mb-4 text-[12.5px] text-[#445159]">Anyone with the link can see {chosen.length === 1 ? "this picture" : "these pictures"} for 48 hours. Then they&apos;re deleted.</p>
            <button onClick={start} disabled={busy || need > 0} className={`${btnPrimary} w-full`}>
              {busy ? "Making your link…" : need > 0 ? "Choose a look" : `Make my link (${chosen.length} ${chosen.length === 1 ? "look" : "looks"})`}
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

/** Saved: "Share looks", shown once there's a saved, tried-on look to share. */
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

/** Studio: the looks waiting to be shared. Share opens the small popup straight on Ready to send (close it to back out). */
export function ShareTray() {
  const tray = useShareTray();
  // The looks being shared, kept while the popup is open (sharing takes them off the list).
  const [sharing, setSharing] = useState<ShareLook[] | null>(null);
  if (tray.looks.length === 0 && !sharing) return null;
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
          {/* On phones the letters say it; the hint only shows where there's room once it's a vote. */}
          <p className={`min-w-0 flex-1 text-[12.5px] leading-snug text-[#445159] ${tray.looks.length > 1 ? "invisible sm:visible" : ""}`}>
            {tray.looks.length > 1 ? `${tray.looks.length} looks to share` : "Share it, or add another outfit for a vote."}
          </p>
          <button onClick={() => setSharing(tray.looks)} className={`${btnPrimary} min-h-[40px] shrink-0 px-4`}>
            <ShareIcon className="h-4 w-4" /> Share
          </button>
        </div>
      )}
      {sharing && <SharePopup looks={sharing} initial={sharing.map((l) => l.id)} makeNow onClose={() => setSharing(null)} />}
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
                  {pick.counts.length === 1 ? (
                    <>
                      <b>♥</b> {pick.counts[0]} {pick.counts[0] === 1 ? "love" : "loves"}
                    </>
                  ) : (
                    pick.counts.map((n, i) => (
                      <span key={i} className="mr-2.5">
                        <b>{LETTERS[i]}</b> {n}
                      </span>
                    ))
                  )}
                </span>
                <span className="shrink-0 text-[12px] text-[#5d6874]">{hoursLeft(pick.expiresAt)}</span>
              </div>
              {pick.counts.length > 1 && <VoteBar counts={pick.counts} />}
            </Link>
            <div className="mt-2 flex flex-wrap gap-x-4">
              <Link href={`/pick/${pick.code}`} className={btnText}>
                Share again
              </Link>
              <StopSharing code={pick.code} onStopped={() => setPicks((list) => list.filter((p) => p.code !== pick.code))} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
