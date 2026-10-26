"use client";

import { useEffect, useRef, useState } from "react";
import { photoToJpeg } from "@/lib/clientImage";
import { ROLE_FOR, type TrayCategory, type TrayItem } from "@/lib/shopCatalog";

/**
 * "Try on from any store": paste a product link (Virm reads the page's published picture and details on its
 * server), upload or paste a photo/screenshot of the item, or drop a picture in (a file, or an image dragged from
 * another tab, which is read by its link). Then check the picture (crop a screenshot down to the piece), say what
 * kind of piece it is, and try it on live or add it to the tray. Only details the page states are shown; nothing is
 * invented. Pictures stay in this browser.
 */

const KINDS: { value: TrayCategory; label: string }[] = [
  { value: "outfit", label: "Whole outfit" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "dress", label: "Dress" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "accessory", label: "Accessory" },
];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SIDE = 1024;
// Below this (shortest side, in pixels) the try-on tends to look soft.
const SMALL_SIDE = 300;
const LINK_FAILED = "Couldn't read that page. Upload a photo of the item instead.";
const DROP_FAILED = "That picture couldn't be read from the other tab. Save it or take a screenshot, then upload it.";

/* ---------- Brand guesses (free, no AI): from the link's website or the picture's file name ---------- */

// How brands write their own names, where that isn't just a capital first letter.
const BRAND_NAMES: Record<string, string> = {
  hm: "H&M", "h&m": "H&M", jcrew: "J.Crew", "j crew": "J.Crew", levi: "Levi's", levis: "Levi's", "levi's": "Levi's",
  cos: "COS", asos: "ASOS", shein: "SHEIN", skims: "SKIMS", alo: "Alo", "alo yoga": "Alo Yoga", "and other stories": "& Other Stories",
  stories: "& Other Stories", thenorthface: "The North Face", "north face": "The North Face", "the north face": "The North Face",
  "new balance": "New Balance", newbalance: "New Balance", "under armour": "Under Armour", underarmour: "Under Armour",
  "ralph lauren": "Ralph Lauren", ralphlauren: "Ralph Lauren", "tommy hilfiger": "Tommy Hilfiger", "calvin klein": "Calvin Klein",
  "michael kors": "Michael Kors", "banana republic": "Banana Republic", bananarepublic: "Banana Republic", "old navy": "Old Navy",
  oldnavy: "Old Navy", "american eagle": "American Eagle", ae: "American Eagle", "urban outfitters": "Urban Outfitters",
  urbanoutfitters: "Urban Outfitters", "free people": "Free People", freepeople: "Free People", abercrombie: "Abercrombie & Fitch",
};
// Brands recognised in a picture's file name (e.g. "lululemon-align-pant.jpg").
const KNOWN_BRANDS = [
  "lululemon", "nike", "adidas", "zara", "h&m", "hm", "uniqlo", "gap", "patagonia", "allbirds", "everlane", "madewell", "aritzia",
  "levi's", "levis", "levi", "j crew", "jcrew", "banana republic", "old navy", "abercrombie", "hollister", "american eagle",
  "urban outfitters", "free people", "anthropologie", "mango", "cos", "arket", "and other stories", "reformation", "skims",
  "alo yoga", "alo", "vuori", "gymshark", "the north face", "north face", "columbia", "new balance", "converse", "vans", "puma",
  "reebok", "under armour", "ralph lauren", "tommy hilfiger", "calvin klein", "gucci", "prada", "coach", "michael kors", "shein",
  "asos", "nordstrom", "target", "quince", "athleta", "fabletics", "on running", "hoka", "birkenstock", "dr martens", "ugg",
];
// Picture hosts that belong to no particular brand.
const SHARED_HOSTS = /(shopify|cloudfront|akamai|scene7|imgix|cloudinary|amazonaws|googleusercontent|fbcdn|cdninstagram|pinimg|wp)\./i;

const brandName = (word: string) => BRAND_NAMES[word.toLowerCase()] ?? word.replace(/\b\w/g, (c) => c.toUpperCase());

/** "images.lululemon.com" → "Lululemon"; null for shared picture hosts. */
function brandFromHost(host: string): string | null {
  if (SHARED_HOSTS.test(host)) return null;
  const parts = host.toLowerCase().replace(/^(www\d*|shop|store|images?|static|cdn|media|assets|img)\./, "").split(".");
  const word = parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts[parts.length - 3] : parts[0];
  return word ? brandName(word) : null;
}

/** A known brand named in a picture's file name, if any. */
function brandFromFileName(name: string): string | null {
  const words = ` ${name.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[-_.+]+/g, " ")} `;
  const hit = KNOWN_BRANDS.find((b) => words.includes(` ${b} `));
  return hit ? brandName(hit) : null;
}

/** "Nike.com" → "Nike". */
const tidyStore = (name: string) => name.replace(/\.(com|co|net|org|shop|store)(\.[a-z]{2})?$/i, "").trim();

type Found = { name: string; retailer: string; price: string | null; productUrl: string | null; imageUrl: string };
type Box = { x: number; y: number; w: number; h: number };

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

/** The page link that came with a dropped picture (a store's product picture is usually inside a link to its page). */
function droppedPage(data: DataTransfer, picture: string): string | null {
  const uri = data
    .getData("text/uri-list")
    .split(/\r?\n/)
    .find((line) => line && !line.startsWith("#"))
    ?.trim();
  return uri && uri !== picture && /^https?:/i.test(uri) ? uri : null;
}

/** The picture's link from something dropped in from another tab (an <img>, or a link to one), if there is one. */
function droppedLink(data: DataTransfer): string | null {
  const src = data.getData("text/html").match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, "&");
  const uri = data
    .getData("text/uri-list")
    .split(/\r?\n/)
    .find((line) => line && !line.startsWith("#"));
  const text = data.getData("text/plain").trim();
  return src ?? uri?.trim() ?? (/^(https?:|data:image\/)/i.test(text) ? text : null);
}

/** Lets the person drag a box around the piece they want (for screenshots with several products). */
function Cropper({ src, onApply, onCancel }: { src: string; onApply: (dataUrl: string) => void; onCancel: () => void }) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  const at = (e: React.PointerEvent) => {
    const r = imgRef.current!.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };

  const usable = Boolean(box && box.w * natural.w >= 40 && box.h * natural.h >= 40);

  function apply() {
    const img = imgRef.current;
    if (!box || !img) return;
    const sw = box.w * img.naturalWidth;
    const sh = box.h * img.naturalHeight;
    const scale = Math.min(1, SIDE / Math.max(sw, sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    canvas.getContext("2d")!.drawImage(img, box.x * img.naturalWidth, box.y * img.naturalHeight, sw, sh, 0, 0, canvas.width, canvas.height);
    onApply(canvas.toDataURL("image/jpeg", 0.9));
  }

  return (
    <div className="mt-4">
      <p className="text-[12.5px] text-[#445159]">Drag a box around just the piece you want, then tap Use this part.</p>
      <div className="mt-3 flex justify-center bg-[#f0eee9] p-2">
        <div
          className="relative inline-block cursor-crosshair touch-none select-none overflow-hidden"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            startRef.current = at(e);
            setBox({ ...startRef.current, w: 0, h: 0 });
          }}
          onPointerMove={(e) => {
            const s = startRef.current;
            if (!s) return;
            const p = at(e);
            setBox({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
          }}
          onPointerUp={() => (startRef.current = null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a picture held in this browser */}
          <img
            ref={imgRef}
            src={src}
            alt="The picture to crop"
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} className="block max-h-[420px] max-w-full" />
          {box && (
            <div
              className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
            />
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={apply}
          disabled={!usable}
          className="inline-flex min-h-[44px] items-center justify-center rounded-[2px] bg-[#121821] px-5 text-[12.5px] font-medium text-white hover:bg-[#2a3542] disabled:bg-[#c9cdd0]"
        >
          Use this part
        </button>
        <button onClick={onCancel} className="inline-flex min-h-[44px] items-center px-3 text-[12.5px] font-medium text-[#5d6874] underline-offset-4 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
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
  const [kind, setKind] = useState<TrayCategory>("top");
  const [saved, setSaved] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [small, setSmall] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function begin() {
    setError(null);
    setSaved(false);
    setSmall(false);
    setCropping(false);
  }

  /** Reads a product page or a picture link on Virm's server. */
  async function importLink(url: string, failed: string, page: string | null = null) {
    setBusy(true);
    begin();
    try {
      const res = await fetch("/api/shop/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        product?: { productUrl: string | null; retailer: string; name: string | null; price: string | null; currency: string | null; imageDataUrl: string };
      };
      if (!res.ok || !data.product) throw new Error(data.error ?? failed);
      const p = data.product;
      // A store page names itself; for a picture link, go by its website (or the page it was dragged from).
      const pictureHost = new URL(page ?? url).hostname;
      const image = await (await fetch(p.imageDataUrl)).blob();
      setFound({
        name: p.name ?? "",
        retailer: p.productUrl ? tidyStore(p.retailer) : (brandFromHost(pictureHost) ?? ""),
        price: priceText(p.price, p.currency),
        productUrl: p.productUrl ?? page,
        imageUrl: await shrink(image, SIDE),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : failed);
    } finally {
      setBusy(false);
    }
  }

  function getFromLink(e: React.FormEvent) {
    e.preventDefault();
    if (!link.trim() || busy) return;
    importLink(link.trim(), LINK_FAILED);
  }

  async function upload(file: Blob, fileName = "") {
    begin();
    if (!file.type.startsWith("image/")) return setError("Choose a picture (JPG, PNG or WebP).");
    if (file.size > MAX_UPLOAD_BYTES) return setError("That picture is too large. Please use one under 10MB.");
    setBusy(true);
    try {
      // The picture stays in this browser: it's only sent to the try-on when a session starts.
      const imageUrl = await shrink(file, SIDE);
      let productUrl: string | null = found?.productUrl ?? null;
      try {
        const u = new URL(link.trim());
        if (u.protocol === "https:" || u.protocol === "http:") productUrl = u.toString();
      } catch {}
      setFound({
        name: found?.name ?? "",
        retailer: (productUrl && brandFromHost(new URL(productUrl).hostname)) || brandFromFileName(fileName) || found?.retailer || "",
        price: found?.price ?? null,
        productUrl,
        imageUrl,
      });
    } catch {
      setError("Couldn't read that picture. Try a JPG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  async function drop(data: DataTransfer) {
    const file = Array.from(data.files).find((f) => f.type.startsWith("image/")) ?? data.files[0];
    if (file) return upload(file, file.name);
    const dropped = droppedLink(data);
    if (!dropped) return setError(DROP_FAILED);
    if (dropped.startsWith("data:image/")) {
      const blob = await fetch(dropped)
        .then((r) => r.blob())
        .catch(() => null);
      return blob ? upload(blob) : setError(DROP_FAILED);
    }
    if (!/^https?:/i.test(dropped)) return setError(DROP_FAILED);
    importLink(dropped, DROP_FAILED, droppedPage(data, dropped));
  }

  // Paste a copied picture or screenshot (⌘V / Ctrl+V) while choosing an item.
  useEffect(() => {
    if (found || busy) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (!file) return;
      e.preventDefault();
      upload(file, file.name);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- upload reads the current link when it runs
  }, [found, busy]);

  const item = (): TrayItem => ({
    key: `ext-${crypto.randomUUID()}`,
    name: found?.name.trim() || "Store find",
    label: found?.retailer.trim() ?? "",
    category: kind,
    layeringRole: ROLE_FOR[kind],
    color: "",
    imageUrl: found!.imageUrl,
    price: found?.price ?? null,
    productUrl: found?.productUrl ?? null,
  });

  function reset() {
    begin();
    setFound(null);
    setLink("");
  }

  const field =
    "min-h-[44px] w-full rounded-[2px] border border-black/15 bg-white px-3 text-[13px] text-[#121821] outline-none focus:border-[#121821]";
  const ghost = "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-black/15 bg-white px-4 text-[12.5px] font-medium text-[#121821] hover:border-[#121821] disabled:opacity-40";
  const label = "text-[10px] font-semibold uppercase tracking-[1.6px] text-[#5d6874]";
  const small_link = "text-[12px] font-medium text-[#121821] underline-offset-4 hover:underline";

  return (
    <section
      aria-label="Import an item"
      className="rounded-[6px] bg-white p-5 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] sm:p-6"
      onDragOver={(e) => {
        if (found) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
      }}
      onDrop={(e) => {
        if (found) return;
        e.preventDefault();
        setDragOver(false);
        drop(e.dataTransfer);
      }}
    >
      <h2 className="font-display text-[26px] leading-tight text-[#121821]">Import an item</h2>
      <p className="mt-1 text-[13px] text-[#445159]">Found something you love? See how it looks on you before you buy.</p>
      <ol className="mt-4 grid gap-2 text-[12px] leading-snug text-[#445159] sm:grid-cols-3">
        {[
          ["Add a piece", "Paste its link, or upload, paste or drop a picture."],
          ["Check it", "Crop to just the piece and choose what it is."],
          ["Try it on", "Right away, or add more pieces to try a whole outfit together."],
        ].map(([title, text], i) => (
          <li key={title} className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#121821] text-[10.5px] font-semibold text-white">{i + 1}</span>
            <span>
              <b className="font-semibold text-[#121821]">{title}.</b> {text}
            </span>
          </li>
        ))}
      </ol>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload(file, file.name);
        }}
      />

      {cropping && found ? (
        <Cropper
          src={found.imageUrl}
          onApply={(imageUrl) => {
            setFound({ ...found, imageUrl });
            setCropping(false);
          }}
          onCancel={() => setCropping(false)}
        />
      ) : !found ? (
        <>
          <p className={`${label} mt-5`}>Paste product link</p>
          <form onSubmit={getFromLink} className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              type="url"
              inputMode="url"
              placeholder="https://…"
              aria-label="Product link"
              className={field}
            />
            <button type="submit" disabled={busy || !link.trim()} className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-[2px] bg-[#121821] px-5 text-[12.5px] font-medium text-white hover:bg-[#2a3542] disabled:bg-[#c9cdd0]">
              {busy ? "Getting it…" : "Get item"}
            </button>
          </form>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-[4px] border border-black/15 bg-[#faf9f6] px-4 text-center hover:border-[#121821] disabled:opacity-50"
            >
              <span className="text-[13px] font-semibold text-[#121821]">Upload image or screenshot</span>
              <span className="text-[11.5px] text-[#5d6874]">JPG, PNG or WebP · up to 10MB</span>
            </button>
            <div
              className={`hidden min-h-[88px] flex-col items-center justify-center gap-1 rounded-[4px] border border-dashed px-4 text-center transition md:flex ${
                dragOver ? "border-[#121821] bg-[#eef1f2]" : "border-black/25 bg-[#faf9f6]"
              }`}
            >
              <span className="text-[13px] font-semibold text-[#121821]">Drag and drop image</span>
              <span className="text-[11.5px] text-[#5d6874]">A picture file, or one from another tab</span>
            </div>
          </div>

          <p className="mt-3 text-[12px] text-[#5d6874]" aria-live="polite">
            {busy ? "Getting it…" : "If a store won't share its page, a screenshot works just as well. You can also paste a copied picture."}
          </p>
          {error && <p className="mt-3 rounded-[4px] bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}
        </>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-[160px_minmax(0,1fr)]">
          <div>
            <div className="relative aspect-[3/4] overflow-hidden bg-[#f0eee9]">
              {/* eslint-disable-next-line @next/next/no-img-element -- a picture held in this browser */}
              <img
                src={found.imageUrl}
                alt="The item to try on"
                onLoad={(e) => setSmall(Math.min(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight) < SMALL_SIDE)}
                className="absolute inset-0 h-full w-full object-contain p-2"
              />
            </div>
            <div className="mt-2 flex justify-between gap-2">
              <button onClick={() => setCropping(true)} className={small_link}>
                Crop
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={busy} className={small_link}>
                Replace
              </button>
              <button onClick={reset} className={small_link}>
                Remove
              </button>
            </div>
          </div>
          <div className="min-w-0">
            <input
              value={found.retailer}
              onChange={(e) => setFound({ ...found, retailer: e.target.value })}
              placeholder="Brand (tap to add)"
              aria-label="Brand or store"
              title="Wrong brand? Type the right one."
              className="w-full border-b border-dashed border-black/15 bg-transparent py-0.5 text-[10px] uppercase tracking-[1.6px] text-[#5d6874] outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-[#8a949c] focus:border-[#121821] focus:text-[#121821]"
            />
            <input
              value={found.name}
              onChange={(e) => setFound({ ...found, name: e.target.value })}
              placeholder="Name (optional)"
              aria-label="Item name"
              className="mt-1 w-full border-b border-black/15 bg-transparent py-1 text-[15px] font-medium text-[#121821] outline-none focus:border-[#121821]"
            />
            {found.price && <p className="mt-1 text-[13px] text-[#121821]">{found.price}</p>}
            <p className="mt-3 text-[12.5px] text-[#445159]">Is this the piece you want to try on?</p>
            <p className="mt-1 text-[11.5px] leading-snug text-[#5d6874]">
              Only want part of the picture, like the pants from a full outfit? Tap <b className="font-semibold text-[#121821]">Crop</b> and box just that piece. Best results: plain background, whole piece in view.
            </p>
            {small && <p className="mt-1 text-[11.5px] text-[#9a5b12]">This picture is small, so the try-on may look blurry.</p>}
            <label className="mt-3 block text-[11px] font-semibold text-[#4f5b66]">
              What is it?
              <select value={kind} onChange={(e) => setKind(e.target.value as TrayCategory)} className={`${field} mt-1`}>
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block font-normal text-[#5d6874]">This tells the try-on what to swap on you.</span>
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
                Add to outfit
              </button>
              <button onClick={() => setSaved(onSave(item()))} disabled={saved} className={ghost}>
                {saved ? "♥ Saved" : "♡ Save"}
              </button>
            </div>
            <p className="mt-2 text-[11.5px] leading-snug text-[#5d6874]">
              <b className="font-semibold text-[#121821]">Add to outfit</b> keeps this piece so you can add more, then try them all on together.
            </p>
            {found.productUrl && (
              <a href={found.productUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[12px] font-medium text-[#121821] underline underline-offset-4">
                View in store ↗
              </a>
            )}
            {error && <p className="mt-3 rounded-[4px] bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
