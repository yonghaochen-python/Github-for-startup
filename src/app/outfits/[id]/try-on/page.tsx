"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LAYER_LABELS, type LayeringRole } from "@/lib/layering";
import { LoadingScreen } from "@/components/LoadingScreen";
import { afterMinDelay } from "@/lib/minDelay";

type PreviewItem = { imageUrl: string; description: string; layeringRole: LayeringRole };
type PreviewLayer = { role: LayeringRole; items: PreviewItem[] };
type Preview = { isMock: boolean; selfieUrl: string; layers: PreviewLayer[] };

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
    const startedAt = Date.now();
    fetch(`/api/outfits/${params.id}/try-on`).then(async (res) => {
      if (ignore) return;
      if (res.ok) {
        const data = (await res.json()) as { preview: Preview };
        afterMinDelay(startedAt, 500, () => {
          if (ignore) return;
          setPreview(data.preview);
          setHasSelfie(true);
        });
      } else {
        afterMinDelay(startedAt, 500, () => {
          if (!ignore) setHasSelfie(false);
        });
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
      <Link href={`/outfits/${params.id}`} className="mb-7 inline-flex items-center gap-2.5 text-xs font-semibold text-[#747d71]">
        <span className="text-lg leading-none">←</span> Back to outfit
      </Link>

      <p className="text-[10px] font-bold uppercase tracking-[2.2px] text-[#7e888e]">Virtual try-on</p>
      <h1 className="mt-2 mb-1 font-display text-3xl font-normal text-[#222a2f]">Try it on</h1>
      <p className="mb-7 text-sm text-[#8b9087]">See this outfit on you.</p>

      {error && <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {hasSelfie === null ? (
        <LoadingScreen />
      ) : !hasSelfie ? (
        <div className="border border-dashed border-[#bfcbbc] bg-[#f0f2ed] p-8 text-center">
          <p className="mb-4 text-sm text-[#72826d]">Upload a photo of yourself to see how this outfit looks on you.</p>
          <label className="inline-block cursor-pointer rounded-[5px] bg-[#242b30] px-5 py-2.5 text-xs font-semibold text-white shadow-[inset_0_1px_0_#ffffff35,0_3px_10px_#222d3418] hover:bg-[#3b4750]">
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
            <div className="relative mb-4 aspect-[3/4] w-full overflow-hidden bg-[#faf9f7]">
              <Image src={preview.selfieUrl} alt="You" fill className="object-cover" unoptimized />
              {preview.isMock && (
                <div className="absolute inset-x-0 bottom-0 bg-[#242b30]/85 px-4 py-2 text-center text-xs font-medium text-white">
                  Preview only — full AI try-on coming soon
                </div>
              )}
            </div>

            <p className="mb-3 text-[10px] font-bold uppercase tracking-[1.3px] text-[#89949a]">
              Outfit pieces, outer layer to accessories
            </p>
            <div className="mb-6 flex flex-col gap-3">
              {preview.layers.map((layer) => (
                <div key={layer.role} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-medium text-[#89949a]">{LAYER_LABELS[layer.role]}</span>
                  <div className="flex gap-2">
                    {layer.items.map((item, i) => (
                      <div key={i} className="relative h-16 w-16 shrink-0 overflow-hidden bg-[#e2e6e7]">
                        <Image src={item.imageUrl} alt={item.description} fill className="object-cover" unoptimized />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <label className="inline-block cursor-pointer text-xs font-semibold text-[#303a30] hover:underline">
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
