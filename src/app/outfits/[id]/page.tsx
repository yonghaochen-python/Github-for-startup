"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LAYER_LABELS, orderedLayerEntries, suggestMissingPiece, type LayeringRole } from "@/lib/layering";
import { generateOutfitBoard, type OutfitBoard } from "@/lib/visualAssets";
import { EditorialOutfitVisual } from "@/components/EditorialOutfitVisual";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { InlineLoading } from "@/components/InlineLoading";
import { BookmarkIcon, MirrorIcon } from "@/components/Icons";
import { btnPrimary, btnSecondary } from "@/components/ui";

type ClothingItem = {
  id: string;
  imageUrl: string;
  category: string;
  layeringRole: LayeringRole;
  color: string;
  material: string;
  description: string;
};

type OutfitLayer = { role: LayeringRole; items: ClothingItem[] };

type Outfit = {
  id: string;
  rationale: string;
  isFavorite: boolean;
  occasion: string | null;
  weather: string | null;
  style: string | null;
  items: ClothingItem[];
  layers: OutfitLayer[];
};

const TORSO_PROGRESSION: LayeringRole[] = ["base_layer", "one_piece", "mid_layer", "outer_layer"];

/**
 * The "Outfit Board" — an editorial look breakdown: a numbered rail of the
 * user's own item photos next to the single most dominant piece blown up
 * large, standing in for a composed "worn" shot. Not a real composite image:
 * see lib/visualAssets.ts.
 */
function OutfitBoardView({ layers }: { layers: OutfitLayer[] }) {
  const garments = layers.flatMap((l) => l.items);
  return <EditorialOutfitVisual items={garments} large />;
}

/** Each piece shown isolated on its own clean card, per spec step 2. */
function ItemsGridView({ items }: { items: ClothingItem[] }) {
  const ordered = orderedLayerEntries(items).flatMap(({ role, items }) => items.map((item) => ({ ...item, role })));
  return (
    <div className="border border-[#cbd7dc] bg-[#e1e5e6] p-6 sm:p-8">
      <p className="mb-5 text-sm font-medium text-[#89949a]">
        {items.length} item{items.length === 1 ? "" : "s"} from your closet
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {ordered.map((item) => (
          <div key={item.id} className="relative overflow-hidden bg-[#d4dadd] p-0">
            <div className="relative aspect-square">
              <Image src={item.imageUrl} alt={item.description} fill className="object-cover saturate-[.58]" unoptimized />
            </div>
            <span className="absolute bottom-2 left-2 bg-[#fbfaf7e8] px-2 py-1.5 text-[9px] uppercase text-[#53644f]">
              {LAYER_LABELS[item.role]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OutfitDetailPage() {
  const params = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { refreshUser } = useAuth();
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [closet, setCloset] = useState<ClothingItem[]>([]);
  const [board, setBoard] = useState<OutfitBoard<ClothingItem> | null>(null);
  const [mode, setMode] = useState<"outfit" | "items">("outfit");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [replacementId, setReplacementId] = useState("");
  const [swapping, setSwapping] = useState(false);
  const [showMissingPiece, setShowMissingPiece] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadOutfit() {
    try {
      const res = await fetch(`/api/outfits/${params.id}`);
      if (res.status === 404 || res.status === 401) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load outfit");
      const data = (await res.json()) as { outfit: Outfit };
      setOutfit(data.outfit);
      setLoadError(false);
      setLoading(false);
    } catch {
      setLoadError(true);
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    fetch(`/api/outfits/${params.id}`)
      .then(async (res) => {
        if (ignore) return;
        if (res.status === 404 || res.status === 401) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error("Failed to load outfit");
        const data = (await res.json()) as { outfit: Outfit };
        if (ignore) return;
        setOutfit(data.outfit);
        setLoadError(false);
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setLoadError(true);
        setLoading(false);
      });
    fetch("/api/closet/items")
      .then(async (res) => {
        if (ignore || !res.ok) return;
        const data = (await res.json()) as { items?: ClothingItem[] };
        setCloset(data.items ?? []);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [params.id]);

  useEffect(() => {
    if (!outfit) return;
    let ignore = false;
    generateOutfitBoard(outfit.layers).then((result) => {
      if (!ignore) setBoard(result);
    });
    return () => {
      ignore = true;
    };
  }, [outfit]);

  async function toggleFavorite() {
    if (!outfit) return;
    setSaving(true);
    try {
      const wasFavorite = outfit.isFavorite;
      const res = await fetch(`/api/outfits/${outfit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !wasFavorite }),
      });
      const data = (await res.json().catch(() => ({}))) as { outfit?: Outfit };
      if (!res.ok || !data.outfit) throw new Error("save");
      setOutfit(data.outfit);
      showToast(wasFavorite ? "Removed from Saved Looks" : "Saved to your looks");
    } catch {
      showToast("Couldn't update this look. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmSwap() {
    if (!outfit || !swappingId || !replacementId) return;
    setSwapping(true);
    setError(null);
    try {
      const res = await fetch(`/api/outfits/${outfit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeItemId: swappingId, addItemId: replacementId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; outfit?: Outfit };
      if (!res.ok || !data.outfit) throw new Error(data.error ?? "Couldn't change that item");
      setOutfit(data.outfit);
      setSwappingId(null);
      setReplacementId("");
      showToast("Outfit updated");
      // If this outfit was the current look, the server took it off; pick that up everywhere.
      refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change that item");
    } finally {
      setSwapping(false);
    }
  }

  const usedIds = useMemo(() => new Set(outfit?.items.map((i) => i.id) ?? []), [outfit]);
  const swappingItem = outfit?.items.find((i) => i.id === swappingId) ?? null;
  const replacementOptions = swappingItem
    ? closet.filter((i) => i.layeringRole === swappingItem.layeringRole && !usedIds.has(i.id))
    : [];

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
        <InlineLoading />
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-red-700">Couldn&apos;t load this outfit. Please try again.</p>
          <button
            onClick={() => {
              setLoading(true);
              loadOutfit();
            }}
            className="rounded-[5px] border border-[#cbd3d7] px-4 py-1.5 text-sm font-medium text-[#333f46] hover:bg-[#e9edef]"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (notFound || !outfit) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <p className="text-sm text-[#89949a]">
          Outfit not found. Back to{" "}
          <Link href="/outfits" className="text-[#26313a] hover:underline">
            outfits
          </Link>
          .
        </p>
      </main>
    );
  }

  const title = [outfit.style, outfit.occasion].filter(Boolean).join(" ") || "Your outfit";
  const layersSummary =
    TORSO_PROGRESSION.filter((r) => outfit.layers.some((l) => l.role === r))
      .map((r) => LAYER_LABELS[r])
      .join(" → ") || "—";
  const missingPieceMessage = suggestMissingPiece(outfit.layers.map((l) => l.role));
  const boardLayers = board?.layers ?? outfit.layers;

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-16 pt-7 sm:px-8 sm:pt-10">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-[12px] font-semibold text-[#5f6a70]">
        <Link href={outfit.isFavorite ? "/outfits/saved" : "/outfits"} className="hover:text-[#1c2328] hover:underline">
          {outfit.isFavorite ? "Saved Looks" : "AI Stylist"}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-[#1c2328]">Outfit details</span>
      </nav>

      <div className="mb-7 inline-flex border border-[#d7ddd2] p-[3px]">
        <button
          onClick={() => setMode("outfit")}
          className={`btn-tactile px-3.5 py-1.5 text-[9px] font-bold tracking-[1.2px] ${
            mode === "outfit" ? "bg-[#1c2328] text-white" : "text-[#91998e] hover:text-[#5c665a]"
          }`}
        >
          OUTFIT
        </button>
        <button
          onClick={() => setMode("items")}
          className={`btn-tactile px-3.5 py-1.5 text-[9px] font-bold tracking-[1.2px] ${
            mode === "items" ? "bg-[#1c2328] text-white" : "text-[#91998e] hover:text-[#5c665a]"
          }`}
        >
          ITEMS
        </button>
      </div>

      <div className="grid gap-x-[6%] gap-y-8 lg:grid-cols-[1.03fr_.97fr]">
        <div className="min-w-0">{mode === "outfit" ? <OutfitBoardView layers={boardLayers} /> : <ItemsGridView items={outfit.items} />}</div>

        <div className="min-w-0 pt-1">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[2.6px] text-[#7e888e]">Outfit details</p>
          <h1
            className="mb-4 font-display font-normal capitalize tracking-[-1.5px] text-[#1c2328]"
            style={{ fontSize: "clamp(40px, 4.5vw, 64px)", lineHeight: 1.02 }}
          >
            {title}
          </h1>
          <p className="max-w-[460px] text-[13.5px] leading-[1.8] text-[#5f6a70]">{outfit.rationale}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={`/outfits/${outfit.id}/try-on?start=1`} className={btnPrimary}>
              <MirrorIcon className="h-4 w-4" /> Try On
            </Link>
            <button onClick={toggleFavorite} disabled={saving} className={btnSecondary} aria-pressed={outfit.isFavorite}>
              <BookmarkIcon className="h-4 w-4" />
              {saving ? "Saving…" : outfit.isFavorite ? "Saved — Remove" : "Save Look"}
            </button>
          </div>
          <p className="mt-2 text-[11.5px] text-[#7e888e]">Try On uses your saved photo and starts right away.</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {outfit.occasion && (
              <span className="border border-[#dce1d7] px-3 py-2 text-[10px] text-[#778174]">{outfit.occasion}</span>
            )}
            {outfit.weather && (
              <span className="border border-[#dce1d7] px-3 py-2 text-[10px] text-[#778174]">{outfit.weather}</span>
            )}
            {outfit.style && (
              <span className="border border-[#dce1d7] px-3 py-2 text-[10px] capitalize text-[#778174]">
                {outfit.style}
              </span>
            )}
            {layersSummary !== "—" && (
              <span className="border border-[#dce1d7] px-3 py-2 text-[10px] text-[#778174]">{layersSummary}</span>
            )}
          </div>

          <div className="mt-10">
            <div className="mb-2 flex items-baseline justify-between border-b border-[#dfe3da] pb-3.5">
              <h2 className="font-display text-xl font-normal text-[#1c2328]">Pieces used</h2>
              <span className="text-[9px] tracking-[1.5px] text-[#9ba49a]">{outfit.items.length} ITEMS</span>
            </div>
            <div className="flex flex-col">
              {outfit.items.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-3.5 border-b border-[#e8eae3] py-3 transition-colors hover:bg-[#f7f8f5]"
                >
                  <div className="relative h-[51px] w-[51px] shrink-0 overflow-hidden bg-[#efeee9]">
                    <Image
                      src={item.imageUrl}
                      alt={item.description}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.08]"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-[#222a2f]">{item.description}</p>
                    <span className="text-[9px] tracking-[1.1px] text-[#9ba49a]">{LAYER_LABELS[item.layeringRole]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <div className="mt-8 border-t border-[#dfe3da] pt-5">
            <p className="mb-3 text-[9px] font-bold uppercase tracking-[1.8px] text-[#9da99a]">Change one item</p>
            {!swappingId ? (
              <select
                value=""
                onChange={(e) => setSwappingId(e.target.value || null)}
                className="w-full border border-[#d6ddd1] bg-white px-3 py-2 text-sm text-[#222a2f]"
              >
                <option value="">Choose an item to change…</option>
                {outfit.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {LAYER_LABELS[item.layeringRole]} — {item.description}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-[#899786]">Replacing: {swappingItem?.description}</p>
                <select
                  value={replacementId}
                  onChange={(e) => setReplacementId(e.target.value)}
                  className="w-full border border-[#d6ddd1] bg-white px-3 py-2 text-sm text-[#222a2f]"
                >
                  <option value="">Choose replacement…</option>
                  {replacementOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.description}
                    </option>
                  ))}
                </select>
                {replacementOptions.length === 0 && (
                  <p className="text-xs text-[#8a9488]">
                    No other {swappingItem ? LAYER_LABELS[swappingItem.layeringRole].toLowerCase() : ""} pieces in
                    your closet yet.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={confirmSwap}
                    disabled={!replacementId || swapping}
                    className="btn-tactile flex-1 rounded-[5px] bg-[#242b30] px-3 py-2.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {swapping ? "Swapping…" : "Confirm"}
                  </button>
                  <button
                    onClick={() => {
                      setSwappingId(null);
                      setReplacementId("");
                    }}
                    className="btn-tactile rounded-[5px] border border-[#cbd3d7] px-3 py-2.5 text-xs text-[#333f46]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-7">
            <button
              onClick={() => setShowMissingPiece((v) => !v)}
              className="text-[12.5px] font-semibold text-[#26313a] underline-offset-4 hover:underline"
            >
              Is anything missing from this look?
            </button>
          </div>

          {showMissingPiece && (
            <p className="mt-3 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {missingPieceMessage ?? "Nothing missing. This outfit is complete."}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
