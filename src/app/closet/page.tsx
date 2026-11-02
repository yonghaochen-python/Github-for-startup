"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CATEGORIES, FORMALITIES, SEASONS, LAYERING_ROLES } from "@/lib/clothingTaxonomy";
import { LAYER_LABELS } from "@/lib/layering";
import { AddClothesModal } from "@/components/AddClothesModal";
import { useToast } from "@/components/Toast";
import { InlineLoading } from "@/components/InlineLoading";
import { CheckIcon, PlusIcon, SparkleIcon } from "@/components/Icons";
import { EmptyState, ErrorNote, PageHeader, PageShell, btnPrimary, btnSecondary, btnText } from "@/components/ui";
import { Tips, type Tip } from "@/components/Tips";
import { keepItemBackground, removeBackgroundsAfterAdding, removeItemBackground } from "@/lib/cutoutClient";

const CLOSET_TIPS: Tip[] = [
  { target: '[data-tip="closet-add"]', text: "Add a photo of one piece, or a few laid out together." },
  { target: '[data-tip="closet-filter"]', text: "Slide each row to see everything, or filter by color and season." },
  { target: '.site-nav a[href="/studio"], .site-tabbar a[href="/studio"]', text: "Ready? Style an outfit in the Studio." },
];

type ClothingItem = {
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

export default function ClosetPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
  const [showAddClothes, setShowAddClothes] = useState(searchParams.get("add") === "1");
  const [justAdded, setJustAdded] = useState<number | null>(null);

  async function loadItems() {
    try {
      const res = await fetch("/api/closet/items");
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

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of files) formData.append("images", file);
      const res = await fetch("/api/closet/items", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as { error?: string; warning?: string; items?: ClothingItem[] };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      afterAdding(data.items?.length ?? files.length, data.items ?? []);
      if (data.warning) setError(data.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(item: ClothingItem) {
    if (!window.confirm(`Remove "${item.description}" from your closet? Outfits that use it will lose this piece.`)) return;
    const res = await fetch(`/api/closet/items/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't remove that item. Please try again.");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setViewingId(null);
    showToast("Removed from your closet");
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

  return (
    <main className="flex-1 pb-16">
      <Tips id="closet" tips={CLOSET_TIPS} />
      <PageShell>
        <PageHeader
                    title="My Closet"
          actions={
            <>
              <button onClick={() => setShowAddClothes(true)} data-tip="closet-add" className={btnPrimary}>
                <PlusIcon className="h-4 w-4" /> Add
              </button>
              {items.length > 0 && (
                <button onClick={() => setEditMode((v) => !v)} aria-pressed={editMode} className={btnSecondary}>
                  {editMode ? "Done" : "Edit"}
                </button>
              )}
            </>
          }
        />

        {showAddClothes && <AddClothesModal onClose={() => setShowAddClothes(false)} onAdded={afterAdding} />}

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
              <Link href="/studio" className={btnPrimary}>
                <SparkleIcon className="h-4 w-4" /> Start Styling
              </Link>
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
            <ErrorNote message="Couldn't load your closet. Please try again." />
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
              <div className="closet-shelf -mx-5 px-4 py-4 sm:mx-0 sm:rounded-[24px] sm:px-6 sm:py-5">
                {SHELVES.map(({ value, label }) => {
                  const row = filteredItems.filter((i) => i.category === value);
                  if (row.length === 0) return null;
                  return (
                    <section key={value} aria-label={label} className="py-2.5">
                      <h2 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[1.8px] opacity-70">
                        {label} <span className="ml-1 font-normal">{row.length}</span>
                      </h2>
                      {/* Slides left and right; pieces snap into place. */}
                      <ul className="closet-row -mx-4 flex snap-x snap-mandatory items-end gap-1.5 overflow-x-auto scroll-px-4 px-4 pb-1 pt-2 sm:-mx-6 sm:scroll-px-6 sm:px-6">
                        {row.map((item) => {
                          const cut = isCutout(item);
                          return (
                            <li key={item.id} className="relative shrink-0 snap-start">
                              <button
                                onClick={() => setViewingId(item.id)}
                                aria-label={`${editMode ? "Change" : "View"} ${item.description}`}
                                className={`group block ${editMode ? "animate-[wiggle_0.6s_ease-in-out_infinite]" : ""}`}
                              >
                                <span
                                  className={`relative block h-[124px] w-[96px] sm:h-[150px] sm:w-[116px] ${cut ? "" : "overflow-hidden rounded-[10px]"}`}
                                >
                                  <Image
                                    src={item.imageUrl}
                                    alt=""
                                    fill
                                    unoptimized
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
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </PageShell>

      {/* Hidden quick upload: one photo = one item, analyzed automatically. */}
      <QuickUpload uploading={uploading} onChange={handleFiles} visible={!loading && !loadError} />

      {viewing && (
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
        />
      )}
    </main>
  );
}

function QuickUpload({
  uploading,
  onChange,
  visible,
}: {
  uploading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <PageShell className="mt-10">
      <p className="text-[12px] text-[#5d6874]">
        Have separate photos of single items?{" "}
        <label className="cursor-pointer font-semibold text-[#121821] underline underline-offset-4">
          {uploading ? "Uploading and labeling…" : "Upload them one per item"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={onChange}
          />
        </label>{" "}
        and each photo becomes its own closet item.
      </p>
    </PageShell>
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
}) {
  const [editing, setEditing] = useState(startEditing);
  const cut = isCutout(item);
  const [form, setForm] = useState<EditForm>(() => toEditForm(item));
  const [saving, setSaving] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

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
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#172027]/70 sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92dvh] w-full max-w-[860px] overflow-y-auto bg-[#f8fafb] sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="closet-shelf relative aspect-square sm:aspect-auto sm:min-h-[460px]">
          <Image src={item.imageUrl} alt={item.description} fill unoptimized className={`object-contain ${cut ? "p-8" : ""}`} />
          {/* Remove background / Keep background: the original photo is always kept. */}
          <button
            onClick={onToggleBackground}
            disabled={backgroundWorking}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-4 py-2 text-[12px] font-semibold text-[#121821] shadow-[0_4px_14px_rgba(18,24,33,0.12)] disabled:opacity-70"
          >
            {backgroundWorking ? (cut ? "Restoring…" : "Removing background…") : cut ? "Keep background" : "Remove background"}
          </button>
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
                  <input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} className={`${fieldClass} mt-1`} />
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
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
                <Link href="/studio" className={btnPrimary}>
                  <SparkleIcon className="h-4 w-4" /> Style an Outfit
                </Link>
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
