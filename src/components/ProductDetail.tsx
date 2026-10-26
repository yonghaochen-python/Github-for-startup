"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { DEMO_LABEL, priceLabel, type ShopProduct } from "@/lib/shopCatalog";
import { requestShopTryOn, type TryOnResult } from "@/lib/tryOnClient";

/**
 * A product up close: bigger picture, what's known about it, and the ways to try it on (live on camera, or on the
 * person's saved full-body photo). Unknown details are left out, never guessed. Nothing here adds to My Closet.
 */

const KIND: Record<ShopProduct["category"], string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessory: "Accessory",
};

type PhotoState = { status: "idle" } | { status: "running" } | { status: "done"; result: TryOnResult } | { status: "error"; message: string; noPhoto?: boolean };

export function ProductDetail({
  product,
  onClose,
  onTryLive,
  inOutfit,
  outfitFull,
  onToggleOutfit,
  saved,
  onToggleSaved,
}: {
  product: ShopProduct;
  onClose: () => void;
  onTryLive: () => void;
  inOutfit: boolean;
  outfitFull: boolean;
  onToggleOutfit: () => void;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  const { user } = useAuth();
  const [photo, setPhoto] = useState<PhotoState>({ status: "idle" });
  const price = priceLabel(product.price, product.currency);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  async function tryWithPhoto() {
    if (!user?.photoVersion) return setPhoto({ status: "error", message: "Add a full-body photo in Profile first.", noPhoto: true });
    setPhoto({ status: "running" });
    try {
      setPhoto({ status: "done", result: await requestShopTryOn([{ imageUrl: product.imageUrl, description: product.name, color: product.color, layeringRole: product.layeringRole }]) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't run the try-on right now.";
      setPhoto({ status: "error", message, noPhoto: message.includes("full-body photo") });
    }
  }

  const details: [string, string][] = [
    ["Category", KIND[product.category]],
    ["Color", product.colors.map((c) => c.name).join(", ")],
    ["Style", product.style],
    ...(product.retailer ? ([["Store", product.retailer]] as [string, string][]) : []),
    ...(product.availability ? ([["Availability", product.availability]] as [string, string][]) : []),
    ...(product.updatedAt ? ([["Updated", new Date(product.updatedAt).toLocaleDateString()]] as [string, string][]) : []),
  ];
  const result = photo.status === "done" ? photo.result : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(10,16,24,0.55)] sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        onClick={(e) => e.stopPropagation()}
        className="relative grid max-h-[92vh] w-full max-w-[920px] overflow-y-auto rounded-t-[22px] bg-white shadow-[0_24px_60px_rgba(10,16,24,0.3)] sm:rounded-[22px] md:grid-cols-[minmax(0,1fr)_minmax(0,380px)]"
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[18px] text-[#29343a] shadow-sm hover:text-[#121821]">
          ×
        </button>

        <div className="relative aspect-[4/3] bg-[#f0eee9] md:aspect-auto md:min-h-[520px]">
          {result?.imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a generated picture held in this page only
            <img src={result.imageDataUrl} alt={`You wearing the ${product.name.toLowerCase()}`} className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- the catalog's own product photo
            <img src={product.imageUrl} alt={product.name} className="absolute inset-0 h-full w-full object-contain p-8" />
          )}
          {photo.status === "running" && (
            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(240,238,233,0.75)] text-[13px] font-medium text-[#121821]">
              Trying it on… (about 10–20 seconds)
            </div>
          )}
          {result?.imageDataUrl && (
            <button onClick={() => setPhoto({ status: "idle" })} className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1.5 text-[11.5px] font-medium text-[#121821] shadow-sm">
              Show the piece
            </button>
          )}
        </div>

        <div className="flex flex-col p-6 sm:p-8">
          <p className="text-[10px] uppercase tracking-[1.8px] text-[#5d6874]">
            {product.brand ?? (product.isDemo ? DEMO_LABEL : "")}
            {product.isDemo && <span className="ml-2 rounded-full bg-[#eef1f2] px-2 py-0.5 text-[9px] tracking-[1.2px] text-[#4f5b66]">Demo item</span>}
          </p>
          <h2 className="mt-2 font-display text-[32px] leading-tight tracking-[-0.5px] text-[#121821]">{product.name}</h2>
          {price && <p className="mt-1 text-[15px] text-[#121821]">{price}</p>}
          {product.isDemo && <p className="mt-2 text-[12px] leading-snug text-[#5d6874]">A demonstration piece photographed by Virm, not a store listing. It can&apos;t be bought.</p>}

          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-black/[0.07] pt-5 text-[13px]">
            {details.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[#5d6874]">{k}</dt>
                <dd className="text-[#121821]">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-col gap-2">
            {product.tryOnEligible ? (
              <>
                <button onClick={onTryLive} className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-[#121821] px-5 text-[13px] font-medium text-white hover:bg-[#2a3542]">
                  Try on live
                </button>
                <button
                  onClick={tryWithPhoto}
                  disabled={photo.status === "running"}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-white px-5 text-[13px] font-medium text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)] disabled:opacity-50"
                >
                  {result ? "Try on my photo again" : "Try on my photo"}
                </button>
              </>
            ) : (
              <p className="rounded-[12px] bg-[#f4f5f6] px-3 py-2 text-[12.5px] text-[#4f5b66]">This piece&apos;s picture isn&apos;t suitable for try-on.</p>
            )}
            {photo.status === "error" && (
              <p role="alert" className="rounded-[12px] bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
                {photo.message}{" "}
                {photo.noPhoto && (
                  <Link href="/profile" className="font-semibold underline underline-offset-2">
                    Go to Profile
                  </Link>
                )}
              </p>
            )}
            {result?.isMock && <p className="text-[12px] text-[#5d6874]">Practice mode: no real try-on ran, so there&apos;s no picture.</p>}
            {result?.notShown?.map((n) => (
              <p key={n.description} className="text-[12px] text-[#5d6874]">
                {n.reason}
              </p>
            ))}
            {result?.imageDataUrl && <p className="text-[11.5px] text-[#5d6874]">An AI preview. It isn&apos;t saved anywhere.</p>}
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px]">
            <button onClick={onToggleSaved} className="font-medium text-[#121821] underline-offset-4 hover:underline">
              {saved ? "♥ Saved to wishlist" : "♡ Save to wishlist"}
            </button>
            <button onClick={onToggleOutfit} disabled={!inOutfit && outfitFull} className="font-medium text-[#121821] underline-offset-4 hover:underline disabled:opacity-40">
              {inOutfit ? "✓ In your outfit" : "+ Add to outfit"}
            </button>
            {product.productUrl && (
              <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[#121821] underline underline-offset-4">
                View at {product.retailer ?? "the store"} ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
