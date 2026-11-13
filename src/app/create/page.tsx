"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClothingItem, Outfit } from "@/components/OutfitCard";
import { CAPTION_MAX, MAX_POST_ITEMS, MAX_TAGS, OCCASION_TAGS, STYLE_TAGS } from "@/lib/postRules";
import { PageShell, btnPrimary, btnSecondary, btnText, eyebrow } from "@/components/ui";

type Draft = { name: string; brand: string; store: string; link: string; category: string | null; closetItemId: string | null; thumb: string | null };
type Picture = { blob: Blob; url: string; width: number; height: number };

const blankItem = (): Draft => ({ name: "", brand: "", store: "", link: "", category: null, closetItemId: null, thumb: null });
const shortName = (d: string) => d.split(/[,;(]/)[0].trim().slice(0, 60);
/** A closet piece as the API sends it (with its brand, when known). */
type ClosetPiece = ClothingItem & { brand?: string | null };
const fromCloset = (c: ClosetPiece): Draft => ({
  name: shortName(c.description),
  brand: c.brand ?? "",
  store: "",
  link: "",
  category: c.category,
  closetItemId: c.id,
  thumb: c.imageUrl,
});

/** Shrinks the photo on this device (long side 1440 px, WebP), which also drops its location data. */
async function preparePicture(source: Blob): Promise<Picture> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, 1440 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo."))), "image/webp", 0.86));
  return { blob, url: URL.createObjectURL(blob), width, height };
}

/** Post an outfit: a photo (new, or a saved look's try-on), a caption, tags and optional pieces, then "Post publicly". */
export default function CreatePage() {
  const router = useRouter();
  const [access, setAccess] = useState<{ canPost: boolean; username: string | null } | null>(null);
  const [picture, setPicture] = useState<Picture | null>(null);
  const [saved, setSaved] = useState<Outfit[] | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [closet, setCloset] = useState<ClosetPiece[] | null>(null);
  const [showCloset, setShowCloset] = useState(false);
  const [caption, setCaption] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [items, setItems] = useState<Draft[]>([]);
  const [publicOk, setPublicOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/me/can-post", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { canPost: boolean; username: string | null }) : { canPost: false, username: null }))
      .then(setAccess)
      .catch(() => setAccess({ canPost: false, username: null }));
  }, []);
  useEffect(() => () => {
    if (picture) URL.revokeObjectURL(picture.url);
  }, [picture]);

  async function takePhoto(source: Blob) {
    setError(null);
    try {
      setPicture(await preparePicture(source));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that photo.");
    }
  }

  async function openSaved() {
    setShowSaved(true);
    if (saved) return;
    const res = await fetch("/api/outfits", { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { outfits: Outfit[] }) : { outfits: [] };
    setSaved(data.outfits.filter((o) => o.isFavorite && o.tryOn));
  }

  async function pickSaved(o: Outfit) {
    setShowSaved(false);
    const res = await fetch(`/api/outfits/${o.id}/try-on/image?v=${o.tryOn}`).catch(() => null);
    if (!res?.ok) return setError("Couldn't open that look's picture.");
    await takePhoto(await res.blob());
    // Its pieces come along (each can be edited or removed).
    setItems(o.layers.flatMap((l) => l.items).slice(0, MAX_POST_ITEMS).map(fromCloset));
    if (o.occasion) setCaption((c) => c || o.occasion!.charAt(0).toUpperCase() + o.occasion!.slice(1));
  }

  async function openCloset() {
    setShowCloset(true);
    if (closet) return;
    const res = await fetch("/api/closet/items", { cache: "no-store" }).catch(() => null);
    setCloset(res?.ok ? ((await res.json()) as { items: ClosetPiece[] }).items : []);
  }

  const toggle = (list: string[], set: (v: string[]) => void, tag: string) =>
    set(list.includes(tag) ? list.filter((t) => t !== tag) : list.length < MAX_TAGS ? [...list, tag] : list);
  const setItem = (i: number, patch: Partial<Draft>) => setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  async function post() {
    if (!picture) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("picture", picture.blob, "post.webp");
    form.append(
      "data",
      JSON.stringify({
        caption,
        styleTags: styles,
        occasionTags: occasions,
        width: picture.width,
        height: picture.height,
        items: items.filter((it) => it.name.trim()).map(({ name, brand, store, link, category, closetItemId }) => ({ name, brand, store, link, category, closetItemId })),
      })
    );
    const res = await fetch("/api/posts", { method: "POST", body: form }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { id?: string; error?: string }) : {};
    if (res?.ok && data.id) return router.push(`/p/${data.id}`);
    setError(data.error ?? "Couldn't post right now. Please try again.");
    setBusy(false);
  }

  if (!access) return <main className="flex-1" />;
  if (!access.canPost) {
    return (
      <main className="flex-1 pb-20">
        <PageShell className="pt-14 text-center">
          <p className="text-[15px] text-[#4f5b66]">Posting opens soon.</p>
        </PageShell>
      </main>
    );
  }
  if (!access.username) {
    return (
      <main className="flex-1 pb-20">
        <PageShell className="pt-14 text-center">
          <p className="text-[15px] text-[#4f5b66]">Pick a username first, so people know whose outfit it is.</p>
          <Link href="/profile" className={`${btnPrimary} mt-5`}>
            Pick a username
          </Link>
        </PageShell>
      </main>
    );
  }

  const field =
    "h-10 w-full min-w-0 rounded-[10px] bg-white px-3 text-[13.5px] text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_#121821]";
  const chip = (on: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ${on ? "bg-[#121821] text-white" : "bg-white text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)]"}`;

  return (
    <main className="flex-1 pb-24">
      <PageShell className="max-w-xl pt-8">
        <h1 className="font-display text-[36px] leading-none text-[#121821]">New post</h1>

        {/* The photo */}
        <section className="mt-6">
          {picture ? (
            <div className="relative overflow-hidden rounded-[18px] bg-[#f1efeb]">
              {/* eslint-disable-next-line @next/next/no-img-element -- the person's own photo, not uploaded yet */}
              <img src={picture.url} alt="Your outfit photo" className="mx-auto max-h-[60vh] w-auto" />
              <button onClick={() => setPicture(null)} className="absolute right-3 top-3 rounded-full bg-white/95 px-3.5 py-1.5 text-[12px] font-semibold text-[#121821] shadow">
                Change
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => fileInput.current?.click()} className="flex aspect-[3/4] flex-col items-center justify-center rounded-[18px] bg-white text-[14px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)]">
                <span className="text-[28px] font-light">＋</span>
                Photo
              </button>
              <button onClick={openSaved} className="flex aspect-[3/4] flex-col items-center justify-center rounded-[18px] bg-white text-[14px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)]">
                <span className="text-[24px]">🔖</span>
                A saved look
              </button>
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void takePhoto(file);
            }}
          />
          {showSaved && (
            <div className="mt-3 rounded-[18px] bg-white p-3 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]">
              {!saved ? (
                <p className="p-2 text-[13px] text-[#5d6874]">Loading…</p>
              ) : saved.length === 0 ? (
                <p className="p-2 text-[13px] text-[#5d6874]">No saved looks with a try-on picture yet.</p>
              ) : (
                <ul className="grid grid-cols-3 gap-2">
                  {saved.map((o) => (
                    <li key={o.id}>
                      <button onClick={() => pickSaved(o)} className="block w-full overflow-hidden rounded-[12px] bg-[#f1efeb]">
                        {/* eslint-disable-next-line @next/next/no-img-element -- the person's own saved look */}
                        <img src={`/api/outfits/${o.id}/try-on/image?v=${o.tryOn}`} alt={o.occasion ?? "Saved look"} className="aspect-[3/4] w-full object-cover" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {picture && (
          <>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
              rows={2}
              placeholder="Caption (optional)"
              className="mt-5 block w-full resize-none rounded-[14px] bg-white px-3.5 py-3 text-[14px] text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] outline-none focus:shadow-[inset_0_0_0_2px_#121821]"
            />

            <p className={`${eyebrow} mt-5`}>Style</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STYLE_TAGS.map((t) => (
                <button key={t} type="button" onClick={() => toggle(styles, setStyles, t)} aria-pressed={styles.includes(t)} className={chip(styles.includes(t))}>
                  {t}
                </button>
              ))}
            </div>
            <p className={`${eyebrow} mt-4`}>Occasion</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {OCCASION_TAGS.map((t) => (
                <button key={t} type="button" onClick={() => toggle(occasions, setOccasions, t)} aria-pressed={occasions.includes(t)} className={chip(occasions.includes(t))}>
                  {t}
                </button>
              ))}
            </div>

            {/* The pieces: optional; anything unknown can be left empty. */}
            <div className="mt-6 flex items-center justify-between">
              <p className={eyebrow}>Pieces</p>
              <div className="flex gap-3 text-[12.5px]">
                <button type="button" onClick={openCloset} className={btnText} disabled={items.length >= MAX_POST_ITEMS}>
                  From my closet
                </button>
                <button type="button" onClick={() => setItems((l) => [...l, blankItem()])} className={btnText} disabled={items.length >= MAX_POST_ITEMS}>
                  ＋ Add
                </button>
              </div>
            </div>
            {showCloset && (
              <div className="mt-2 rounded-[18px] bg-white p-3 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]">
                {!closet ? (
                  <p className="p-2 text-[13px] text-[#5d6874]">Loading…</p>
                ) : (
                  <ul className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto">
                    {closet.map((c) => {
                      const added = items.some((it) => it.closetItemId === c.id);
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setItems((l) => (added ? l.filter((it) => it.closetItemId !== c.id) : l.length < MAX_POST_ITEMS ? [...l, fromCloset(c)] : l))}
                            aria-pressed={added}
                            aria-label={c.description}
                            className={`block w-full overflow-hidden rounded-[10px] bg-[#f4f3f0] ${added ? "ring-2 ring-[#121821]" : ""}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- the person's own closet */}
                            <img src={c.imageUrl} alt="" className="aspect-square w-full object-contain p-1" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <button type="button" onClick={() => setShowCloset(false)} className={`${btnText} mt-1 text-[12.5px]`}>
                  Done
                </button>
              </div>
            )}
            <ul className="mt-2 flex flex-col gap-3">
              {items.map((it, i) => (
                <li key={i} className="rounded-[14px] bg-white p-3 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]">
                  <div className="flex items-center gap-2">
                    {it.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element -- the person's own closet piece
                      <img src={it.thumb} alt="" className="h-10 w-10 shrink-0 rounded-[8px] bg-[#f4f3f0] object-contain" />
                    )}
                    <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="What is it? e.g. Oversized blazer" className={field} />
                    <button type="button" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} aria-label="Remove piece" className="shrink-0 px-1 text-[16px] text-[#5d6874]">
                      ✕
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input value={it.brand} onChange={(e) => setItem(i, { brand: e.target.value })} placeholder="Brand" className={field} />
                    <input value={it.store} onChange={(e) => setItem(i, { store: e.target.value })} placeholder="Store" className={field} />
                  </div>
                  <input value={it.link} onChange={(e) => setItem(i, { link: e.target.value })} placeholder="Shopping link (optional)" inputMode="url" className={`${field} mt-2`} />
                </li>
              ))}
            </ul>

            {/* Nothing becomes public without this. */}
            <label className="mt-6 flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-[#4f5b66]">
              <input type="checkbox" checked={publicOk} onChange={(e) => setPublicOk(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#121821]" />
              <span>
                Post publicly as <b className="text-[#121821]">@{access.username}</b>. Anyone can see this photo, caption and pieces. Your closet stays private. Follow
                the{" "}
                <Link href="/terms" className="underline underline-offset-2">
                  community rules
                </Link>
                .
              </span>
            </label>
            {error && (
              <p role="alert" className="mt-3 text-[13px] text-[#a1312a]">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={post} disabled={!publicOk || busy} className={`${btnPrimary} flex-1`}>
                {busy ? "Posting…" : "Post"}
              </button>
              <button onClick={() => router.back()} disabled={busy} className={btnSecondary}>
                Cancel
              </button>
            </div>
          </>
        )}
        {error && !picture && (
          <p role="alert" className="mt-3 text-[13px] text-[#a1312a]">
            {error}
          </p>
        )}
      </PageShell>
    </main>
  );
}
