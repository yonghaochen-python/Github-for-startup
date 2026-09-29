"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

type PreviewItem = { imageUrl: string; description: string };
type Preview = { isMock: boolean; selfieUrl: string; items: PreviewItem[] };

export default function TryOnPage() {
  const params = useParams<{ id: string }>();
  const [hasSelfie, setHasSelfie] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview() {
    const res = await fetch(`/api/outfits/${params.id}/try-on`);
    if (res.ok) {
      const data = (await res.json()) as { preview: Preview };
      setPreview(data.preview);
      setHasSelfie(true);
    } else {
      setHasSelfie(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    fetch(`/api/outfits/${params.id}/try-on`).then(async (res) => {
      if (ignore) return;
      if (res.ok) {
        const data = (await res.json()) as { preview: Preview };
        setPreview(data.preview);
        setHasSelfie(true);
      } else {
        setHasSelfie(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, [params.id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/profile/photo", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
      <Link href={`/outfits/${params.id}`} className="mb-4 inline-block text-sm text-zinc-500 hover:underline">
        ← Back to outfit
      </Link>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Try it on</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">See this outfit on you.</p>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {hasSelfie === null ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : !hasSelfie ? (
        <div className="rounded-xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Upload a photo of yourself to see how this outfit looks on you.
          </p>
          <label className="inline-block cursor-pointer rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
            {uploading ? "Uploading…" : "Upload a photo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        </div>
      ) : (
        preview && (
          <div>
            <div className="relative mb-4 aspect-[3/4] w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
              <Image src={preview.selfieUrl} alt="You" fill className="object-cover" unoptimized />
              {preview.isMock && (
                <div className="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-2 text-center text-xs font-medium text-white">
                  Preview only — full AI try-on coming soon
                </div>
              )}
            </div>

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Outfit pieces</p>
            <div className="mb-6 flex gap-3">
              {preview.items.map((item, i) => (
                <div key={i} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                  <Image src={item.imageUrl} alt={item.description} fill className="object-cover" unoptimized />
                </div>
              ))}
            </div>

            <label className="inline-block cursor-pointer text-sm text-zinc-500 hover:underline">
              {uploading ? "Uploading…" : "Replace photo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={handleUpload}
              />
            </label>
          </div>
        )
      )}
    </main>
  );
}
