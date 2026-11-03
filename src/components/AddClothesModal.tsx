"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, FORMALITIES, SEASONS, LAYERING_ROLES, type ClothingAttributes } from "@/lib/clothingTaxonomy";
import { LAYER_LABELS } from "@/lib/layering";
import { Tips, type Tip } from "@/components/Tips";
import { warmUpCutout } from "@/lib/cutout";
import { removeBackgroundPreferred, setRemoveBackgroundPreferred } from "@/lib/cutoutClient";

const ADD_TIPS: Tip[] = [
  { target: '[data-tip="add-photo"]', text: "Each number marks a piece Virm found." },
  { target: '[data-tip="add-item"]', text: "Check its name and details. Fix anything that's wrong." },
  { target: '[data-tip="add-remove"]', text: "Not yours, or not needed? Remove it." },
  { target: '[data-tip="add-confirm"]', text: "All good? Add them to your closet." },
];

type BoundingBox = { x: number; y: number; width: number; height: number };

type ReviewItem = ClothingAttributes & {
  localId: string;
  /** Which of the chosen photos the piece is in. */
  photoIndex: number;
  boundingBox: BoundingBox;
  previewUrl: string;
};

/** A chosen photo, as the server saved it, and loaded for cropping. */
type ChosenPhoto = { url: string; img: HTMLImageElement };

/** Photos read in one go. Each is one AI read, the same as adding them one at a time. */
const MAX_PHOTOS = 10;

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

function newManualItem(photoIndex: number): ReviewItem {
  return {
    localId: crypto.randomUUID(),
    photoIndex,
    category: "top",
    layeringRole: "mid_layer",
    warmth: "medium",
    color: "",
    pattern: "solid",
    material: "",
    formality: "casual",
    season: "all-season",
    description: "",
    brand: "",
    boundingBox: { x: 0, y: 0, width: 1, height: 1 },
    previewUrl: "",
  };
}

export function AddClothesModal<T extends { id: string; imageUrl: string }>({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  /** The new pieces come back too, so their backgrounds can be removed (if the person chose that). */
  onAdded: (count: number, items: T[]) => void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ChosenPhoto[]>([]);
  /** The photo shown large in the review (its pieces' boxes are drawn on it). */
  const [activePhoto, setActivePhoto] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [checking, setChecking] = useState(false);
  const [leftOut, setLeftOut] = useState(0);
  /** The piece whose picture is being picked on the photo, if any. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const photoRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [dragBox, setDragBox] = useState<BoundingBox | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  // Remove background (on by default) or keep it; remembered on this device.
  const [removeBg, setRemoveBg] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage, read after the first render
    setRemoveBg(removeBackgroundPreferred());
    warmUpCutout();
  }, []);

  function chooseRemoveBg(on: boolean) {
    setRemoveBg(on);
    setRemoveBackgroundPreferred(on);
  }

  // Each step starts at the top of the popup (the photo), even after scrolling down on the previous one.
  useEffect(() => {
    overlayRef.current?.scrollTo({ top: 0 });
  }, [step]);

  /** Reads one photo: the server finds the pieces, then each is checked against a close-up. */
  async function readPhoto(file: File, photoIndex: number): Promise<{ photo: ChosenPhoto; items: ReviewItem[]; leftOut: number }> {
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
    const found = data.items ?? [];
    const detected = await checkPieces(img, found);
    const items = await Promise.all(
      detected.map(async (item) => {
        let previewUrl = data.imageUrl!;
        try {
          previewUrl = URL.createObjectURL(await cropToBlob(img, item.boundingBox));
        } catch {
          // fall back to the full photo if cropping fails for this item
        }
        const { name: _name, boundingBox, ...attrs } = item;
        void _name;
        return { ...attrs, localId: crypto.randomUUID(), photoIndex, boundingBox, previewUrl } as ReviewItem;
      })
    );
    return { photo: { url: data.imageUrl, img }, items, leftOut: found.length - detected.length };
  }

  /** Reads one or more photos in turn; all their pieces land in one review list (added to any already there). */
  async function handleFiles(chosen: File[]) {
    setError(null);
    const usable = chosen.filter((f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_BYTES);
    const room = MAX_PHOTOS - photos.length;
    const files = usable.slice(0, Math.max(0, room));
    if (!files.length) {
      setError(
        room <= 0
          ? `That's ${MAX_PHOTOS} photos. Add these first, then the rest.`
          : "Use JPG, PNG, GIF, or WebP photos under 20MB."
      );
      return;
    }
    const notes = [
      usable.length < chosen.length ? `${chosen.length - usable.length} weren't JPG, PNG, GIF or WebP under 20MB` : "",
      usable.length > files.length ? `only the first ${files.length} were read (up to ${MAX_PHOTOS} at once)` : "",
    ].filter(Boolean);

    const firstNew = photos.length;
    setStep("analyzing");
    setEditingId(null);
    setChecking(false);
    setProgress({ done: 0, total: files.length });
    const newPhotos: ChosenPhoto[] = [];
    const newItems: ReviewItem[] = [];
    let newLeftOut = 0;
    let failed = 0;
    for (const [n, file] of files.entries()) {
      setProgress({ done: n, total: files.length });
      try {
        const read = await readPhoto(file, firstNew + newPhotos.length);
        newPhotos.push(read.photo);
        newItems.push(...read.items);
        newLeftOut += read.leftOut;
      } catch {
        failed++;
      }
    }
    setProgress(null);

    if (!newPhotos.length) {
      setError(files.length === 1 ? "Couldn't analyze that photo." : "Couldn't analyze those photos.");
      setStep(photos.length ? "review" : "upload");
      return;
    }
    setPhotos((prev) => [...prev, ...newPhotos]);
    setItems((prev) => [...prev, ...newItems]);
    setLeftOut((prev) => prev + newLeftOut);
    setSkipped((prev) => prev + failed);
    setActivePhoto(firstNew);
    if (notes.length) setError(`Note: ${notes.join("; ")}.`);
    setStep("review");
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) handleFiles(files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) handleFiles(files);
  }

  function updateItem(localId: string, patch: Partial<ClothingAttributes>) {
    setItems((prev) => prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it)));
  }

  /** Where a pointer is on the photo, as fractions of it. */
  function photoPoint(e: React.PointerEvent) {
    const r = photoRef.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
  }

  /** Gives a piece a new box on the photo and remakes its picture from it. */
  async function setItemBox(localId: string, box: BoundingBox) {
    const img = photos[items.find((it) => it.localId === localId)?.photoIndex ?? -1]?.img;
    if (!img) return;
    let previewUrl = "";
    try {
      previewUrl = URL.createObjectURL(await cropToBlob(img, box));
    } catch {
      return;
    }
    setItems((prev) =>
      prev.map((it) => {
        if (it.localId !== localId) return it;
        if (it.previewUrl.startsWith("blob:")) URL.revokeObjectURL(it.previewUrl);
        return { ...it, boundingBox: box, previewUrl };
      })
    );
  }

  function handlePhotoDown(e: React.PointerEvent) {
    if (!editingId) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { ...photoPoint(e), moved: false };
  }

  function handlePhotoMove(e: React.PointerEvent) {
    const start = dragRef.current;
    if (!start) return;
    const p = photoPoint(e);
    if (!start.moved && Math.hypot(p.x - start.x, p.y - start.y) < 0.03) return;
    start.moved = true;
    setDragBox({ x: Math.min(p.x, start.x), y: Math.min(p.y, start.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) });
  }

  function handlePhotoUp(e: React.PointerEvent) {
    const start = dragRef.current;
    dragRef.current = null;
    setDragBox(null);
    const item = items.find((it) => it.localId === editingId);
    if (!start || !item) return;
    const p = photoPoint(e);
    if (start.moved) {
      // Dragged: the box is what they drew.
      const box = { x: Math.min(p.x, start.x), y: Math.min(p.y, start.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) };
      if (box.width > 0.02 && box.height > 0.02) setItemBox(item.localId, box);
      return;
    }
    // Tapped: a box of the same size (or a medium one, for a whole-photo item) centered where they tapped.
    const whole = item.boundingBox.width >= 0.999 && item.boundingBox.height >= 0.999;
    const width = whole ? 0.35 : item.boundingBox.width;
    const height = whole ? 0.3 : item.boundingBox.height;
    setItemBox(item.localId, {
      x: clamp(p.x - width / 2, 0, 1 - width),
      y: clamp(p.y - height / 2, 0, 1 - height),
      width,
      height,
    });
  }

  function startEditing(localId: string) {
    setEditingId(localId);
    // Fixing a piece's picture shows the photo it's in.
    const item = items.find((it) => it.localId === localId);
    if (item) setActivePhoto(item.photoIndex);
    overlayRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeItem(localId: string) {
    if (editingId === localId) setEditingId(null);
    setItems((prev) => prev.filter((it) => it.localId !== localId));
  }

  function addManualItem() {
    setItems((prev) => [...prev, newManualItem(activePhoto)]);
  }

  async function handleConfirm() {
    if (items.length === 0 || !photos.length) return;
    setConfirming(true);
    setError(null);
    try {
      const formData = new FormData();
      for (const item of items) {
        const blob = await cropToBlob(photos[item.photoIndex].img, item.boundingBox);
        formData.append("images", blob, `${item.localId}.png`);
      }
      const metadata = items.map(({ category, layeringRole, warmth, color, pattern, material, formality, season, description, brand }) => ({
        category,
        layeringRole,
        warmth,
        color: color.trim() || "unknown",
        pattern: pattern.trim() || "solid",
        material: material.trim() || "unknown",
        formality,
        season,
        description: description.trim() || "Clothing item",
        brand: brand?.trim() || null,
      }));
      formData.append("items", JSON.stringify(metadata));

      const res = await fetch("/api/closet/items/bulk", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as { error?: string; items?: T[] };
      if (!res.ok) {
        throw new Error(
          data.error ?? (res.status === 413 ? "Those photos are too large to upload. Try fewer items at once." : "Couldn't add those items.")
        );
      }

      onAdded(metadata.length, data.items ?? []);
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
        className="my-auto w-full max-w-2xl shrink-0 rounded-[24px] bg-white p-6 sm:p-8"
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
              <span className="rounded-full bg-[#121821] px-4 py-2 text-xs font-semibold text-white">Upload photos</span>
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
              Choose one photo or several. Virm finds each piece and labels it.
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
              <span className="text-sm font-medium text-[#29343a]">Drop photos here, or click to choose</span>
              <span className="rounded-full bg-[#121821] px-5 py-2.5 text-xs font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_3px_10px_#222d3418] hover:bg-[#2a3542]">
                Choose photos
              </span>
              <input type="file" multiple accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={handleInputChange} />
            </label>
            <p className="mt-4 text-xs text-[#5d6874]">
              Lay pieces out separately so each one is clearly visible.
            </p>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/[0.07] border-t-[#29343a]" />
            <p className="text-sm text-[#445159]">
              {progress && progress.total > 1
                ? `Reading photo ${progress.done + 1} of ${progress.total}…`
                : checking
                  ? "Checking each piece…"
                  : "Analyzing your photo…"}
            </p>
          </div>
        )}

        {(step === "review" || step === "confirming") && photos[activePhoto] && (
          <div>
            {/* Several photos: pick which one is shown large (its pieces' boxes are drawn on it). */}
            {photos.length > 1 && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Your photos">
                {photos.map((p, n) => (
                  <button
                    key={p.url}
                    role="tab"
                    aria-selected={n === activePhoto}
                    aria-label={`Photo ${n + 1}`}
                    onClick={() => {
                      setActivePhoto(n);
                      setEditingId(null);
                    }}
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-[10px] bg-[#faf9f7] ${n === activePhoto ? "ring-2 ring-[#29343a]" : "opacity-70 hover:opacity-100"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                    <span className="absolute bottom-0.5 right-0.5 rounded-full bg-white/90 px-1.5 text-[10px] font-semibold text-[#29343a]">
                      {items.filter((it) => it.photoIndex === n).length}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {editingId && (
              <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center">
                <p className="text-[13px] text-[#445159]">
                  Item {items.findIndex((it) => it.localId === editingId) + 1}: tap the piece, or drag a box around it.
                </p>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-full bg-[#121821] px-4 py-1.5 text-[13px] font-medium text-white hover:bg-[#2a3542]"
                >
                  Done
                </button>
              </div>
            )}
            <div
              ref={photoRef}
              data-tip="add-photo"
              onPointerDown={handlePhotoDown}
              onPointerMove={handlePhotoMove}
              onPointerUp={handlePhotoUp}
              onPointerCancel={() => {
                dragRef.current = null;
                setDragBox(null);
              }}
              className={`relative mx-auto mb-5 w-fit max-w-full select-none overflow-hidden rounded-xl bg-[#faf9f7] ${
                editingId ? "cursor-crosshair touch-none ring-2 ring-[#29343a]" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[activePhoto].url} alt="Uploaded photo" draggable={false} className="block max-h-[55vh] w-auto max-w-full" />
              {items.map((item, i) =>
                item.photoIndex !== activePhoto || (item.boundingBox.width >= 0.999 && item.boundingBox.height >= 0.999) ? null : (
                  <div
                    key={item.localId}
                    className={`pointer-events-none absolute border-2 border-white shadow-[0_0_0_1px_rgba(41,52,58,0.4)] ${
                      editingId && editingId !== item.localId ? "opacity-30" : ""
                    } ${editingId === item.localId && dragBox ? "hidden" : ""}`}
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
              {dragBox && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-white shadow-[0_0_0_1px_rgba(41,52,58,0.4)]"
                  style={{
                    left: `${dragBox.x * 100}%`,
                    top: `${dragBox.y * 100}%`,
                    width: `${dragBox.width * 100}%`,
                    height: `${dragBox.height * 100}%`,
                  }}
                />
              )}
            </div>

            {(leftOut > 0 || skipped > 0) && (
              <p className="mb-4 text-center text-[13px] text-[#5b6870]">
                {leftOut > 0 && <>Left out {leftOut === 1 ? "1 piece" : `${leftOut} pieces`} we couldn&apos;t match to the photo. </>}
                {skipped > 0 && <>{skipped === 1 ? "1 photo" : `${skipped} photos`} couldn&apos;t be read.</>}
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
                      setPhotos([]);
                      setItems([]);
                      setActivePhoto(0);
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
                <p className="text-sm font-medium text-[#29343a]">
                  {items.length} item{items.length === 1 ? "" : "s"} detected
                </p>
                <p className="mb-3 mt-0.5 text-[12.5px] text-[#5d6874]">
                  Photos can be misleading: change the material or color if it isn&apos;t right (and add the fabric to the name, like &ldquo;linen
                  shirt&rdquo;, so try-ons show it).
                </p>
                <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {items.map((item, i) => (
                    <div key={item.localId} data-tip={i === 0 ? "add-item" : undefined} className="rounded-[18px] bg-[#f4f5f6] p-3">
                      <div className="mb-3 flex gap-3">
                        <button
                          type="button"
                          onClick={() => startEditing(item.localId)}
                          aria-label={`Edit picture of item ${i + 1}`}
                          title="Edit picture"
                          className={`group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[#faf9f7] ${
                            editingId === item.localId ? "ring-2 ring-[#29343a]" : ""
                          }`}
                        >
                          {item.previewUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                          )}
                          <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#29343a] shadow group-hover:bg-white">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </span>
                        </button>
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
                          <input
                            type="text"
                            value={item.brand ?? ""}
                            onChange={(e) => updateItem(item.localId, { brand: e.target.value })}
                            placeholder="Brand (optional)"
                            aria-label="Brand"
                            maxLength={60}
                            className="mt-1.5 w-full rounded-[10px] bg-white shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] px-2 py-1.5 text-xs text-[#29343a]"
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
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    {photos.length < MAX_PHOTOS && (
                      <label className="cursor-pointer text-sm font-medium text-[#445159] hover:underline">
                        + Add more photos
                        <input type="file" multiple accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={handleInputChange} />
                      </label>
                    )}
                    <button onClick={addManualItem} className="text-sm font-medium text-[#445159] hover:underline">
                      + Add item manually
                    </button>
                  </span>
                  <p className="text-sm text-[#5d6874]">
                    {items.length} item{items.length === 1 ? "" : "s"} ready to add
                  </p>
                </div>

                <div role="radiogroup" aria-label="Background" className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-[#f1f3f3] p-1 text-[12.5px] font-semibold">
                  {([
                    [true, "Remove background"],
                    [false, "Keep background"],
                  ] as const).map(([on, label]) => (
                    <button
                      key={label}
                      role="radio"
                      aria-checked={removeBg === on}
                      onClick={() => chooseRemoveBg(on)}
                      className={`rounded-full px-3 py-2 transition ${removeBg === on ? "bg-white text-[#121821] shadow-[0_1px_3px_rgba(18,24,33,0.12)]" : "text-[#5d6874] hover:text-[#121821]"}`}
                    >
                      {label}
                    </button>
                  ))}
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
