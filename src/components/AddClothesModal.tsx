"use client";

import { useRef, useState } from "react";
import { CATEGORIES, FORMALITIES, SEASONS, LAYERING_ROLES, type ClothingAttributes } from "@/lib/clothingTaxonomy";
import { LAYER_LABELS } from "@/lib/layering";

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

/** Crops a region of a same-origin, already-loaded <img> into a real PNG blob. */
function cropToBlob(img: HTMLImageElement, box: BoundingBox): Promise<Blob> {
  const nw = img.naturalWidth || 1;
  const nh = img.naturalHeight || 1;
  const sx = clamp(box.x, 0, 1) * nw;
  const sy = clamp(box.y, 0, 1) * nh;
  const rawW = clamp(box.width, 0.02, 1) * nw;
  const rawH = clamp(box.height, 0.02, 1) * nh;
  const sw = Math.max(1, Math.min(rawW, nw - sx));
  const sh = Math.max(1, Math.min(rawH, nh - sy));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas not supported"));
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))), "image/png");
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

export function AddClothesModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [confirming, setConfirming] = useState(false);
  const imgElRef = useRef<HTMLImageElement | null>(null);

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
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/closet/detect", { method: "POST", body: formData });
      const data = (await res.json()) as { error?: string; imageUrl?: string; items?: (ClothingAttributes & { name: string; boundingBox: BoundingBox })[] };
      if (!res.ok || !data.imageUrl) throw new Error(data.error ?? "Couldn't analyze that photo.");

      const img = await loadImage(data.imageUrl);
      imgElRef.current = img;

      const detected = data.items ?? [];
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
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't add those items.");

      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add those items.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#172027]/85 px-4 py-8 sm:items-center">
      <div
        className="w-full max-w-2xl rounded-xl border p-6 sm:p-8"
        style={{
          borderColor: "#c7d4da",
          background: "linear-gradient(145deg, #fff 0%, #edf4f7 72%, #f3e9eb 100%)",
          boxShadow: "0 25px 80px #1018205c",
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-[#89949a]">
            {step === "upload" && "Add clothes — step 1 of 3"}
            {step === "analyzing" && "Add clothes — step 2 of 3"}
            {(step === "review" || step === "confirming") && "Add clothes — step 3 of 3"}
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#89949a] hover:bg-[#f3f6f8]"
          >
            ×
          </button>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {step === "upload" && (
          <div>
            <h2 className="mb-1 text-xl font-semibold tracking-tight text-[#29343a]">
              Add multiple clothing pieces at once
            </h2>
            <p className="mb-5 text-sm text-[#445159]">
              Upload a photo of several clothing items. AI will identify each piece and add them to your closet.
            </p>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
                dragActive ? "border-[#354134] bg-[#f3f6f8]" : "border-[#dce2e4] hover:border-[#89949a]"
              }`}
            >
              <span className="text-sm font-medium text-[#29343a]">Drop a photo here, or click to choose one</span>
              <span className="rounded-[5px] bg-[#242b30] px-5 py-2.5 text-xs font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_3px_10px_#222d3418] hover:bg-[#3b4750]">
                Choose photo
              </span>
              <input type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={handleInputChange} />
            </label>
            <p className="mt-4 text-xs text-[#89949a]">
              For best results, place clothing pieces separately so each item is clearly visible. On mobile, your
              photo picker can also open the camera directly.
            </p>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#dce2e4] border-t-[#29343a]" />
            <p className="text-sm text-[#445159]">Analyzing your photo…</p>
          </div>
        )}

        {(step === "review" || step === "confirming") && imageUrl && (
          <div>
            <div className="relative mb-5 w-full overflow-hidden rounded-xl bg-[#faf9f7]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Uploaded photo" className="block w-full" />
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

            {items.length === 0 ? (
              <div className="mb-5 rounded-xl border border-[#dce2e4] p-6 text-center">
                <p className="mb-4 text-sm text-[#445159]">
                  We couldn&apos;t confidently identify the clothing in this photo. Try a photo with the pieces more
                  separated, or add items manually.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={() => {
                      setStep("upload");
                      setImageUrl(null);
                      setItems([]);
                    }}
                    className="rounded-[5px] border border-[#cbd3d7] px-4 py-2 text-sm font-medium text-[#333f46] hover:bg-[#e9edef]"
                  >
                    Try another photo
                  </button>
                  <button
                    onClick={addManualItem}
                    className="rounded-[5px] bg-[#242b30] px-4 py-2 text-sm font-medium text-white hover:bg-[#3b4750]"
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
                    <div key={item.localId} className="rounded-xl border border-[#dce2e4] p-3">
                      <div className="mb-3 flex gap-3">
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[#faf9f7]">
                          {item.previewUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#89949a]">
                            Item {i + 1}
                          </p>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(item.localId, { description: e.target.value })}
                            placeholder="Item name / description"
                            className="w-full rounded-lg border border-[#dce2e4] bg-white px-2 py-1.5 text-sm text-[#29343a]"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={item.category}
                          onChange={(e) => updateItem(item.localId, { category: e.target.value as ClothingAttributes["category"] })}
                          className="rounded-lg border border-[#dce2e4] bg-white px-2 py-1.5 text-xs capitalize text-[#29343a]"
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
                          className="rounded-lg border border-[#dce2e4] bg-white px-2 py-1.5 text-xs text-[#29343a]"
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
                          className="rounded-lg border border-[#dce2e4] bg-white px-2 py-1.5 text-xs text-[#29343a]"
                        />
                        <input
                          type="text"
                          value={item.material}
                          onChange={(e) => updateItem(item.localId, { material: e.target.value })}
                          placeholder="Material"
                          className="rounded-lg border border-[#dce2e4] bg-white px-2 py-1.5 text-xs text-[#29343a]"
                        />
                        <select
                          value={item.formality}
                          onChange={(e) => updateItem(item.localId, { formality: e.target.value as ClothingAttributes["formality"] })}
                          className="rounded-lg border border-[#dce2e4] bg-white px-2 py-1.5 text-xs capitalize text-[#29343a]"
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
                          className="col-span-2 rounded-lg border border-[#dce2e4] bg-white px-2 py-1.5 text-xs capitalize text-[#29343a]"
                        >
                          {SEASONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => removeItem(item.localId)}
                        className="mt-2 w-full rounded-[5px] border border-[#cbd3d7] py-1 text-xs font-medium text-[#333f46] hover:bg-[#e9edef]"
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
                  <p className="text-sm text-[#89949a]">
                    {items.length} item{items.length === 1 ? "" : "s"} ready to add
                  </p>
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="w-full rounded-[5px] bg-[#242b30] px-5 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_3px_10px_#222d3418] hover:bg-[#3b4750] disabled:opacity-50"
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
