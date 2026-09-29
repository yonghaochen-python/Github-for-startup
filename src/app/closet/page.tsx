"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CATEGORIES, FORMALITIES, SEASONS } from "@/lib/clothingTaxonomy";

type ClothingItem = {
  id: string;
  imageUrl: string;
  category: string;
  color: string;
  pattern: string;
  material: string;
  formality: string;
  season: string;
  description: string;
};

type EditForm = Pick<ClothingItem, "category" | "color" | "pattern" | "material" | "formality" | "season" | "description">;

const isPlaceholder = (item: ClothingItem) => item.description.startsWith("Demo item");

function toEditForm(item: ClothingItem): EditForm {
  const { category, color, pattern, material, formality, season, description } = item;
  return { category, color, pattern, material, formality, season, description };
}

export default function ClosetPage() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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
        setItems(data.items ?? []);
        setLoadError(false);
        setLoading(false);
      })
      .catch(() => {
        if (!ignore) {
          setLoadError(true);
          setLoading(false);
        }
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
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (!q) return true;
      return [item.description, item.category, item.color, item.material, item.pattern].some((v) =>
        v.toLowerCase().includes(q)
      );
    });
  }, [items, categoryFilter, search]);

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

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your closet</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Upload photos of your clothes — AI will tag each one automatically.
          </p>
        </div>
        {!signedOut && (
          <label className="cursor-pointer rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
            {uploading ? "Uploading…" : "Upload photos"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={handleFiles}
            />
          </label>
        )}
      </div>

      {!signedOut && !loading && items.length >= 2 && (
        <Link
          href="/outfits"
          className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-black px-4 py-3 text-white hover:bg-zinc-800 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          <span className="text-sm font-medium">Got what you need? Get outfit ideas from your closet.</span>
          <span aria-hidden className="text-sm">→</span>
        </Link>
      )}

      {!signedOut && !loading && items.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {["all", ...CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                  categoryFilter === c
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-black/15 text-zinc-600 hover:border-black/40 dark:border-white/20 dark:text-zinc-400"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your closet"
            className="ml-auto w-full rounded-full border border-black/15 bg-white px-4 py-1.5 text-sm outline-none focus:border-black/40 sm:w-56 dark:border-white/20 dark:bg-zinc-950 dark:focus:border-white/40"
          />
        </div>
      )}

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-red-700 dark:text-red-400">Couldn&apos;t load your closet. Please try again.</p>
          <button
            onClick={() => {
              setLoading(true);
              loadItems();
            }}
            className="rounded-full border border-black/15 px-4 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Try again
          </button>
        </div>
      ) : signedOut ? (
        <p className="text-sm text-zinc-500">
          <Link href="/login" className="text-blue-600 hover:underline dark:text-blue-400">
            Log in
          </Link>{" "}
          to see your closet.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">No items yet — upload your first photo to get started.</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-zinc-500">No items match that filter.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`group relative overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950 ${
                editingId === item.id ? "col-span-2" : ""
              }`}
            >
              <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-900">
                <Image src={item.imageUrl} alt={item.description} fill className="object-cover" unoptimized />
              </div>

              {editingId === item.id && editForm ? (
                <div className="flex flex-col gap-3 p-4">
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Description"
                    className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-zinc-900"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm capitalize dark:border-white/20 dark:bg-zinc-900"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={editForm.color}
                      onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                      placeholder="Color"
                      className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-zinc-900"
                    />
                    <input
                      type="text"
                      value={editForm.material}
                      onChange={(e) => setEditForm({ ...editForm, material: e.target.value })}
                      placeholder="Material"
                      className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-zinc-900"
                    />
                    <input
                      type="text"
                      value={editForm.pattern}
                      onChange={(e) => setEditForm({ ...editForm, pattern: e.target.value })}
                      placeholder="Pattern"
                      className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-zinc-900"
                    />
                    <select
                      value={editForm.formality}
                      onChange={(e) => setEditForm({ ...editForm, formality: e.target.value })}
                      className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm capitalize dark:border-white/20 dark:bg-zinc-900"
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
                      className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm capitalize dark:border-white/20 dark:bg-zinc-900"
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
                      className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                    >
                      {savingEdit ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditForm(null);
                      }}
                      className="rounded-full border border-black/15 px-4 py-2 text-sm dark:border-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{item.category}</p>
                  <p className="text-sm">{item.description}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    <button
                      onClick={() => startEdit(item)}
                      className="text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-400"
                    >
                      Edit
                    </button>
                    {aiEnabled && isPlaceholder(item) && (
                      <button
                        onClick={() => handleReanalyze(item.id)}
                        disabled={reanalyzingId === item.id}
                        className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
                      >
                        {reanalyzingId === item.id ? "Analyzing…" : "Re-analyze with AI"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {editingId !== item.id && (
                <button
                  onClick={() => handleDelete(item.id)}
                  aria-label="Remove item"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-black/80"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
