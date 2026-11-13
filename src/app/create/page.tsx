"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClothingItem, Outfit } from "@/components/OutfitCard";
import { CAPTION_MAX, MAX_POST_ITEMS, MAX_TAGS, OCCASION_TAGS, STYLE_TAGS } from "@/lib/postRules";
import { layoutBoard, renderBoard, shrinkPicture, withoutBackground, type BoardLayer } from "@/lib/outfitBoard";
import { BoardEditor } from "@/components/BoardEditor";
import { warmUpCutout } from "@/lib/cutout";
import { ROLE_FOR, type TrayCategory, type TrayItem } from "@/lib/shopCatalog";
import { keepShopTryOn, readShopTryOns } from "@/lib/shopWishlist";
import { PageShell, btnPrimary, btnSecondary, btnText, eyebrow } from "@/components/ui";
import { useToast } from "@/components/Toast";

type Draft = {
  name: string;
  brand: string;
  store: string;
  link: string;
  price: string;
  category: string | null;
  /** Where it goes in a built outfit's picture (layering role). */
  role: string;
  closetItemId: string | null;
  thumb: string | null;
  /** A store piece's own picture, posted with it. */
  shopPicture: string | null;
  /** Where it came from in "Build an outfit" (so it can be picked again or taken out). */
  key: string;
};
type Picture = { blob: Blob; url: string; width: number; height: number };

const blankItem = (): Draft => ({ name: "", brand: "", store: "", link: "", price: "", category: null, role: "accessory", closetItemId: null, thumb: null, shopPicture: null, key: `new-${Math.random()}` });
const shortName = (d: string) => d.split(/[,;(]/)[0].trim().slice(0, 60);
/** A closet piece as the API sends it (with its brand, when known). */
type ClosetPiece = ClothingItem & { brand?: string | null };
const fromCloset = (c: ClosetPiece): Draft => ({
  name: shortName(c.description),
  brand: c.brand ?? "",
  store: "",
  link: "",
  price: "",
  category: c.category,
  role: c.layeringRole,
  closetItemId: c.id,
  thumb: c.imageUrl,
  shopPicture: null,
  key: `closet-${c.id}`,
});
/** A Shopping piece (from another store): its store, price and link come along. */
const fromShop = (t: TrayItem): Draft => ({
  name: t.name.slice(0, 60),
  brand: "",
  store: t.label,
  link: t.productUrl ?? "",
  price: t.price ?? "",
  category: t.category,
  role: t.layeringRole,
  closetItemId: null,
  thumb: t.imageUrl,
  shopPicture: t.imageUrl,
  key: `shop-${t.key}`,
});
/** One outfit: at most this many of each kind (a dress counts as the bottom). */
type Slot = "jacket" | "top" | "bottom" | "shoes" | "accessory";
const slotOf = (role: string): Slot =>
  role === "outer_layer" ? "jacket" : role === "base_layer" || role === "mid_layer" ? "top" : role === "bottom" || role === "one_piece" ? "bottom" : role === "shoes" ? "shoes" : "accessory";
const SLOT_LIMITS: Record<Slot, number> = { jacket: 1, top: 2, bottom: 1, shoes: 1, accessory: 3 };
const SLOT_NAMES: Record<Slot, string> = { jacket: "the jacket", top: "a top", bottom: "the bottom", shoes: "the shoes", accessory: "an accessory" };

const KINDS: { value: TrayCategory; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "dress", label: "Dress" },
  { value: "outerwear", label: "Jacket" },
  { value: "shoes", label: "Shoes" },
  { value: "accessory", label: "Accessory" },
];

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

/**
 * Post an outfit: a photo (new, or a saved look's try-on), or an outfit built from pieces (your closet, Shopping, or
 * any store link, laid out into one picture on this device), then a caption, tags and "Post publicly".
 */
export default function CreatePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [access, setAccess] = useState<{ canPost: boolean; username: string | null } | null>(null);
  const [picture, setPicture] = useState<Picture | null>(null);
  // "Build an outfit": choosing pieces (before the picture is made from them).
  const [building, setBuilding] = useState(false);
  const [source, setSource] = useState<"closet" | "shop">("closet");
  const [shopPieces, setShopPieces] = useState<TrayItem[]>([]);
  const [link, setLink] = useState("");
  const storePhoto = useRef<HTMLInputElement | null>(null);
  const [linkKind, setLinkKind] = useState<TrayCategory>("top");
  const [linkBusy, setLinkBusy] = useState(false);
  const [boardBusy, setBoardBusy] = useState(false);
  // The picture was made from the chosen pieces ("Change" goes back to them).
  const [built, setBuilt] = useState(false);
  // Arranging the built outfit (move, resize, layer) before its picture is drawn.
  const [layers, setLayers] = useState<BoardLayer[] | null>(null);
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
      setBuilt(false);
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

  function startBuilding() {
    // The background remover starts loading now, so making the outfit is quicker.
    warmUpCutout();
    setError(null);
    setBuilding(true);
    setShopPieces(readShopTryOns());
    void openCloset();
    setShowCloset(false);
  }

  /**
   * Picks or unpicks a piece, keeping it one outfit: a second jacket, bottom/dress or pair of shoes swaps out the one
   * already there (a third top or fourth accessory swaps out the oldest), with a short note.
   */
  function pick(draft: Draft) {
    if (items.some((it) => it.key === draft.key)) return setItems((list) => list.filter((it) => it.key !== draft.key));
    const slot = slotOf(draft.role);
    const same = items.filter((it) => slotOf(it.role) === slot);
    const out = same.length >= SLOT_LIMITS[slot] ? same[0] : null;
    if (!out && items.length >= MAX_POST_ITEMS) return showToast(`Up to ${MAX_POST_ITEMS} pieces`);
    setItems((list) => [...list.filter((it) => it.key !== out?.key), draft]);
    if (out) showToast(`Swapped ${SLOT_NAMES[slot]}`);
  }

  /** A piece from any store: its page is read for the picture, name, store and price (no AI), and kept in Shopping too. */
  async function addLink() {
    setError(null);
    setLinkBusy(true);
    const res = await fetch("/api/shop/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: link.trim() }) }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { product?: { productUrl: string | null; retailer: string; name: string | null; price: string | null; currency: string | null; imageDataUrl: string }; error?: string }) : {};
    setLinkBusy(false);
    // Many stores block reading their pages: a photo or screenshot of the piece works instead.
    if (!res?.ok || !data.product) return setError("That store didn't let us read the link. Add a photo or screenshot of the piece instead.");
    const p = data.product;
    const item: TrayItem = {
      key: `ext-${Date.now()}`,
      name: p.name ?? "Piece",
      label: p.retailer,
      category: linkKind,
      layeringRole: ROLE_FOR[linkKind],
      color: "",
      // The background is removed on this device (free), like closet pieces.
      imageUrl: await withoutBackground(p.imageDataUrl),
      price: p.price ? `${p.currency === "USD" || !p.currency ? "$" : ""}${p.price}${p.currency && p.currency !== "USD" ? ` ${p.currency}` : ""}` : null,
      productUrl: p.productUrl,
    };
    setShopPieces(keepShopTryOn(item));
    pick(fromShop(item));
    setLink("");
  }

  /** A store piece from a photo or screenshot (shrunk on this device; kept in Shopping too). Name it in the list below. */
  async function addStorePhoto(file: File) {
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const item: TrayItem = {
        key: `ext-${Date.now()}`,
        name: KINDS.find((k) => k.value === linkKind)?.label ?? "Piece",
        label: "",
        category: linkKind,
        layeringRole: ROLE_FOR[linkKind],
        color: "",
        imageUrl: await withoutBackground(canvas.toDataURL("image/png")),
        price: null,
        productUrl: null,
      };
      setShopPieces(keepShopTryOn(item));
      pick(fromShop(item));
    } catch {
      setError("Couldn't read that photo.");
    }
  }

  /** Lays the chosen pieces out into the post's picture (on this device). */
  /** Arranges the chosen pieces automatically (backgrounds removed); then they can be moved, resized and layered. */
  async function makeBoard() {
    setError(null);
    setBoardBusy(true);
    try {
      setLayers(await layoutBoard(items.filter((it) => it.thumb).map((it) => ({ imageUrl: it.thumb!, role: it.role, name: it.name, key: it.key }))));
      setBuilding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make the picture.");
    }
    setBoardBusy(false);
  }

  /** Done arranging: draws the post's picture from the arrangement (on this device). */
  async function finishBoard() {
    if (!layers) return;
    setBoardBusy(true);
    try {
      const board = await renderBoard(layers);
      setPicture({ ...board, url: URL.createObjectURL(board.blob) });
      setBuilt(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make the picture.");
    }
    setBoardBusy(false);
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
    const kept = items.filter((it) => it.name.trim());
    // Store pieces' own pictures, by their position in the posted list.
    await Promise.all(
      kept.map(async (it, i) => {
        if (it.closetItemId || !it.shopPicture) return;
        const blob = await shrinkPicture(it.shopPicture);
        if (blob) form.append(`itemPicture-${i}`, blob, `piece-${i}.webp`);
      })
    );
    form.append(
      "data",
      JSON.stringify({
        caption,
        styleTags: styles,
        occasionTags: occasions,
        width: picture.width,
        height: picture.height,
        items: kept.map(({ name, brand, store, link, price, category, closetItemId }) => ({ name, brand, store, link, price, category, closetItemId })),
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
              <button
                onClick={() => {
                  setPicture(null);
                  if (!built) setLayers(null);
                }}
                className="absolute right-3 top-3 rounded-full bg-white/95 px-3.5 py-1.5 text-[12px] font-semibold text-[#121821] shadow">
                Change
              </button>
            </div>
          ) : (
            !building && !layers && (
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => fileInput.current?.click()} className="flex aspect-[3/4] flex-col items-center justify-center rounded-[18px] bg-white text-[14px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)]">
                <span className="text-[28px] font-light">＋</span>
                Photo
              </button>
              <button onClick={openSaved} className="flex aspect-[3/4] flex-col items-center justify-center rounded-[18px] bg-white text-[14px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)]">
                <span className="text-[24px]">🔖</span>
                A saved look
              </button>
              <button onClick={startBuilding} className="flex aspect-[3/4] flex-col items-center justify-center rounded-[18px] bg-white px-2 text-center text-[14px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)]">
                <span className="text-[24px]">👗</span>
                Build an outfit
              </button>
            </div>
            )
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

        {layers && !picture && !building && (
          <section className="mt-6">
            <BoardEditor layers={layers} onChange={setLayers} />
            <div className="mt-3 flex gap-2">
              <button onClick={finishBoard} disabled={boardBusy} className={`${btnPrimary} flex-1`}>
                {boardBusy ? "Saving…" : "Done"}
              </button>
              <button onClick={makeBoard} disabled={boardBusy} className={btnSecondary}>
                Reset
              </button>
              <button
                onClick={() => {
                  setLayers(null);
                  setBuilding(true);
                }}
                disabled={boardBusy}
                className={btnSecondary}
              >
                Pieces
              </button>
            </div>
          </section>
        )}

        {building && !picture && (
          <section className="mt-6">
            <div role="tablist" aria-label="Where pieces come from" className="inline-flex rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.1)]">
              {(
                [
                  ["closet", "My closet"],
                  ["shop", "Shopping"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={source === value}
                  onClick={() => setSource(value)}
                  className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold ${source === value ? "bg-[#121821] text-white" : "text-[#4f5b66]"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-[18px] bg-white p-3 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]">
              {source === "shop" && (
                <div className="mb-3 flex flex-col gap-2 border-b border-black/[0.06] p-1 pb-3">
                  <div className="flex gap-2">
                    <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a store link" inputMode="url" className={field} />
                    <button onClick={addLink} disabled={!link.trim() || linkBusy || items.length >= MAX_POST_ITEMS} className={`${btnSecondary} !min-h-[40px] shrink-0 !px-4`}>
                      {linkBusy ? "…" : "Add"}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {KINDS.map((k) => (
                      <button key={k.value} type="button" onClick={() => setLinkKind(k.value)} aria-pressed={linkKind === k.value} className={chip(linkKind === k.value)}>
                        {k.label}
                      </button>
                    ))}
                    <button type="button" onClick={() => storePhoto.current?.click()} className={`${btnText} ml-auto text-[12.5px]`}>
                      or a photo
                    </button>
                  </div>
                  <input
                    ref={storePhoto}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void addStorePhoto(file);
                    }}
                  />
                </div>
              )}
              {(
                (() => {
                  const list: Draft[] = source === "closet" ? (closet ?? []).map(fromCloset) : shopPieces.map(fromShop);
                  if (source === "closet" && !closet) return <p className="p-2 text-[13px] text-[#5d6874]">Loading…</p>;
                  if (list.length === 0)
                    return (
                      <p className="p-2 text-[13px] text-[#5d6874]">
                        {source === "shop" ? "Paste a store link or add a photo of a piece." : "Your closet is empty."}
                      </p>
                    );
                  return (
                    <ul className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto">
                      {list.map((d) => {
                        const on = items.some((it) => it.key === d.key);
                        return (
                          <li key={d.key}>
                            <button type="button" onClick={() => pick(d)} aria-pressed={on} aria-label={d.name} className={`block w-full overflow-hidden rounded-[10px] bg-[#f4f3f0] ${on ? "ring-2 ring-[#121821]" : ""}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element -- the person's own pieces */}
                              <img src={d.thumb ?? ""} alt="" className="aspect-square w-full object-contain p-1" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()
              )}
            </div>

            {items.length > 0 && (
              <div className="mt-3 flex items-center gap-2 overflow-x-auto">
                {items.map((it) => (
                  <button key={it.key} type="button" onClick={() => pick(it)} aria-label={`Remove ${it.name}`} className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- the chosen pieces */}
                    <img src={it.thumb ?? ""} alt="" className="h-14 w-14 rounded-[10px] bg-white object-contain p-0.5" />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#121821] text-[10px] text-white">✕</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={makeBoard} disabled={!items.some((it) => it.thumb) || boardBusy} className={`${btnPrimary} flex-1`}>
                {boardBusy ? "Laying it out…" : `Make the outfit (${items.length})`}
              </button>
              <button
                onClick={() => {
                  setBuilding(false);
                  setItems([]);
                }}
                className={btnSecondary}
              >
                Back
              </button>
            </div>
          </section>
        )}

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
                  <div className="mt-2 grid grid-cols-[1fr_88px] gap-2">
                    <input value={it.link} onChange={(e) => setItem(i, { link: e.target.value })} placeholder="Shopping link (optional)" inputMode="url" className={field} />
                    <input value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} placeholder="Price" className={field} />
                  </div>
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
