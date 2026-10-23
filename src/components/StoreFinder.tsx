"use client";

import { useRef, useState } from "react";
import { photoToJpeg } from "@/lib/clientImage";
import { ROLE_FOR, type ShopProduct, type TrayItem } from "@/lib/shopCatalog";

/**
 * "Try on from any store": paste a product link (Virm reads the page's published picture and details on its
 * server) or upload a photo/screenshot of the item. Then confirm the picture, say what kind of piece it is, and
 * try it on live or add it to the tray. Only details the page states are shown; nothing is invented.
 */

const KINDS: { value: ShopProduct["category"]; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "dress", label: "Dress" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "accessory", label: "Accessory" },
];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type Found = { name: string; retailer: string; price: string | null; productUrl: string | null; imageUrl: string };

/** A shrunk JPEG data URL (keeps the tray and wishlist small). */
async function shrink(source: Blob, side: number): Promise<string> {
  const jpeg = await photoToJpeg(source, 0.88, side);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(jpeg);
  });
}

function priceText(price: string | null, currency: string | null): string | null {
  if (!price) return null;
  const n = Number(price);
  if (!Number.isFinite(n)) return currency ? `${price} ${currency}` : price;
  try {
    return currency ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n) : price;
  } catch {
    return `${price} ${currency ?? ""}`.trim();
  }
}

export function StoreFinder({
  onTryNow,
  onAdd,
  onSave,
  trayFull,
}: {
  onTryNow: (item: TrayItem) => void;
  onAdd: (item: TrayItem) => void;
  onSave: (item: TrayItem) => boolean;
  trayFull: boolean;
}) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [kind, setKind] = useState<ShopProduct["category"]>("top");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function getFromLink(e: React.FormEvent) {
    e.preventDefault();
    if (!link.trim() || busy) return;
    setBusy(true);
    setError(null);
    setFound(null);
    setSaved(false);
    try {
      const res = await fetch("/api/shop/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        product?: { productUrl: string; retailer: string; name: string | null; price: string | null; currency: string | null; imageDataUrl: string };
      };
      if (!res.ok || !data.product) throw new Error(data.error ?? "Couldn't read that page. Upload a photo of the item instead.");
      const p = data.product;
      const image = await (await fetch(p.imageDataUrl)).blob();
      setFound({
        name: p.name ?? "",
        retailer: p.retailer,
        price: priceText(p.price, p.currency),
        productUrl: p.productUrl,
        imageUrl: await shrink(image, 1024),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that page. Upload a photo of the item instead.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setError(null);
    setFound(null);
    setSaved(false);
    if (!file.type.startsWith("image/")) return setError("Choose a picture (JPG, PNG or WebP).");
    if (file.size > MAX_UPLOAD_BYTES) return setError("That picture is too large. Please use one under 10MB.");
    setBusy(true);
    try {
      // The picture stays in this browser: it's only sent to the try-on when a session starts.
      const imageUrl = await shrink(file, 1024);
      let productUrl: string | null = null;
      try {
        const u = new URL(link.trim());
        if (u.protocol === "https:" || u.protocol === "http:") productUrl = u.toString();
      } catch {}
      setFound({ name: "", retailer: productUrl ? new URL(productUrl).hostname.replace(/^www\./, "") : "Your photo", price: null, productUrl, imageUrl });
    } catch {
      setError("Couldn't read that picture. Try a JPG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  const item = (): TrayItem => ({
    key: `ext-${crypto.randomUUID()}`,
    name: found?.name.trim() || "Store find",
    label: found?.retailer ?? "Store",
    category: kind,
    layeringRole: ROLE_FOR[kind],
    color: "",
    imageUrl: found!.imageUrl,
    price: found?.price ?? null,
    productUrl: found?.productUrl ?? null,
  });

  function reset() {
    setFound(null);
    setLink("");
    setSaved(false);
  }

  const field =
    "min-h-[44px] w-full rounded-[2px] border border-black/15 bg-white px-3 text-[13px] text-[#121821] outline-none focus:border-[#121821]";
  const ghost = "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-black/15 bg-white px-4 text-[12.5px] font-medium text-[#121821] hover:border-[#121821] disabled:opacity-40";

  return (
    <section aria-label="Try on from any store" className="rounded-[6px] bg-white p-5 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] sm:p-6">
      <h2 className="font-display text-[26px] leading-tight text-[#121821]">Try on from any store</h2>
      <p className="mt-1 text-[13px] text-[#445159]">Found something you love? See how it looks on you before you buy.</p>

      {!found ? (
        <>
          <form onSubmit={getFromLink} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              type="url"
              inputMode="url"
              placeholder="Paste a product link"
              aria-label="Product link"
              className={field}
            />
            <button type="submit" disabled={busy || !link.trim()} className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-[2px] bg-[#121821] px-5 text-[12.5px] font-medium text-white hover:bg-[#2a3542] disabled:bg-[#c9cdd0]">
              {busy ? "Getting it…" : "Get item"}
            </button>
          </form>
          <p className="mt-3 text-[12px] text-[#5d6874]">
            Some stores don&apos;t allow this.{" "}
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="font-semibold text-[#121821] underline underline-offset-4">
              Upload a photo of the item
            </button>{" "}
            instead (a screenshot works).
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
          {error && <p className="mt-3 rounded-[4px] bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}
        </>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-[160px_minmax(0,1fr)]">
          <div className="relative aspect-[3/4] overflow-hidden bg-[#f0eee9]">
            {/* eslint-disable-next-line @next/next/no-img-element -- a picture held in this browser */}
            <img src={found.imageUrl} alt="The item to try on" className="absolute inset-0 h-full w-full object-contain p-2" />
          </div>
          <div className="min-w-0">
            <p className="text-[9.5px] uppercase tracking-[1.6px] text-[#5d6874]">{found.retailer}</p>
            <input
              value={found.name}
              onChange={(e) => setFound({ ...found, name: e.target.value })}
              placeholder="Name (optional)"
              aria-label="Item name"
              className="mt-1 w-full border-b border-black/15 bg-transparent py-1 text-[15px] font-medium text-[#121821] outline-none focus:border-[#121821]"
            />
            {found.price && <p className="mt-1 text-[13px] text-[#121821]">{found.price}</p>}
            <p className="mt-3 text-[12.5px] text-[#445159]">Is this the piece you want to try on?</p>
            <label className="mt-3 block text-[11px] font-semibold text-[#4f5b66]">
              What is it?
              <select value={kind} onChange={(e) => setKind(e.target.value as ShopProduct["category"])} className={`${field} mt-1`}>
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => onTryNow(item())}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] bg-[#121821] px-5 text-[12.5px] font-medium text-white hover:bg-[#2a3542]"
              >
                Try on with Live Try-On
              </button>
              <button
                onClick={() => {
                  onAdd(item());
                  reset();
                }}
                disabled={trayFull}
                className={ghost}
              >
                Add to tray
              </button>
              <button onClick={() => setSaved(onSave(item()))} disabled={saved} className={ghost}>
                {saved ? "♥ Saved" : "♡ Save"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 text-[12px]">
              {found.productUrl && (
                <a href={found.productUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[#121821] underline underline-offset-4">
                  View in store ↗
                </a>
              )}
              <button onClick={reset} className="text-[#5d6874] underline-offset-4 hover:underline">
                Not it? Start over
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
