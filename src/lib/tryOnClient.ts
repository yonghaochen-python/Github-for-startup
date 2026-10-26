import type { LayeringRole } from "@/lib/layering";
import { garmentSheetJpeg, photoToJpeg } from "@/lib/clientImage";

/** Shown with every try-on: what an AI preview can't promise. */
export const TRY_ON_CAVEAT = "Virtual try-ons are AI previews. They can't show exactly how real fabric, fit, size or color will look.";

type Piece = { id: string; imageUrl: string };
type NotShown = { role: LayeringRole; description: string; reason: string };
export type TryOnResult = { isMock: boolean; provider: string; imageDataUrl: string | null; notShown?: NotShown[]; reused?: boolean };

/**
 * Runs a try-on of a saved outfit on the person's saved photo (the server reads the photo; nothing is re-uploaded).
 * With a live provider, each garment's photo is shrunk here first so phones upload small files.
 */
export async function requestTryOn(outfitId: string, pieces: Piece[], liveProvider: boolean, fresh = false): Promise<TryOnResult> {
  const formData = new FormData();
  // By default a picture already made of this photo and these pieces is shown again for free; fresh asks for a new one.
  if (fresh) formData.append("fresh", "1");
  if (liveProvider) {
    const photos = await Promise.allSettled(
      pieces.map(async (piece) => {
        const res = await fetch(piece.imageUrl);
        if (!res.ok) throw new Error("garment");
        return photoToJpeg(await res.blob(), 0.88, 1024);
      })
    );
    photos.forEach((p, i) => {
      if (p.status === "fulfilled") formData.append(`garment:${pieces[i].id}`, p.value, `${pieces[i].id}.jpg`);
    });
    // Providers that dress a whole outfit in one call use every piece on a single sheet.
    if (photos.every((p) => p.status === "fulfilled")) {
      const sheet = await garmentSheetJpeg(photos.map((p) => (p as PromiseFulfilledResult<Blob>).value)).catch(() => null);
      if (sheet) formData.append("garmentSheet", sheet, "garments.jpg");
    }
  }
  const res = await fetch(`/api/outfits/${outfitId}/try-on`, { method: "POST", body: formData });
  const data = (await res.json().catch(() => ({}))) as { error?: string; result?: TryOnResult };
  if (!res.ok || !data.result) throw new Error(data.error ?? "Couldn't run the try-on right now.");
  return data.result;
}

type ShopPiece = { imageUrl: string; description: string; color?: string; layeringRole: LayeringRole };

/**
 * Photo try-on for a look with Shopping pieces in it (they aren't in the closet, so it can't be a saved outfit).
 * Every piece's picture is sent, shrunk, with its description; nothing is saved. Same provider and limits.
 */
export async function requestShopTryOn(pieces: ShopPiece[]): Promise<TryOnResult> {
  const photos = await Promise.all(
    pieces.map(async (piece) => {
      const res = await fetch(piece.imageUrl).catch(() => null);
      if (!res?.ok) throw new Error("A piece's picture couldn't be used. Try a clearer photo of just the piece.");
      return photoToJpeg(await res.blob(), 0.9, 1024);
    })
  );
  const formData = new FormData();
  formData.append("pieces", JSON.stringify(pieces.map((p) => ({ description: p.description, color: p.color ?? "", layeringRole: p.layeringRole }))));
  photos.forEach((photo, i) => formData.append(`garment:${i}`, photo, `${i}.jpg`));
  if (photos.length > 1) {
    const sheet = await garmentSheetJpeg(photos).catch(() => null);
    if (sheet) formData.append("garmentSheet", sheet, "garments.jpg");
  }
  const res = await fetch("/api/shop/try-on", { method: "POST", body: formData });
  const data = (await res.json().catch(() => ({}))) as { error?: string; result?: TryOnResult };
  if (!res.ok || !data.result) throw new Error(data.error ?? "Couldn't run the try-on right now.");
  return data.result;
}
