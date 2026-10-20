"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, FORMALITIES, SEASONS, LAYERING_ROLES, type ClothingAttributes } from "@/lib/clothingTaxonomy";
import { LAYER_LABELS } from "@/lib/layering";
import { Tips, type Tip } from "@/components/Tips";

const ADD_TIPS: Tip[] = [
  { target: '[data-tip="add-photo"]', text: "Each number marks a piece Virm found." },
  { target: '[data-tip="add-item"]', text: "Check its name and details. Fix anything that's wrong." },
  { target: '[data-tip="add-remove"]', text: "Not yours, or not needed? Remove it." },
  { target: '[data-tip="add-confirm"]', text: "All good? Add them to your closet." },
];

type BoundingBox = { x: number; y: number; width: number; height: number };

type ReviewItem = ClothingAttributes & {
  localId: string;
  boundingBox: BoundingBox;
  previewUrl: string;
};

type Step = "upload" | "analyzing" | "review" | "confirming";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Crops a region of a same-origin, already-loaded <img> into a real PNG blob (or a smaller JPEG, for checking). */
function cropToBlob(img: HTMLImageElement, box: BoundingBox, maxSide?: number): Promise<Blob> {
  const nw = img.naturalWidth || 1;
  const nh = img.naturalHeight || 1;
  const sx = clamp(box.x, 0, 1) * nw;
  const sy = clamp(box.y, 0, 1) * nh;
  const rawW = clamp(box.width, 0.02, 1) * nw;
  const rawH = clamp(box.height, 0.02, 1) * nh;
  const sw = Math.max(1, Math.min(rawW, nw - sx));
  const sh = Math.max(1, Math.min(rawH, nh - sy));

  const scale = maxSide ? Math.min(1, maxSide / Math.max(sw, sh)) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas not supported"));
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))), maxSide ? "image/jpeg" : "image/png", 0.9);
  });
}

/** The size the AI looks at photos (larger ones are shrunk to this anyway). */
const AI_MAX_SIDE = 1568;

/**
 * Turns the chosen photo upright (phone photos are often stored sideways with a "rotate me" note) and shrinks it to
 * the size the AI sees, so the AI and the cut-outs work from exactly the same picture. Falls back to the original.
 */
async function preparePhoto(file: File): Promise<{ blob: Blob; width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, AI_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    return blob ? { blob, width: canvas.width, height: canvas.height } : null;
  } catch {
    return null;
  }
}

/** A roomy area around a detected box, so the check can find the item even when the first box was off. */
function roomyBox(box: BoundingBox): BoundingBox {
  const padX = Math.max(box.width * 0.35, 0.06);
  const padY = Math.max(box.height * 0.35, 0.06);
  const x = clamp(box.x - padX, 0, 1);
  const y = clamp(box.y - padY, 0, 1);
  return {
    x,
    y,
    width: clamp(box.x + box.width + padX, 0, 1) - x,
    height: clamp(box.y + box.height + padY, 0, 1) - y,
  };
}

const CHECK_MAX_SIDE = 768;

type DetectedPiece = ClothingAttributes & { name: string; boundingBox: BoundingBox };

/**
 * Checks each detected piece against a close-up of where it was found. Pieces that aren't really there are dropped
 * (so a picture that doesn't match its description is never saved); the rest get a tighter box.
 */
async function checkPieces(img: HTMLImageElement, pieces: DetectedPiece[]): Promise<DetectedPiece[]> {
  if (!pieces.length) return pieces;
  const roomy = pieces.map((p) => roomyBox(p.boundingBox));
  const formData = new FormData();
  const meta = [];
  for (const [i, piece] of pieces.entries()) {
    const blob = await cropToBlob(img, roomy[i], CHECK_MAX_SIDE);
    const size = await createImageBitmap(blob).then((b) => {
      const s = { width: b.width, height: b.height };
      b.close();
      return s;
    });
    formData.append("crops", blob, `${i}.jpg`);
    meta.push({ name: piece.name, description: piece.description, ...size });
  }
  formData.append("items", JSON.stringify(meta));

  const res = await fetch("/api/closet/detect/check", { method: "POST", body: formData });
  const data = (await res.json().catch(() => ({}))) as { error?: string; results?: { found: boolean; box: BoundingBox | null }[] };
  if (!res.ok || !data.results) throw new Error(data.error ?? "Couldn't check those pieces.");

  return pieces.flatMap((piece, i) => {
    const r = data.results![i];
    if (!r?.found) return [];
    if (!r.box) return [piece];
    // Back from close-up fractions to whole-photo fractions, with a little breathing room around the item.
    const area = roomy[i];
    const pad = 0.04;
    const x = area.x + (r.box.x - r.box.width * pad) * area.width;
    const y = area.y + (r.box.y - r.box.height * pad) * area.height;
    const w = r.box.width * (1 + 2 * pad) * area.width;
    const h = r.box.height * (1 + 2 * pad) * area.height;
    const bx = clamp(x, 0, 1);
    const by = clamp(y, 0, 1);
    return [{ ...piece, boundingBox: { x: bx, y: by, width: clamp(x + w, 0, 1) - bx, height: clamp(y + h, 0, 1) - by } }];
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the uploaded photo"));
    img.src = url;
  });
}

function newManualItem(): ReviewItem {
  return {
    localId: crypto.randomUUID(),
    category: "top",
    layeringRole: "mid_layer",
    warmth: "medium",
    color: "",
    pattern: "solid",
    material: "",
    formality: "casual",
    season: "all-season",
    description: "",
    boundingBox: { x: 0, y: 0, width: 1, height: 1 },
    previewUrl: "",
  };
}

export function AddClothesModal({ onClose, onAdded }: { onClose: () => void; onAdded: (count: number) => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [checking, setChecking] = useState(false);
  const [leftOut, setLeftOut] = useState(0);
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Each step starts at the top of the popup (the photo), even after scrolling down on the previous one.
  useEffect(() => {
    overlayRef.current?.scrollTo({ top: 0 });
  }, [step]);

  async function handleFile(file: File) {
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Unsupported file type. Use a JPG, PNG, GIF, or WebP photo.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That photo is too large. Please use one under 20MB.");
      return;
    }

    setStep("analyzing");
    setChecking(false);
    setLeftOut(0);
    try {
      const prepared = await preparePhoto(file);
      const formData = new FormData();
      if (prepared) {
        formData.append("photo", prepared.blob, "photo.jpg");
        formData.append("width", String(prepared.width));
        formData.append("height", String(prepared.height));
      } else {
        formData.append("photo", file);
      }
      const res = await fetch("/api/closet/detect", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as { error?: string; imageUrl?: string; items?: DetectedPiece[] };
      if (!res.ok || !data.imageUrl) throw new Error(data.error ?? "Couldn't analyze that photo.");

      const img = await loadImage(data.imageUrl);
      imgElRef.current = img;

      setChecking(true);
      const found = data.items ?? [];
      const detected = await checkPieces(img, found);
      setLeftOut(found.length - detected.length);
      const withPreviews = await Promise.all(
        detected.map(async (item) => {
          let previewUrl = data.imageUrl!;
          try {
            const blob = await cropToBlob(img, item.boundingBox);
            previewUrl = URL.createObjectURL(blob);
          } catch {
            // fall back to the full photo if cropping fails for this item
          }
          const { name: _name, boundingBox, ...attrs } = item;
          void _name;
          return { ...attrs, localId: crypto.randomUUID(), boundingBox, previewUrl } as ReviewItem;
        })
      );

      setImageUrl(data.imageUrl);
      setItems(withPreviews);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't analyze that photo.");
      setStep("upload");
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function updateItem(localId: string, patch: Partial<ClothingAttributes>) {
    setItems((prev) => prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it)));
  }

  function removeItem(localId: string) {
    setItems((prev) => prev.filter((it) => it.localId !== localId));
  }

  function addManualItem() {
    setItems((prev) => [...prev, newManualItem()]);
  }

  async function handleConfirm() {
    if (items.length === 0 || !imgElRef.current) return;
    setConfirming(true);
    setError(null);
    try {
      const formData = new FormData();
      for (const item of items) {
        const blob = await cropToBlob(imgElRef.current, item.boundingBox);
        formData.append("images", blob, `${item.localId}.png`);
      }
      const metadata = items.map(({ category, layeringRole, warmth, color, pattern, material, formality, season, description }) => ({
        category,
        layeringRole,
        warmth,
        color: color.trim() || "unknown",
        pattern: pattern.trim() || "solid",
        material: material.trim() || "unknown",
        formality,
        season,
        description: description.trim() || "Clothing item",
      }));
      formData.append("items", JSON.stringify(metadata));

      const res = await fetch("/api/closet/items/bulk", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          data.error ?? (res.status === 413 ? "Those photos are too large to upload. Try fewer items at once." : "Couldn't add those items.")
        );
      }

      onAdded(metadata.length);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add those items.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#172027]/85 px-4 py-8">
      <div
        className="my-auto w-full max-w-2xl shrink-0 rounded-[24px] p-6 sm:p-8"
        style={{
          borderColor: "#c7d4da",
          background: "linear-gradient(145deg, #fff 0%, #edf4f7 72%, #f3e9eb 100%)",
          boxShadow: "0 25px 80px #1018205c",
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-[#5d6874]">
            {step === "upload" && "Add clothes — step 1 of 3"}
            {step === "analyzing" && "Add clothes — step 2 of 3"}
            {(step === "review" || step === "confirming") && "Add clothes — step 3 of 3"}
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#5d6874] hover:bg-[#f3f6f8]"
          >
            ×
          </button>
        </div>

        {error && <p className="mb-4 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {step === "upload" && (
          <div>
            <div className="mb-5 inline-flex rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]">
              <span className="rounded-full bg-[#121821] px-4 py-2 text-xs font-semibold text-white">Upload a photo</span>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Coming soon"
                className="cursor-not-allowed rounded-full px-4 py-2 text-xs font-semibold text-[#5d6874]"
              >
                Find Online — Coming Soon
              </button>
            </div>
            <h2 className="mb-1 text-xl font-semibold tracking-tight text-[#29343a]">
              Add clothes
            </h2>
            <p className="mb-5 text-sm text-[#445159]">
              Upload a photo of one item or several. Virm finds each piece and labels it.
            </p>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-[20px] border-2 border-dashed px-6 py-14 text-center transition-colors ${
                dragActive ? "border-[#121821] bg-[#f3f6f8]" : "border-black/[0.07] hover:border-[#89949a]"
              }`}
            >
              <span className="text-sm font-medium text-[#29343a]">Drop a photo here, or click to choose one</span>
              <span className="rounded-full bg-[#121821] px-5 py-2.5 text-xs font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_3px_10px_#222d3418] hover:bg-[#2a3542]">
                Choose photo
              </span>
              <input type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={handleInputChange} />
            </label>
            <p className="mt-4 text-xs text-[#5d6874]">
              Lay pieces out separately so each one is clearly visible.
            </p>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/[0.07] border-t-[#29343a]" />
            <p className="text-sm text-[#445159]">{checking ? "Checking each piece…" : "Analyzing your photo…"}</p>
          </div>
        )}

        {(step === "review" || step === "confirming") && imageUrl && (
          <div>
            <div data-tip="add-photo" className="relative mx-auto mb-5 w-fit max-w-full overflow-hidden rounded-xl bg-[#faf9f7]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Uploaded photo" className="block max-h-[55vh] w-auto max-w-full" />
              {items.map((item, i) =>
                item.boundingBox.width >= 0.999 && item.boundingBox.height >= 0.999 ? null : (
                  <div
                    key={item.localId}
                    className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(41,52,58,0.4)]"
                    style={{
                      left: `${item.boundingBox.x * 100}%`,
                      top: `${item.boundingBox.y * 100}%`,
                      width: `${item.boundingBox.width * 100}%`,
                      height: `${item.boundingBox.height * 100}%`,
                    }}
                  >
                    <span className="absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#29343a] text-xs font-semibold text-white">
                      {i + 1}
                    </span>
                  </div>
                )
              )}
            </div>

            {leftOut > 0 && (
              <p className="mb-4 text-center text-[13px] text-[#5b6870]">
                Left out {leftOut === 1 ? "1 piece" : `${leftOut} pieces`} we couldn&apos;t match to the photo.
              </p>
            )}

            {items.length === 0 ? (
              <div className="mb-5 rounded-[18px] bg-[#f4f5f6] p-6 text-center">
                <p className="mb-4 text-sm text-[#445159]">
                  We couldn&apos;t find clothes in this photo. Try spacing the pieces out, or add items manually.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={() => {
                      setStep("upload");
                      setImageUrl(null);
                      setItems([]);
                    }}
                    className="rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] px-4 py-2 text-sm font-medium text-[#333f46] hover:bg-[#e9edef]"
                  >
                    Try another photo
                  </button>
                  <button
                    onClick={addManualItem}
                    className="rounded-full bg-[#121821] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3542]"
                  >
                    Add an item manually
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm font-medium text-[#29343a]">
                  {items.length} item{items.length === 1 ? "" : "s"} detected
                </p>
                <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {items.map((item, i) => (
                    <div key={item.localId} data-tip={i === 0 ? "add-item" : undefined} className="rounded-[18px] bg-[#f4f5f6] p-3">
                      <div className="mb-3 flex gap-3">
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[#faf9f7]">
                          {item.previewUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#5d6874]">
                            Item {i + 1}
                          </p>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(item.localId, { description: e.target.value })}
                            placeholder="Item name / description"
                            className="w-full rounded-[10px] bg-white shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] px-2 py-1.5 text-sm text-[#29343a]"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={item.category}
                          onChange={(e) => updateItem(item.localId, { category: e.target.value as ClothingAttributes["category"] })}
                          className="rounded-[10px] bg-white shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] px-2 py-1.5 text-xs capitalize text-[#29343a]"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <select
                          value={item.layeringRole}
                          onChange={(e) => updateItem(item.localId, { layeringRole: e.target.value as ClothingAttributes["layeringRole"] })}
                          className="rounded-[10px] bg-white shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] px-2 py-1.5 text-xs text-[#29343a]"
                        >
                          {LAYERING_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {LAYER_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={item.color}
                          onChange={(e) => updateItem(item.localId, { color: e.target.value })}
                          placeholder="Color"
                          className="rounded-[10px] bg-white shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] px-2 py-1.5 text-xs text-[#29343a]"
                        />
                        <input
                          type="text"
                          value={item.material}
                          onChange={(e) => updateItem(item.localId, { material: e.target.value })}
                          placeholder="Material"
                          className="rounded-[10px] bg-white shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] px-2 py-1.5 text-xs text-[#29343a]"
                        />
                        <select
                          value={item.formality}
                          onChange={(e) => updateItem(item.localId, { formality: e.target.value as ClothingAttributes["formality"] })}
                          className="rounded-[10px] bg-white shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] px-2 py-1.5 text-xs capitalize text-[#29343a]"
                        >
                          {FORMALITIES.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                        <select
                          value={item.season}
                          onChange={(e) => updateItem(item.localId, { season: e.target.value as ClothingAttributes["season"] })}
                          className="col-span-2 rounded-[10px] bg-white shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] px-2 py-1.5 text-xs capitalize text-[#29343a]"
                        >
                          {SEASONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        data-tip={i === 0 ? "add-remove" : undefined}
                        onClick={() => removeItem(item.localId)}
                        className="mt-2 w-full rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] py-1 text-xs font-medium text-[#333f46] hover:bg-[#e9edef]"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <button onClick={addManualItem} className="text-sm font-medium text-[#445159] hover:underline">
                    + Add item manually
                  </button>
                  <p className="text-sm text-[#5d6874]">
                    {items.length} item{items.length === 1 ? "" : "s"} ready to add
                  </p>
                </div>

                <Tips id="add-clothes" tips={ADD_TIPS} />
                <button
                  data-tip="add-confirm"
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="w-full rounded-full bg-[#121821] px-5 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_3px_10px_#222d3418] hover:bg-[#2a3542] disabled:opacity-50"
                >
                  {confirming ? "Adding…" : "Add to My Closet"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
