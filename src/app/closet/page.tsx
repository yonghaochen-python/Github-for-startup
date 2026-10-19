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
};

type EditForm = Pick<
  ClothingItem,
  "category" | "layeringRole" | "color" | "pattern" | "material" | "formality" | "season" | "description"
>;

const CATEGORY_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All Items" },
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
const layerLabel = (role: string) => LAYER_LABELS[role as keyof typeof LAYER_LABELS] ?? role;

function toEditForm(item: ClothingItem): EditForm {
  const { category, layeringRole, color, pattern, material, formality, season, description } = item;
  return { category, layeringRole, color, pattern, material, formality, season, description };
}

const selectClass =
  "min-h-[40px] rounded-[5px] border border-[#cbd7dc] bg-white/80 px-3 pr-8 text-[12.5px] capitalize text-[#26313a] outline-none focus:border-[#1c2328]";
const fieldClass =
  "min-h-[40px] w-full rounded-[5px] border border-[#cbd7dc] bg-white px-3 py-2 text-[13px] text-[#1c2328] outline-none focus:border-[#1c2328]";

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
  const [category, setCategory] = useState("all");
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
      if (category !== "all" && item.category !== category) return false;
      if (colorFilter && item.color !== colorFilter) return false;
      if (seasonFilter && item.season !== seasonFilter && item.season !== "all-season") return false;
      if (formalityFilter && item.formality !== formalityFilter) return false;
      if (layerFilter && item.layeringRole !== layerFilter) return false;
      if (!q) return true;
      return [item.description, item.category, item.color, item.material, item.pattern].some((v) => v.toLowerCase().includes(q));
    });
  }, [items, category, colorFilter, seasonFilter, formalityFilter, layerFilter, search]);

  const colors = useMemo(() => [...new Set(items.map((i) => i.color).filter(Boolean))].sort(), [items]);
  const countFor = (c: string) => (c === "all" ? items.length : items.filter((i) => i.category === c).length);
  const filtersActive = Boolean(colorFilter || seasonFilter || formalityFilter || layerFilter || search);
  const viewing = items.find((i) => i.id === viewingId) ?? null;

  function clearFilters() {
    setColorFilter("");
    setSeasonFilter("");
    setFormalityFilter("");
    setLayerFilter("");
    setSearch("");
  }

  function afterAdding(count: number) {
    setLoading(true);
    loadItems();
    setJustAdded(count);
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
      const data = (await res.json().catch(() => ({}))) as { error?: string; warning?: string; items?: unknown[] };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      afterAdding(data.items?.length ?? files.length);
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
      <PageShell>
        <PageHeader
          label="My Closet"
          title="My Closet"
          description="Everything you own, organized in one place. Add photos of clothes you already own to build your digital wardrobe."
          actions={
            <>
              <button onClick={() => setShowAddClothes(true)} className={btnPrimary}>
                <PlusIcon className="h-4 w-4" /> Add Clothes
              </button>
              {items.length >= 2 && (
                <Link href="/outfits" className={btnSecondary}>
                  <SparkleIcon className="h-4 w-4" /> Create an Outfit
                </Link>
              )}
            </>
          }
        />

        {showAddClothes && <AddClothesModal onClose={() => setShowAddClothes(false)} onAdded={afterAdding} />}

        {justAdded !== null && (
          <div role="status" className="mb-6 flex flex-col gap-3 border border-[#cbd7dc] bg-white/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2.5 text-[13.5px] text-[#1c2328]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1c2328] text-white">
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
              {justAdded === 1 ? "Your piece is in your closet." : `${justAdded} pieces are in your closet.`} What next?
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setShowAddClothes(true)} className={btnSecondary}>
                Add Another Item
              </button>
              <Link href="/outfits" className={btnPrimary}>
                <SparkleIcon className="h-4 w-4" /> Start Styling
              </Link>
              <button onClick={() => setJustAdded(null)} aria-label="Dismiss" className="px-2 text-[12px] font-semibold text-[#7e888e] hover:text-[#1c2328]">
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
            body="Start with a photo of one piece, or several pieces laid out together — Virm finds each item and labels it for you. You can check and edit everything before it's added."
            action={
              <button onClick={() => setShowAddClothes(true)} className={btnPrimary}>
                <PlusIcon className="h-4 w-4" /> Add Your First Item
              </button>
            }
          />
        ) : (
          <>
            {/* Categories */}
            <div role="tablist" aria-label="Category" className="-mx-5 mb-4 flex gap-1 overflow-x-auto border-b border-[#dce2e4] px-5 sm:mx-0 sm:px-0">
              {CATEGORY_TABS.map((tab) => {
                const active = category === tab.value;
                return (
                  <button
                    key={tab.value}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategory(tab.value)}
                    className={`relative shrink-0 px-3.5 pb-3 pt-2 text-[13px] font-semibold ${
                      active ? "text-[#1c2328]" : "text-[#7b878d] hover:text-[#1c2328]"
                    }`}
                  >
                    {tab.label} <span className="ml-0.5 text-[11px] font-normal text-[#9aa5aa]">{countFor(tab.value)}</span>
                    {active && <span aria-hidden className="absolute inset-x-2 -bottom-px h-[2px] bg-[#1c2328]" />}
                  </button>
                );
              })}
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap items-center gap-2">
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
              {filtersActive && (
                <button onClick={clearFilters} className={btnText}>
                  Clear filters
                </button>
              )}
              <span className="ml-auto text-[12px] text-[#7e888e]">
                {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
              </span>
            </div>

            {filteredItems.length === 0 ? (
              <EmptyState
                title="Nothing matches"
                body="No pieces fit these filters. Try another category, clear the filters, or add something new."
                action={
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => { clearFilters(); setCategory("all"); }} className={btnSecondary}>Show all items</button>
                    <button onClick={() => setShowAddClothes(true)} className={btnPrimary}><PlusIcon className="h-4 w-4" /> Add Clothes</button>
                  </div>
                }
              />
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => setViewingId(item.id)}
                      className="group block w-full text-left"
                      aria-label={`View ${item.description}`}
                    >
                      <div className="relative aspect-square overflow-hidden border border-[#dce2e4] bg-[#f3f5f5] transition-colors group-hover:border-[#9fadb4]">
                        <Image
                          src={item.imageUrl}
                          alt=""
                          fill
                          unoptimized
                          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                        />
                      </div>
                      <p className="mt-2.5 truncate text-[13px] font-semibold text-[#1c2328]">{item.description}</p>
                      <p className="text-[11.5px] capitalize text-[#7e888e]">
                        {item.color} · {layerLabel(item.layeringRole)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
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
      <p className="text-[12px] text-[#7e888e]">
        Have separate photos of single items?{" "}
        <label className="cursor-pointer font-semibold text-[#1c2328] underline underline-offset-4">
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
}: {
  item: ClothingItem;
  aiEnabled: boolean;
  reanalyzing: boolean;
  onReanalyze: () => void;
  onClose: () => void;
  onSave: (form: EditForm) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
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
        <div className="relative aspect-square bg-[#f1f3f3] sm:aspect-auto sm:min-h-[460px]">
          <Image src={item.imageUrl} alt={item.description} fill unoptimized className="object-contain" />
        </div>
        <div className="flex flex-col p-6 sm:p-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 id="item-title" className="font-display text-[30px] font-normal leading-[1.1] text-[#1c2328]">
              {item.description}
            </h2>
            <button ref={closeRef} onClick={onClose} className="shrink-0 text-[12px] font-semibold text-[#5f6a70] hover:text-[#1c2328]">
              Close
            </button>
          </div>

          {editing ? (
            <div className="grid gap-3">
              <label className="text-[11px] font-semibold text-[#5f6a70]">
                Name
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${fieldClass} mt-1`} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] font-semibold text-[#5f6a70]">
                  Category
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${fieldClass} mt-1 capitalize`}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-[#5f6a70]">
                  Layer
                  <select value={form.layeringRole} onChange={(e) => setForm({ ...form, layeringRole: e.target.value })} className={`${fieldClass} mt-1`}>
                    {LAYERING_ROLES.map((r) => <option key={r} value={r}>{LAYER_LABELS[r]}</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-[#5f6a70]">
                  Color
                  <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={`${fieldClass} mt-1`} />
                </label>
                <label className="text-[11px] font-semibold text-[#5f6a70]">
                  Pattern
                  <input value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} className={`${fieldClass} mt-1`} />
                </label>
                <label className="text-[11px] font-semibold text-[#5f6a70]">
                  Material
                  <input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} className={`${fieldClass} mt-1`} />
                </label>
                <label className="text-[11px] font-semibold text-[#5f6a70]">
                  Occasion
                  <select value={form.formality} onChange={(e) => setForm({ ...form, formality: e.target.value })} className={`${fieldClass} mt-1`}>
                    {FORMALITIES.map((f) => <option key={f} value={f}>{FORMALITY_LABELS[f] ?? f}</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-[#5f6a70]">
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
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[#dce2e4] pt-5">
                {details.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] font-bold uppercase tracking-[1.8px] text-[#8b969c]">{label}</dt>
                    <dd className="mt-0.5 text-[13px] capitalize text-[#1c2328]">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
                <Link href="/outfits" className={btnPrimary}>
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
