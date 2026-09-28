"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

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

const isPlaceholder = (item: ClothingItem) => item.description.startsWith("Demo item");

export default function ClosetPage() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

  async function loadItems() {
    const res = await fetch("/api/closet/items");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/closet/items")
      .then((res) => res.json())
      .then((data) => {
        if (ignore) return;
        setItems(data.items ?? []);
        setLoading(false);
      });
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setAiEnabled(Boolean(data.aiEnabled));
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of files) formData.append("images", file);

      const res = await fetch("/api/closet/items", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      await loadItems();
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Re-analyze failed");
      setItems((prev) => prev.map((item) => (item.id === id ? data.item : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-analyze failed");
    } finally {
      setReanalyzingId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your closet</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Upload photos of your clothes — AI will tag each one automatically.
          </p>
        </div>
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
      </div>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">No items yet — upload your first photo to get started.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950"
            >
              <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-900">
                <Image src={item.imageUrl} alt={item.description} fill className="object-cover" unoptimized />
              </div>
              <div className="p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{item.category}</p>
                <p className="text-sm">{item.description}</p>
                {aiEnabled && isPlaceholder(item) && (
                  <button
                    onClick={() => handleReanalyze(item.id)}
                    disabled={reanalyzingId === item.id}
                    className="mt-2 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
                  >
                    {reanalyzingId === item.id ? "Analyzing…" : "Re-analyze with AI"}
                  </button>
                )}
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
