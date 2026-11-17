"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "@/lib/useDialog";
import { retryImage } from "@/lib/retryImage";
import { fetchWithRetry } from "@/lib/fetchRetry";
import Image from "next/image";
import { CATEGORIES, FORMALITIES, SEASONS, LAYERING_ROLES } from "@/lib/clothingTaxonomy";
import { LAYER_LABELS } from "@/lib/layering";
import { AddClothesModal } from "@/components/AddClothesModal";
import { useToast } from "@/components/Toast";
import { InlineLoading } from "@/components/InlineLoading";
import { CheckIcon, PlusIcon, SparkleIcon } from "@/components/Icons";
import { EmptyState, ErrorNote, btnPrimary, btnSecondary, btnText } from "@/components/ui";
import { keepItemBackground, removeBackgroundsAfterAdding, removeItemBackground } from "@/lib/cutoutClient";
import { warmUpCutout } from "@/lib/cutout";
import { DRIFT_WARNING, keepEnhancement, previewEnhancement, showPicture, type EnhancePreview } from "@/lib/enhanceClient";
import { ShelfRow } from "@/components/ShelfRow";
import Link from "next/link";

/** What a dragged closet piece carries (its id), so Studio's mirror can take it. */
export const PIECE_DRAG_TYPE = "application/x-virm-piece";

/** A piece from Shopping (not owned): enough to show it and put it on the mirror. */
export type UnownedPiece = { id: string; imageUrl: string; description: string; category: string; retailer?: string };

export type ClothingItem = {
  id: string;
  imageUrl: string;
  category: string;
  layeringRole: string;
  color: string;
  pattern: string;
  material: string;
  formality: string;
  season: string;
  description: string;
  brand?: string | null;
  /** AI enhancement (everyone, within a monthly allowance): the piece's own picture, and the AI-tidied one (imageUrl is the one shown). */
  plainUrl?: string | null;
  enhancedUrl?: string | null;
};

type EditForm = Pick<
  ClothingItem,
  "category" | "layeringRole" | "color" | "pattern" | "material" | "formality" | "season" | "description"
> & { brand: string };

/** The shelf's rows, in the order they're shown. */
const SHELVES: { value: string; label: string }[] = [
  { value: "top", label: "Tops" },
  { value: "bottom", label: "Bottoms" },
  { value: "dress", label: "Dresses" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "accessory", label: "Accessories" },
];

const FORMALITY_LABELS: Record<string, string> = {
  casual: "Casual / everyday",
  "smart-casual": "Smart casual",
  formal: "Formal / events",
  athletic: "Athletic / active",
};

const isPlaceholder = (item: ClothingItem) => item.description.startsWith("Demo item");
/** A picture whose background was removed (see src/lib/images.ts). */
const isCutout = (item: ClothingItem) => item.imageUrl.startsWith("/uploads/cut-");
const layerLabel = (role: string) => LAYER_LABELS[role as keyof typeof LAYER_LABELS] ?? role;

function toEditForm(item: ClothingItem): EditForm {
  const { category, layeringRole, color, pattern, material, formality, season, description } = item;
  return { category, layeringRole, color, pattern, material, formality, season, description, brand: item.brand ?? "" };
}

const selectClass =
  "min-h-[40px] rounded-full bg-white px-4 pr-9 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] text-[12.5px] capitalize text-[#26313a] outline-none focus:shadow-[inset_0_0_0_2px_#121821]";
const fieldClass =
  "min-h-[40px] w-full rounded-[12px] bg-white px-3 py-2 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] text-[13px] text-[#121821] outline-none focus:shadow-[inset_0_0_0_2px_#121821]";

/**
 * My Closet, inside Studio: the pieces in rows by kind, Add clothes, Edit, filters, and each piece's window (details,
 * Enhance with AI, Remove background, Remove, and Wear it, which puts it on the mirror). `onItems` hears the closet
 * whenever it changes (added, edited, removed, new picture), so Studio stays in step.
 */
export function ClosetView({
  onWear,
  wornIds,
  startAdding = false,
  addRequest = 0,
  onItems,
  unowned = [],
  startFiles,
}: {
  onWear: (item: ClothingItem) => void;
  /** Unowned: pieces tried on from Shopping (not in the closet), worn the same way. */
  unowned?: UnownedPiece[];
  /** Photos dropped on the closet before it opened: Add clothes opens with them. */
  startFiles?: File[];
  wornIds: Set<string>;
  startAdding?: boolean;
  /** A new number opens Add clothes. */
  addRequest?: number;
  onItems?: (items: ClothingItem[]) => void;
}) {
  const { showToast } = useToast();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Pieces whose background is being removed right now.
  const [working, setWorking] = useState<Set<string>>(new Set());
  const [colorFilter, setColorFilter] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("");
  const [formalityFilter, setFormalityFilter] = useState("");
  const [layerFilter, setLayerFilter] = useState("");
  const [search, setSearch] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [showAddClothes, setShowAddClothes] = useState(startAdding || Boolean(startFiles?.length));
  // Photos dragged in from the computer: Add clothes opens with them.
  const [droppedFiles, setDroppedFiles] = useState<File[] | undefined>(startFiles);
  const [dropping, setDropping] = useState(false);
  const takesFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  // My clothes (the closet) or Unowned (pieces tried on from Shopping).
  const [view, setView] = useState<"owned" | "unowned">("owned");
  const [lastAddRequest, setLastAddRequest] = useState(addRequest);
  if (addRequest !== lastAddRequest) {
    setLastAddRequest(addRequest);
    setShowAddClothes(true);
  }
  const [justAdded, setJustAdded] = useState<number | null>(null);

  async function loadItems() {
    try {
      const res = await fetchWithRetry("/api/closet/items");
      if (!res.ok) throw new Error("Failed to load closet");
      const data = (await res.json()) as { items?: ClothingItem[] };
      setItems(data.items ?? []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    loadItems();
    fetch("/api/config")
      .then((res) => res.json() as Promise<{ aiEnabled?: boolean }>)
      .then((data) => setAiEnabled(Boolean(data.aiEnabled)))
      .catch(() => {});
  }, []);

  // If the closet couldn't load, try again by itself when the connection comes back or the tab is opened again.
  useEffect(() => {
    if (!loadError) return;
    const retry = () => document.visibilityState === "visible" && loadItems();
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [loadError]);

  // Studio keeps its own copy in step (for its picks and the mirror).
  const told = useRef(onItems);
  useEffect(() => {
    told.current = onItems;
  });
  useEffect(() => {
    if (!loading && !loadError) told.current?.(items);
  }, [items, loading, loadError]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (colorFilter && item.color !== colorFilter) return false;
      if (seasonFilter && item.season !== seasonFilter && item.season !== "all-season") return false;
      if (formalityFilter && item.formality !== formalityFilter) return false;
      if (layerFilter && item.layeringRole !== layerFilter) return false;
      if (!q) return true;
      return [item.description, item.category, item.color, item.material, item.pattern, item.brand ?? ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [items, colorFilter, seasonFilter, formalityFilter, layerFilter, search]);

  const colors = useMemo(() => [...new Set(items.map((i) => i.color).filter(Boolean))].sort(), [items]);
  const filtersActive = Boolean(colorFilter || seasonFilter || formalityFilter || layerFilter || search);
  const viewing = items.find((i) => i.id === viewingId) ?? null;

  const replaceItem = (updated: ClothingItem) => setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  const markWorking = (id: string, on: boolean) =>
    setWorking((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /** New pieces: their backgrounds are removed one by one (if the person chose that), while the closet is shown. */
  async function cleanUpNew(added: ClothingItem[]) {
    added.forEach((i) => markWorking(i.id, true));
    await removeBackgroundsAfterAdding(added, replaceItem);
    added.forEach((i) => markWorking(i.id, false));
  }

  // Pieces removed but still in their Undo time: deleted for real when it runs out, or right away if the page is left.
  const pendingDeletes = useRef(new Map<string, { item: ClothingItem; timer: ReturnType<typeof setTimeout> }>());
  useEffect(() => {
    const pending = pendingDeletes.current;
    const flush = () => {
      for (const { item, timer } of pending.values()) {
        clearTimeout(timer);
        void deleteNow(item, true);
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  /** One piece: Remove background, or Keep background (the original photo). */
  async function toggleBackground(item: ClothingItem) {
    setError(null);
    markWorking(item.id, true);
    const updated = await (isCutout(item) ? keepItemBackground(item) : removeItemBackground(item)).catch(() => null);
    markWorking(item.id, false);
    if (updated) replaceItem(updated);
    else setError(isCutout(item) ? "Couldn't bring back the original photo." : "Couldn't find a clear piece to cut out in this photo, so it stays as it is.");
  }

  function clearFilters() {
    setColorFilter("");
    setSeasonFilter("");
    setFormalityFilter("");
    setLayerFilter("");
    setSearch("");
  }

  async function afterAdding(count: number, added: ClothingItem[] = []) {
    setLoading(true);
    await loadItems();
    setJustAdded(count);
    if (added.length) cleanUpNew(added);
    showToast(count === 1 ? "Added to your closet" : `${count} pieces added to your closet`);
  }

  /** Really deletes a piece (after its Undo time ran out, or the page is being left). */
  async function deleteNow(item: ClothingItem, leaving = false) {
    pendingDeletes.current.delete(item.id);
    const res = await fetch(`/api/closet/items/${item.id}`, { method: "DELETE", keepalive: leaving }).catch(() => null);
    if (!leaving && !res?.ok) {
      // It couldn't be deleted: show it again rather than lose track of it.
      setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [item, ...prev]));
      setError("Couldn't remove that item. Please try again.");
    }
  }

  /**
   * ✕ / Remove: the piece leaves the closet at once (no pop-up), with "Removed · Undo" for a few seconds. It's only
   * deleted for real when that time runs out, so Undo brings it back exactly as it was.
   */
  function handleDelete(item: ClothingItem) {
    const index = items.findIndex((i) => i.id === item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setViewingId(null);
    const timer = setTimeout(() => deleteNow(item), 6000);
    pendingDeletes.current.set(item.id, { item, timer });
    showToast("Removed from your closet", {
      label: "Undo",
      onClick: () => {
        clearTimeout(timer);
        pendingDeletes.current.delete(item.id);
        setItems((prev) => {
          if (prev.some((i) => i.id === item.id)) return prev;
          const next = [...prev];
          next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
          return next;
        });
      },
    });
  }

  async function handleReanalyze(id: string) {
    setError(null);
    setReanalyzingId(id);
    try {
      const res = await fetch(`/api/closet/items/${id}/reanalyze`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; item?: ClothingItem };
      if (!res.ok || !data.item) throw new Error(data.error ?? "Re-analyze failed");
      const updated = data.item;
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-analyze failed");
    } finally {
      setReanalyzingId(null);
    }
  }

  async function saveEdit(id: string, form: EditForm): Promise<boolean> {
    setError(null);
    try {
      const res = await fetch(`/api/closet/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; item?: ClothingItem };
      if (!res.ok || !data.item) throw new Error(data.error ?? "Update failed");
      const updated = data.item;
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      showToast("Changes saved");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      return false;
    }
  }

  const bar = (
    <div role="tablist" aria-label="Which clothes" className="relative mb-3 grid w-full max-w-[320px] grid-cols-2 rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]">
      <span
        aria-hidden
        className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#121821] transition-transform duration-300 ease-[cubic-bezier(.3,.7,.2,1)] motion-reduce:transition-none ${
          view === "unowned" ? "translate-x-full" : "translate-x-0"
        }`}
      />
      {(["owned", "unowned"] as const).map((v) => (
        <button
          key={v}
          role="tab"
          aria-selected={view === v}
          onClick={() => setView(v)}
          className={`relative rounded-full py-2 text-[13px] font-semibold transition-colors duration-300 ${view === v ? "text-white" : "text-[#4f5b66]"}`}
        >
          {v === "owned" ? "My clothes" : "Unowned"}
        </button>
      ))}
    </div>
  );

  if (view === "unowned") {
    return (
      <section aria-label="Unowned">
        {bar}
        {unowned.length === 0 ? (
          <p className="py-6 text-[13.5px] text-[#4f5b66]">
            Pieces you try on from Shopping show up here.{" "}
            <Link href="/shop" className="font-semibold text-[#121821] underline underline-offset-4">
              Browse Shopping
            </Link>
          </p>
        ) : (
          <>
            <p className="mb-3 text-[12px] text-[#5d6874]">
              Tap to wear, tap again to take it off.{" "}
              <Link href="/shop" className="font-semibold text-[#121821] underline-offset-4 hover:underline">
                Find more in Shopping
              </Link>
            </p>
            <div className="closet-shelf rounded-[20px] px-4 py-3 sm:rounded-[24px] sm:px-6 sm:py-4">
              {SHELVES.map(({ value, label }) => {
                const row = unowned.filter((p) => p.category === value);
                if (row.length === 0) return null;
                return (
                  <ShelfRow key={value} label={label} count={row.length}>
                    {row.map((piece) => {
                      const on = wornIds.has(piece.id);
                      return (
                        <li key={piece.id} className="relative shrink-0 snap-start">
                          <button
                            onClick={() => onWear(piece as unknown as ClothingItem)}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(PIECE_DRAG_TYPE, piece.id);
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            aria-pressed={on}
                            aria-label={`${on ? "Take off" : "Wear"} ${piece.description}`}
                            className="group block text-left"
                          >
                            <span className={`relative block h-[88px] w-[68px] overflow-hidden rounded-[10px] bg-white sm:h-[112px] sm:w-[86px] ${on ? "ring-2 ring-[#121821]" : ""}`}>
                              <Image src={piece.imageUrl} alt="" fill unoptimized onError={retryImage} className="object-contain p-1" />
                              {on && (
                                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#121821] text-white">
                                  <CheckIcon className="h-3 w-3" />
                                </span>
                              )}
                            </span>
                            {piece.retailer && <span className="mt-1 block w-[68px] truncate text-[10.5px] text-[#5d6874] sm:w-[86px]">{piece.retailer}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ShelfRow>
                );
              })}
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label="My Closet"
      onDragOver={(e) => {
        if (!takesFiles(e)) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(e) => {
        if (!takesFiles(e)) return;
        e.preventDefault();
        setDropping(false);
        const files = Array.from(e.dataTransfer.files);
        if (!files.length) return;
        setDroppedFiles(files);
        setShowAddClothes(true);
      }}
      className={`relative rounded-[18px] ${dropping ? "outline-dashed outline-2 outline-offset-4 outline-[#121821]/40" : ""}`}
    >
        {dropping && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[18px] bg-white/80 text-[14px] font-semibold text-[#121821]">
            Drop photos to add them
          </div>
        )}
        {bar}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setShowAddClothes(true)} data-tip="closet-add" className={`${btnPrimary} !min-h-[40px] !px-4 !text-[13px]`}>
            <PlusIcon className="h-4 w-4" /> Add clothes
          </button>
          {items.length > 0 && (
            <button onClick={() => setEditMode((v) => !v)} aria-pressed={editMode} className={`${btnSecondary} !min-h-[40px] !px-4 !text-[13px]`}>
              {editMode ? "Done" : "Edit"}
            </button>
          )}
        </div>

        {/* Drawn over the whole page (the closet panel would otherwise hold them inside it). */}
        {showAddClothes &&
          createPortal(
            <AddClothesModal
              initialFiles={droppedFiles}
              onClose={() => {
                setShowAddClothes(false);
                setDroppedFiles(undefined);
              }}
              onAdded={afterAdding}
            />,
            document.body
          )}

        {justAdded !== null && (
          <div role="status" className="mb-6 flex flex-col gap-3 rounded-[18px] bg-white px-5 py-4 shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)] sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2.5 text-[13.5px] text-[#121821]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#121821] text-white">
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
              {justAdded === 1 ? "Added to your closet." : `${justAdded} pieces added to your closet.`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setShowAddClothes(true)} className={btnSecondary}>
                Add Another Item
              </button>
              <button onClick={() => setJustAdded(null)} aria-label="Dismiss" className="px-2 text-[12px] font-semibold text-[#5d6874] hover:text-[#121821]">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6">
            <ErrorNote message={error} />
          </div>
        )}

        {loading ? (
          <InlineLoading label="Loading your closet…" />
        ) : loadError ? (
          <div className="flex flex-col items-start gap-3">
            <ErrorNote message="Couldn't load your closet. Check your connection and try again." />
            <button onClick={() => { setLoading(true); loadItems(); }} className={btnSecondary}>
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Your closet is empty"
            body="Add a photo of one piece, or several laid out together. Virm labels each item, and you can edit before saving."
            action={
              <button onClick={() => setShowAddClothes(true)} className={btnPrimary}>
                <PlusIcon className="h-4 w-4" /> Add Your First Item
              </button>
            }
          />
        ) : (
          <>
            <div className="mb-3 flex items-center gap-3 text-[12px] text-[#5d6874]">
              <span>
                {filteredItems.length} {filteredItems.length === 1 ? "piece" : "pieces"}
                {editMode && " · tap a piece to change it, ✕ to remove it"}
              </span>
              {filtersActive && (
                <button onClick={clearFilters} className={btnText}>
                  Clear filters
                </button>
              )}
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                aria-label="Filters"
                title="Filters"
                data-tip="closet-filter"
                className={`relative ml-auto flex h-9 w-9 items-center justify-center rounded-full ${filtersOpen ? "bg-[#121821] text-white" : "text-[#26313a] hover:bg-black/5"}`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
                  <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
                  <circle cx="16" cy="7" r="2" />
                  <circle cx="10" cy="17" r="2" />
                </svg>
                {filtersActive && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#c23a2c]" />}
              </button>
            </div>

            {filtersOpen && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="f-color">Color</label>
                <select id="f-color" value={colorFilter} onChange={(e) => setColorFilter(e.target.value)} className={selectClass}>
                  <option value="">Any color</option>
                  {colors.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="sr-only" htmlFor="f-season">Season</label>
                <select id="f-season" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} className={selectClass}>
                  <option value="">Any season</option>
                  {SEASONS.filter((s) => s !== "all-season").map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <label className="sr-only" htmlFor="f-formality">Occasion</label>
                <select id="f-formality" value={formalityFilter} onChange={(e) => setFormalityFilter(e.target.value)} className={selectClass}>
                  <option value="">Any occasion</option>
                  {FORMALITIES.map((f) => <option key={f} value={f}>{FORMALITY_LABELS[f] ?? f}</option>)}
                </select>
                <label className="sr-only" htmlFor="f-layer">Layer</label>
                <select id="f-layer" value={layerFilter} onChange={(e) => setLayerFilter(e.target.value)} className={selectClass}>
                  <option value="">Any layer</option>
                  {LAYERING_ROLES.map((r) => <option key={r} value={r}>{LAYER_LABELS[r]}</option>)}
                </select>
                <label className="sr-only" htmlFor="f-search">Search</label>
                <input
                  id="f-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your closet"
                  className={`${selectClass} min-w-[180px] flex-1 normal-case sm:max-w-[260px]`}
                />
              </div>
            )}

            {filteredItems.length === 0 ? (
              <EmptyState
                title="Nothing matches"
                body="Nothing matches these filters."
                action={
                  <button onClick={clearFilters} className={btnSecondary}>
                    Show all pieces
                  </button>
                }
              />
            ) : (
              <div className="closet-shelf rounded-[20px] px-4 py-3 sm:rounded-[24px] sm:px-6 sm:py-4">
                {SHELVES.map(({ value, label }) => {
                  const row = filteredItems.filter((i) => i.category === value);
                  if (row.length === 0) return null;
                  return (
                    <ShelfRow key={value} label={label} count={row.length}>
                        {row.map((item) => {
                          const cut = isCutout(item);
                          const on = wornIds.has(item.id);
                          return (
                            <li key={item.id} className="relative shrink-0 snap-start">
                              {/* One tap wears it (or takes it off); ⓘ opens its details. In Edit, a tap opens the details. */}
                              <button
                                onClick={() => (editMode ? setViewingId(item.id) : onWear(item))}
                                draggable={!editMode}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData(PIECE_DRAG_TYPE, item.id);
                                  e.dataTransfer.effectAllowed = "copy";
                                }}
                                aria-pressed={editMode ? undefined : on}
                                aria-label={`${editMode ? "Change" : on ? "Take off" : "Wear"} ${item.description}`}
                                className={`group block ${editMode ? "animate-[wiggle_0.6s_ease-in-out_infinite]" : ""}`}
                              >
                                <span
                                  className={`relative block h-[88px] w-[68px] sm:h-[112px] sm:w-[86px] ${cut ? "" : "overflow-hidden rounded-[10px]"} ${on && !editMode ? "rounded-[10px] ring-2 ring-[#121821] ring-offset-1" : ""}`}
                                >
                                  <Image
                                    src={item.imageUrl}
                                    alt=""
                                    fill
                                    unoptimized
                                    onError={retryImage}
                                    className={`transition-transform duration-300 group-hover:scale-[1.04] ${
                                      cut ? "object-contain drop-shadow-[0_6px_10px_rgba(18,24,33,0.14)]" : "object-cover"
                                    }`}
                                  />
                                  {working.has(item.id) && (
                                    <span className="absolute inset-x-0 bottom-1 mx-auto w-fit rounded-full bg-white/90 px-2 py-0.5 text-[9.5px] font-semibold text-[#121821]">
                                      Removing background…
                                    </span>
                                  )}
                                </span>
                              </button>
                              {!editMode && (
                                <button
                                  onClick={() => setViewingId(item.id)}
                                  aria-label={`Details of ${item.description}`}
                                  className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[10.5px] font-bold italic text-[#121821] shadow-sm"
                                >
                                  i
                                </button>
                              )}
                              {on && !editMode && (
                                <span aria-hidden className="pointer-events-none absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#121821] text-white">
                                  <CheckIcon className="h-2.5 w-2.5" />
                                </span>
                              )}
                              {editMode && (
                                <button
                                  onClick={() => handleDelete(item)}
                                  aria-label={`Remove ${item.description}`}
                                  className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#121821] text-[11px] text-white shadow"
                                >
                                  ✕
                                </button>
                              )}
                            </li>
                          );
                        })}
                    </ShelfRow>
                  );
                })}
              </div>
            )}
          </>
        )}


      {viewing &&
        createPortal(
        <ItemDetail
          item={viewing}
          aiEnabled={aiEnabled}
          reanalyzing={reanalyzingId === viewing.id}
          onReanalyze={() => handleReanalyze(viewing.id)}
          onClose={() => setViewingId(null)}
          onSave={(form) => saveEdit(viewing.id, form)}
          onDelete={() => handleDelete(viewing)}
          startEditing={editMode}
          backgroundWorking={working.has(viewing.id)}
          onToggleBackground={() => toggleBackground(viewing)}
          onItemChange={replaceItem}
          worn={wornIds.has(viewing.id)}
          onWear={() => {
            onWear(viewing);
            setViewingId(null);
          }}
        />,
          document.body
        )}
    </section>
  );
}

function ItemDetail({
  item,
  aiEnabled,
  reanalyzing,
  onReanalyze,
  onClose,
  onSave,
  onDelete,
  startEditing,
  backgroundWorking,
  onToggleBackground,
  onItemChange,
  worn,
  onWear,
}: {
  item: ClothingItem;
  aiEnabled: boolean;
  reanalyzing: boolean;
  onReanalyze: () => void;
  onClose: () => void;
  onSave: (form: EditForm) => Promise<boolean>;
  onDelete: () => void;
  startEditing: boolean;
  backgroundWorking: boolean;
  onToggleBackground: () => void;
  onItemChange: (item: ClothingItem) => void;
  /** It's on the mirror now. */
  worn: boolean;
  /** Puts it on the mirror (or takes it off). */
  onWear: () => void;
}) {
  const [editing, setEditing] = useState(startEditing);
  // AI enhancement, for everyone: each month as many new ones as the plan's clothing photos (the server counts and
  // checks). Once they're used up, the free background switch comes back. The ✦ switch never costs anything.
  const [enhanceLeft, setEnhanceLeft] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    let gone = false;
    fetch("/api/me/enhance-allowance", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { left: number | null }).left : undefined))
      .then((left) => !gone && setEnhanceLeft(left))
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, []);
  const outOfEnhancements = enhanceLeft === 0;
  // The AI's safety check turned this picture down: offer the free background switch instead.
  const [declined, setDeclined] = useState(false);
  const enhancedShown = Boolean(item.enhancedUrl && item.imageUrl === item.enhancedUrl);
  const [enhancing, setEnhancing] = useState<"working" | "flattening" | "saving" | "switching" | null>(null);
  // Which kind the preview is: Enhance (tidy) or Lay it flat (a folded piece unfolded by AI).
  const [previewMode, setPreviewMode] = useState<"tidy" | "flat">("tidy");
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [preview, setPreview] = useState<EnhancePreview | null>(null);
  const plainPicture = enhancedShown ? (item.plainUrl ?? item.imageUrl) : item.imageUrl;
  // The preview's picture is let go when it's replaced or the window closes.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  async function enhance(mode: "tidy" | "flat" = "tidy") {
    // The background remover loads while the AI works, so it's ready the moment the picture arrives.
    warmUpCutout();
    setEnhanceError(null);
    setEnhancing(mode === "flat" ? "flattening" : "working");
    try {
      setPreviewMode(mode);
      const made = await previewEnhancement(item, mode);
      setPreview(made);
      if (!made.reused) setEnhanceLeft((left) => (typeof left === "number" ? Math.max(0, left - 1) : left));
    } catch (err) {
      if ((err as { code?: string }).code === "limit") setEnhanceLeft(0);
      if ((err as { code?: string }).code === "declined") setDeclined(true);
      setEnhanceError(err instanceof Error ? err.message : "Couldn't enhance this picture. Your picture is unchanged.");
    } finally {
      setEnhancing(null);
    }
  }

  async function useEnhanced() {
    if (!preview) return;
    setEnhancing("saving");
    setEnhanceError(null);
    try {
      onItemChange(await keepEnhancement(item, preview.png));
      setPreview(null);
    } catch (err) {
      setEnhanceError(err instanceof Error ? err.message : "Couldn't save the enhanced picture.");
    } finally {
      setEnhancing(null);
    }
  }

  /** ✦: the enhanced picture or the piece's own (no AI, no cost). */
  async function switchPicture() {
    setEnhancing("switching");
    setEnhanceError(null);
    try {
      onItemChange(await showPicture(item, enhancedShown ? "original" : "enhanced"));
    } catch (err) {
      setEnhanceError(err instanceof Error ? err.message : "Couldn't switch the picture.");
    } finally {
      setEnhancing(null);
    }
  }
  const cut = isCutout(item);
  const [form, setForm] = useState<EditForm>(() => toEditForm(item));
  const [saving, setSaving] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const itemDialog = useRef<HTMLDivElement | null>(null);
  useDialog(itemDialog, onClose, { escape: false });
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) setEditing(false);
  }

  const details: [string, string][] = [
    ...(item.brand ? ([["Brand", item.brand]] as [string, string][]) : []),
    ["Category", item.category],
    ["Layer", layerLabel(item.layeringRole)],
    ["Color", item.color],
    ["Pattern", item.pattern],
    ["Material", item.material],
    ["Occasion", FORMALITY_LABELS[item.formality] ?? item.formality],
    ["Season", item.season],
  ];

  return (
    <div
        ref={itemDialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#172027]/70 sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92dvh] w-full max-w-[860px] overflow-y-auto bg-[#f8fafb] sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="closet-shelf relative aspect-square sm:aspect-auto sm:min-h-[460px]">
          {preview ? (
            // Before / after side by side, whole pictures, so logos and prints can be checked.
            <div className="absolute inset-0 grid grid-cols-2 gap-2 p-3 pb-[132px]">
              {[
                ["Original", plainPicture],
                ["AI enhanced", preview.url],
              ].map(([label, src]) => (
                <figure key={label} className="relative min-h-0 overflow-hidden rounded-[14px] bg-white/70">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the person's own pictures */}
                  <img src={src} alt={`${label}: ${item.description}`} className="absolute inset-0 h-full w-full object-contain p-2" />
                  <figcaption className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[1px] text-[#121821]">{label}</figcaption>
                </figure>
              ))}
              <div className="absolute inset-x-3 bottom-3 rounded-[16px] bg-white/95 p-3 shadow-[0_4px_14px_rgba(18,24,33,0.12)]">
                {preview.practice && <p className="mb-1 text-[11.5px] text-[#5d6874]">Practice: nothing was sent, so this is your picture.</p>}
                {previewMode === "flat" && !preview.practice && (
                  <p className="mb-1 text-[11.5px] text-[#5d6874]">Check the sleeves, length and prints.</p>
                )}
                {preview.drift !== null && preview.drift >= DRIFT_WARNING && (
                  <p role="alert" className="mb-1 text-[12px] font-semibold text-[#a03a2f]">The colors look different from your picture.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button onClick={useEnhanced} disabled={enhancing !== null} className={`${btnPrimary} min-h-[40px] flex-1`}>
                    {enhancing === "saving" ? "Saving…" : "Use it"}
                  </button>
                  <button onClick={() => setPreview(null)} disabled={enhancing !== null} className={`${btnSecondary} min-h-[40px] flex-1`}>
                    Keep original
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <Image src={item.imageUrl} alt={item.description} fill unoptimized onError={retryImage} className={`object-contain ${cut ? "p-8" : ""}`} />
              {/* ✦: the AI-enhanced picture or the piece's own. A plain switch: no AI, no cost. */}
              {item.enhancedUrl && item.plainUrl && (
                <button
                  onClick={switchPicture}
                  disabled={enhancing !== null}
                  aria-pressed={enhancedShown}
                  aria-label="AI-enhanced picture"
                  title={enhancedShown ? "Show your original picture" : "Show the AI-enhanced picture"}
                  className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full shadow-[0_4px_14px_rgba(18,24,33,0.14)] disabled:opacity-60 ${
                    enhancedShown ? "bg-[#121821] text-white" : "bg-white/95 text-[#121821]"
                  }`}
                >
                  <SparkleIcon className="h-[18px] w-[18px]" />
                </button>
              )}
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-2">
                {/* Remove background / Keep background: the original photo is always kept. Changes apply to the piece's own picture. */}
                {/* Enhance with AI does it all (lays the piece flat and removes the background), so it's the one button
                    until the piece is enhanced, or until this month's enhancements are used up. */}
                {!enhancedShown && (Boolean(item.enhancedUrl) || outOfEnhancements || declined) && (
                  <button
                    onClick={onToggleBackground}
                    disabled={backgroundWorking || enhancing !== null}
                    className="whitespace-nowrap rounded-full bg-white/95 px-4 py-2 text-[12px] font-semibold text-[#121821] shadow-[0_4px_14px_rgba(18,24,33,0.12)] disabled:opacity-70"
                  >
                    {backgroundWorking ? (cut ? "Restoring…" : "Removing background…") : cut ? "Keep background" : "Remove background"}
                  </button>
                )}
                {!item.enhancedUrl && !outOfEnhancements && (
                  // One button: the AI lays the piece out neatly flat (straight sleeves, no wrinkles, no hands); the original
                  // stays, and you choose.
                  <button
                    onClick={() => enhance("flat")}
                    disabled={enhancing !== null || backgroundWorking}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#121821] px-4 py-2 text-[12px] font-semibold text-white shadow-[0_4px_14px_rgba(18,24,33,0.18)] disabled:opacity-70"
                  >
                    <SparkleIcon className="h-3.5 w-3.5" /> {enhancing !== null && enhancing !== "saving" && enhancing !== "switching" ? "Enhancing… about a minute" : typeof enhanceLeft === "number" && enhanceLeft <= 5 ? `Enhance with AI · ${enhanceLeft} left` : "Enhance with AI"}
                  </button>
                )}
              </div>
            </>
          )}
          {enhanceError && (
            <p role="alert" className="absolute inset-x-3 top-3 rounded-[12px] bg-white/95 px-3 py-2 text-[12px] text-[#a03a2f] shadow-[0_4px_14px_rgba(18,24,33,0.12)]">
              {enhanceError}
            </p>
          )}
        </div>
        <div className="flex flex-col p-6 sm:p-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 id="item-title" className="font-display text-[30px] font-normal leading-[1.1] text-[#121821]">
              {item.description}
            </h2>
            <button ref={closeRef} onClick={onClose} className="shrink-0 text-[12px] font-semibold text-[#4f5b66] hover:text-[#121821]">
              Close
            </button>
          </div>

          {editing ? (
            <div className="grid gap-3">
              <label className="text-[11px] font-semibold text-[#4f5b66]">
                Name
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${fieldClass} mt-1`} />
                <span className="mt-1 block font-normal text-[#5d6874]">Try-ons follow the name, so include the fabric (e.g. &ldquo;linen shirt&rdquo;).</span>
              </label>
              <label className="text-[11px] font-semibold text-[#4f5b66]">
                Brand
                <input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="Optional"
                  maxLength={60}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] font-semibold text-[#4f5b66]">
                  Category
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${fieldClass} mt-1 capitalize`}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-[#4f5b66]">
                  Layer
                  <select value={form.layeringRole} onChange={(e) => setForm({ ...form, layeringRole: e.target.value })} className={`${fieldClass} mt-1`}>
                    {LAYERING_ROLES.map((r) => <option key={r} value={r}>{LAYER_LABELS[r]}</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-[#4f5b66]">
                  Color
                  <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={`${fieldClass} mt-1`} />
                </label>
                <label className="text-[11px] font-semibold text-[#4f5b66]">
                  Pattern
                  <input value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} className={`${fieldClass} mt-1`} />
                </label>
                <label className="text-[11px] font-semibold text-[#4f5b66]">
                  Material
                  <input
                    value={form.material}
                    onChange={(e) => setForm({ ...form, material: e.target.value })}
                    placeholder="e.g. linen, wool knit, silk"
                    className={`${fieldClass} mt-1`}
                  />
                </label>
                <label className="text-[11px] font-semibold text-[#4f5b66]">
                  Occasion
                  <select value={form.formality} onChange={(e) => setForm({ ...form, formality: e.target.value })} className={`${fieldClass} mt-1`}>
                    {FORMALITIES.map((f) => <option key={f} value={f}>{FORMALITY_LABELS[f] ?? f}</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-[#4f5b66]">
                  Season
                  <select value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} className={`${fieldClass} mt-1 capitalize`}>
                    {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-2 flex gap-3">
                <button onClick={save} disabled={saving} className={`${btnPrimary} flex-1`}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button onClick={() => { setForm(toEditForm(item)); setEditing(false); }} className={btnSecondary}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-black/[0.07] pt-5">
                {details.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] font-bold uppercase tracking-[1.8px] text-[#5d6874]">{label}</dt>
                    <dd className={`mt-0.5 text-[13px] text-[#121821] ${label === "Brand" ? "" : "capitalize"}`}>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[12px] text-[#5d6874]">
                Material or color not quite right? Photos can be misleading.{" "}
                <button onClick={() => setEditing(true)} className="font-semibold text-[#121821] underline underline-offset-4">
                  Change it
                </button>
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
                <button onClick={onWear} className={btnPrimary}>
                  <SparkleIcon className="h-4 w-4" /> {worn ? "Take it off" : "Wear it"}
                </button>
                <button onClick={() => setEditing(true)} className={btnSecondary}>
                  Edit Details
                </button>
                {aiEnabled && isPlaceholder(item) && (
                  <button onClick={onReanalyze} disabled={reanalyzing} className={btnSecondary}>
                    {reanalyzing ? "Analyzing…" : "Re-analyze with AI"}
                  </button>
                )}
                <button onClick={onDelete} className="min-h-[44px] px-2 text-[12.5px] font-semibold text-[#a03a2f] hover:underline">
                  Remove Item
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
