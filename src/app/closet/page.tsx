"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CATEGORIES, FORMALITIES, SEASONS, LAYERING_ROLES } from "@/lib/clothingTaxonomy";
import { LAYER_LABELS } from "@/lib/layering";
import { AddClothesModal } from "@/components/AddClothesModal";
import { useToast } from "@/components/Toast";
import { InlineLoading } from "@/components/InlineLoading";

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

const isPlaceholder = (item: ClothingItem) => item.description.startsWith("Demo item");

function toEditForm(item: ClothingItem): EditForm {
  const { category, layeringRole, color, pattern, material, formality, season, description } = item;
  return { category, layeringRole, color, pattern, material, formality, season, description };
}

function FilterButton({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between px-3 py-2.5 text-left text-xs capitalize transition-colors ${
        selected ? "bg-[#2c353b] font-bold text-[#f9fbfb]" : "text-[#747a70] hover:bg-[#e9edef]"
      }`}
    >
      <span>{label}</span>
      <span className={`text-[10px] ${selected ? "text-[#bec8ce]" : "text-[#a6aca1]"}`}>{count}</span>
    </button>
  );
}

export default function ClosetPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [colorFilter, setColorFilter] = useState<string>("All colors");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showAddClothes, setShowAddClothes] = useState(false);

  async function loadItems() {
    try {
      const res = await fetch("/api/closet/items");
      if (res.status === 401) {
        setSignedOut(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load closet");
      const data = (await res.json()) as { items?: ClothingItem[] };
      setItems(data.items ?? []);
      setLoadError(false);
      setLoading(false);
    } catch {
      setLoadError(true);
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/closet/items")
      .then(async (res) => {
        if (ignore) return;
        if (res.status === 401) {
          setSignedOut(true);
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error("Failed to load closet");
        const data = (await res.json()) as { items?: ClothingItem[] };
        if (ignore) return;
        setItems(data.items ?? []);
        setLoadError(false);
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setLoadError(true);
        setLoading(false);
      });
    fetch("/api/config")
      .then((res) => res.json() as Promise<{ aiEnabled?: boolean }>)
      .then((data) => {
        if (!ignore) setAiEnabled(Boolean(data.aiEnabled));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && item.category !== filter && item.layeringRole !== filter) return false;
      if (colorFilter !== "All colors" && item.color !== colorFilter) return false;
      if (!q) return true;
      return [item.description, item.category, item.color, item.material, item.pattern].some((v) =>
        v.toLowerCase().includes(q)
      );
    });
  }, [items, filter, colorFilter, search]);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of files) formData.append("images", file);

      const res = await fetch("/api/closet/items", { method: "POST", body: formData });
      const data = (await res.json()) as { error?: string; warning?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      await loadItems();
      if (data.warning) setError(data.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    await fetch(`/api/closet/items/${id}`, { method: "DELETE" });
  }

  async function handleReanalyze(id: string) {
    setError(null);
    setReanalyzingId(id);
    try {
      const res = await fetch(`/api/closet/items/${id}/reanalyze`, { method: "POST" });
      const data = (await res.json()) as { error?: string; item?: ClothingItem };
      if (!res.ok || !data.item) throw new Error(data.error ?? "Re-analyze failed");
      const updated = data.item;
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-analyze failed");
    } finally {
      setReanalyzingId(null);
    }
  }

  function startEdit(item: ClothingItem) {
    setEditingId(item.id);
    setEditForm(toEditForm(item));
  }

  async function saveEdit(id: string) {
    if (!editForm) return;
    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(`/api/closet/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = (await res.json()) as { error?: string; item?: ClothingItem };
      if (!res.ok || !data.item) throw new Error(data.error ?? "Update failed");
      const updated = data.item;
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setEditingId(null);
      setEditForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingEdit(false);
    }
  }

  const categoryCount = (c: string) => (c === "all" ? items.length : items.filter((i) => i.category === c).length);
  const layerCount = (r: string) => items.filter((i) => i.layeringRole === r).length;
  const colors = useMemo(() => [...new Set(items.map((i) => i.color).filter(Boolean))], [items]);

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-14 sm:px-8">
      <div className="mb-14 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="font-display font-normal tracking-[-2px] text-[#222a2f]"
            style={{ fontSize: "clamp(40px, 5vw, 60px)" }}
          >
            My Closet<span className="text-[#829379]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[#8b9087]">Everything you own, in one place.</p>
        </div>
        {!signedOut && (
          <div className="flex shrink-0 items-center gap-5">
            <label className="btn-tactile cursor-pointer text-xs font-semibold text-[#303a30] hover:text-[#74836c]">
              {uploading ? "Uploading…" : "Upload one-by-one"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={handleFiles}
              />
            </label>
            <button
              onClick={() => setShowAddClothes(true)}
              className="btn-tactile rounded-[5px] bg-[#242b30] px-6 py-3 text-xs font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_4px_14px_#222d3422] hover:bg-[#3b4750]"
            >
              Add Clothes
            </button>
          </div>
        )}
      </div>

      {showAddClothes && (
        <AddClothesModal
          onClose={() => setShowAddClothes(false)}
          onAdded={() => {
            setLoading(true);
            loadItems();
            showToast("Your piece is now in your closet.");
          }}
        />
      )}

      {!signedOut && !loading && items.length >= 2 && (
        <Link
          href="/outfits"
          className="mb-6 flex items-center justify-between gap-3 rounded-[5px] border border-[#cbd3d7] px-4 py-3 text-[#333f46] hover:bg-[#e9edef]"
        >
          <span className="text-sm font-medium">Got what you need? Get outfit ideas from your closet.</span>
          <span aria-hidden className="text-sm">
            →
          </span>
        </Link>
      )}

      {error && <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <InlineLoading />
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-red-700">Couldn&apos;t load your closet. Please try again.</p>
          <button
            onClick={() => {
              setLoading(true);
              loadItems();
            }}
            className="rounded-[5px] border border-[#cbd3d7] px-4 py-1.5 text-sm font-medium text-[#333f46] hover:bg-[#e9edef]"
          >
            Try again
          </button>
        </div>
      ) : signedOut ? (
        <p className="text-sm text-[#89949a]">
          <Link href="/login" className="text-[#303a30] hover:underline">
            Log in
          </Link>{" "}
          to see your closet.
        </p>
      ) : items.length === 0 ? (
        <div
          className="flex min-h-[300px] flex-col items-start gap-6 border p-10 sm:flex-row sm:items-center"
          style={{
            borderColor: "#ffffff78",
            background: "linear-gradient(125deg, #fbfdfe 0%, #e2ebef 56%, #f0e5e8 80%, #eee8dc 100%)",
            boxShadow: "0 18px 40px rgba(16,24,32,0.08)",
          }}
        >
          <span
            className="flex h-[61px] w-[61px] shrink-0 items-center justify-center rounded-full border text-2xl text-[#53636b]"
            style={{ borderColor: "#c6d0d4", background: "#fff" }}
            aria-hidden
          >
            👔
          </span>
          <div className="flex-1">
            <h2 className="font-display text-[33px] font-normal text-[#222a2f]">Your mirror is ready.</h2>
            <p className="mt-1 text-sm text-[#7e8b91]">Add your first piece to start building outfits.</p>
          </div>
          <button
            onClick={() => setShowAddClothes(true)}
            className="btn-tactile shrink-0 rounded-[5px] bg-[#242b30] px-6 py-3 text-xs font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_4px_14px_#222d3422] hover:bg-[#3b4750]"
          >
            Add first piece
          </button>
        </div>
      ) : (
        <div className="grid gap-14 lg:grid-cols-[190px_1fr]">
          {/* Category + layering-role sidebar on desktop (matches the real Figma source's two filter
              groups + color select + note), horizontal category-only row on mobile — the source itself
              hides the second filter group and note below 650px, so this mirrors that intentionally.
              Kept deliberately quiet (no borders/fills on its own) so the imagery stays the focus. */}
          <aside className="hidden pt-6 lg:block">
            <div className="mb-4 flex items-center justify-between text-[10px] font-bold tracking-[1.65px] text-[#9aa294]">
              FILTER BY
            </div>
            <div className="flex flex-col gap-0.5">
              {["all", ...CATEGORIES].map((c) => (
                <FilterButton key={c} label={c} count={categoryCount(c)} selected={filter === c} onClick={() => setFilter(c)} />
              ))}
            </div>

            <div className="my-7 h-px bg-[#e6e9e0]" />
            <div className="mb-4 text-[10px] font-bold tracking-[1.65px] text-[#9aa294]">LAYERING ROLE</div>
            <div className="flex flex-col gap-0.5">
              {LAYERING_ROLES.map((r) => (
                <FilterButton
                  key={r}
                  label={LAYER_LABELS[r]}
                  count={layerCount(r)}
                  selected={filter === r}
                  onClick={() => setFilter(r)}
                />
              ))}
            </div>

            <div className="my-7 h-px bg-[#e6e9e0]" />
            <div className="mb-4 text-[10px] font-bold tracking-[1.65px] text-[#9aa294]">COLOR</div>
            <select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              className="w-full border-0 border-b border-[#dde1d7] bg-transparent px-0 py-2 text-[11px] text-[#555e52] outline-none"
            >
              <option>All colors</option>
              {colors.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <div className="mt-16">
              <span aria-hidden className="text-base text-[#a9b4a1]">
                ✦
              </span>
              <p className="font-display mt-3 text-[19px] leading-snug text-[#79876f]">
                Great style begins with the pieces you already love.
              </p>
            </div>
          </aside>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {["all", ...CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`shrink-0 rounded-[5px] border px-3 py-1.5 text-xs font-medium capitalize ${
                  filter === c
                    ? "border-[#2c353b] bg-[#2c353b] text-white"
                    : "border-[#e0e4da] text-[#747a70] hover:bg-[#e9edef]"
                }`}
              >
                {c} <span className="text-[10px] opacity-70">{categoryCount(c)}</span>
              </button>
            ))}
          </div>

          <div>
            <div className="mb-5 flex h-11 items-center justify-between border-b border-[#dfe2d9]">
              <div className="flex items-center gap-3">
                <strong className="text-sm font-bold text-[#222a2f] capitalize">
                  {filter === "all" ? "All pieces" : (LAYER_LABELS[filter as keyof typeof LAYER_LABELS] ?? filter)}
                </strong>
                <span className="text-xs text-[#9ba198]">{filteredItems.length} items</span>
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your closet"
                className="w-40 border-0 border-b border-transparent bg-transparent text-right text-xs text-[#344047] outline-none placeholder:text-[#9ba198] focus:border-[#cbd3d7] sm:w-56"
              />
            </div>

            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center text-[#819079]">
                <span aria-hidden className="text-3xl">
                  👔
                </span>
                <h3 className="font-display text-[28px] font-normal text-[#30392f]">No pieces here yet.</h3>
                <p className="max-w-[280px] text-sm text-[#888f84]">
                  Add something to your closet or try a different filter.
                </p>
                <button
                  onClick={() => setShowAddClothes(true)}
                  className="btn-tactile mt-2 inline-flex items-center gap-3 rounded-[5px] border border-[#cfd5ca] px-5 py-2.5 text-xs font-semibold text-[#344033] hover:bg-[#eef0e9]"
                >
                  Add Clothes
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
                {filteredItems.map((item) => (
                  <div key={item.id} className={`group relative ${editingId === item.id ? "col-span-2" : ""}`}>
                    <div
                      className="relative overflow-hidden rounded-lg bg-[#e2e6e7] transition-shadow duration-300 group-hover:shadow-[0_16px_36px_rgba(20,28,32,0.14)]"
                      style={{ aspectRatio: "1 / 1.13" }}
                    >
                      <Image
                        src={item.imageUrl}
                        alt={item.description}
                        fill
                        className="object-cover saturate-[.78] transition-transform duration-500 ease-out group-hover:scale-[1.045]"
                        unoptimized
                      />
                    </div>

                    {editingId === item.id && editForm ? (
                      <div className="flex flex-col gap-3 border border-[#cbd7dc] bg-white p-4 mt-2">
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          placeholder="Description"
                          className="rounded-[4px] border border-[#cbd7dc] bg-white px-3 py-2 text-sm text-[#222a2f]"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            className="rounded-[4px] border border-[#cbd7dc] bg-white px-3 py-2 text-sm capitalize text-[#222a2f]"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editForm.layeringRole}
                            onChange={(e) => setEditForm({ ...editForm, layeringRole: e.target.value })}
                            className="rounded-[4px] border border-[#cbd7dc] bg-white px-3 py-2 text-sm text-[#222a2f]"
                          >
                            {LAYERING_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {LAYER_LABELS[r]}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={editForm.color}
                            onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                            placeholder="Color"
                            className="rounded-[4px] border border-[#cbd7dc] bg-white px-3 py-2 text-sm text-[#222a2f]"
                          />
                          <input
                            type="text"
                            value={editForm.material}
                            onChange={(e) => setEditForm({ ...editForm, material: e.target.value })}
                            placeholder="Material"
                            className="rounded-[4px] border border-[#cbd7dc] bg-white px-3 py-2 text-sm text-[#222a2f]"
                          />
                          <input
                            type="text"
                            value={editForm.pattern}
                            onChange={(e) => setEditForm({ ...editForm, pattern: e.target.value })}
                            placeholder="Pattern"
                            className="rounded-[4px] border border-[#cbd7dc] bg-white px-3 py-2 text-sm text-[#222a2f]"
                          />
                          <select
                            value={editForm.formality}
                            onChange={(e) => setEditForm({ ...editForm, formality: e.target.value })}
                            className="rounded-[4px] border border-[#cbd7dc] bg-white px-3 py-2 text-sm capitalize text-[#222a2f]"
                          >
                            {FORMALITIES.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editForm.season}
                            onChange={(e) => setEditForm({ ...editForm, season: e.target.value })}
                            className="rounded-[4px] border border-[#cbd7dc] bg-white px-3 py-2 text-sm capitalize text-[#222a2f]"
                          >
                            {SEASONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => saveEdit(item.id)}
                            disabled={savingEdit}
                            className="flex-1 rounded-[5px] bg-[#242b30] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {savingEdit ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditForm(null);
                            }}
                            className="rounded-[5px] border border-[#cbd3d7] px-4 py-2 text-sm text-[#333f46]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 pt-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-xs font-bold text-[#222a2f]">{item.description}</h3>
                          <p className="text-[10px] text-[#92988d]">
                            {item.category} <span className="mx-[3px]">·</span>{" "}
                            {LAYER_LABELS[item.layeringRole as keyof typeof LAYER_LABELS] ?? item.layeringRole}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-x-3">
                            <button
                              onClick={() => startEdit(item)}
                              className="text-[10px] font-semibold text-[#303a30] hover:underline"
                            >
                              Edit
                            </button>
                            {aiEnabled && isPlaceholder(item) && (
                              <button
                                onClick={() => handleReanalyze(item.id)}
                                disabled={reanalyzingId === item.id}
                                className="text-[10px] font-semibold text-[#344135] hover:underline disabled:opacity-50"
                              >
                                {reanalyzingId === item.id ? "Analyzing…" : "Re-analyze with AI"}
                              </button>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(item.id)}
                          aria-label="Remove item"
                          className="shrink-0 text-sm text-[#a8afa4] opacity-0 transition-opacity hover:text-[#222a2f] group-hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
