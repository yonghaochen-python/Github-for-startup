import type { LayeringRole } from "@/lib/layering";
import { wornOrder } from "@/lib/tryOn/outfitPrompt";
import { aiPicture } from "@/lib/aiPicture";
import { garmentSheetJpeg, photoToJpeg } from "@/lib/clientImage";

/** The width of the one picture holding every piece of an outfit, sent to the try-on AI. */
const SHEET_SIDE = 1600;

/** Shown with every try-on: what an AI preview can't promise. */
export const TRY_ON_CAVEAT = "Virtual try-ons are AI previews. They can't show exactly how real fabric, fit, size or color will look.";

type Piece = { id: string; imageUrl: string; plainUrl?: string | null; enhancedUrl?: string | null; layeringRole?: string; description?: string };
type NotShown = { role: LayeringRole; description: string; reason: string };
export type TryOnResult = {
  isMock: boolean;
  provider: string;
  imageDataUrl: string | null;
  notShown?: NotShown[];
  reused?: boolean;
  /** This try-on's request id (added here), so feedback can point at it. */
  requestId?: string;
};

/**
 * Runs a try-on of a saved outfit on the person's saved photo (the server reads the photo; nothing is re-uploaded).
 * With a live provider, each garment's photo is shrunk here first so phones upload small files.
 */
export async function requestTryOn(outfitId: string, pieces: Piece[], liveProvider: boolean, fresh = false): Promise<TryOnResult> {
  const formData = new FormData();
  // One id per Try On press, so a repeated request is never counted twice.
  const requestId = crypto.randomUUID();
  formData.append("requestId", requestId);
  // By default a picture already made of this photo and these pieces is shown again for free; fresh asks for a new one.
  if (fresh) formData.append("fresh", "1");
  // Always send the prepared pictures (white behind cut-outs, one sheet for the whole look). Without them the server
  // would send the stored cut-outs as they are, whose see-through background the AI can read as black, one piece per
  // call. `liveProvider` used to gate this, so a Try On pressed before it loaded went out unprepared.
  void liveProvider;
  {
    // Laid out innermost first, the same order the server names them in, so "1) …, 2) …" matches the sheet.
    pieces = wornOrder(pieces.map((p) => ({ ...p, layeringRole: p.layeringRole ?? "", description: p.description ?? "" })));
    const photos = await Promise.allSettled(
      pieces.map(async (piece) => {
        // The piece's own picture, never the AI-enhanced one.
        const res = await fetch(aiPicture(piece));
        if (!res.ok) throw new Error("garment");
        return photoToJpeg(await res.blob(), 0.88, 1024);
      })
    );
    photos.forEach((p, i) => {
      if (p.status === "fulfilled") formData.append(`garment:${pieces[i].id}`, p.value, `${pieces[i].id}.jpg`);
    });
    // Providers that dress a whole outfit in one call use every piece on a single sheet.
    if (photos.every((p) => p.status === "fulfilled")) {
      // A larger sheet keeps small details (a side logo, a print) readable for the try-on AI.
      const sheet = await garmentSheetJpeg(photos.map((p) => (p as PromiseFulfilledResult<Blob>).value), 0.9, SHEET_SIDE).catch(() => null);
      if (sheet) formData.append("garmentSheet", sheet, "garments.jpg");
    }
  }
  const res = await fetch(`/api/outfits/${outfitId}/try-on`, { method: "POST", body: formData });
  const data = (await res.json().catch(() => ({}))) as { error?: string; result?: TryOnResult };
  if (!res.ok || !data.result) throw new Error(data.error ?? "Couldn't run the try-on right now.");
  return { ...data.result, requestId };
}

type ShopPiece = { imageUrl: string; plainUrl?: string | null; enhancedUrl?: string | null; description: string; color?: string; layeringRole: LayeringRole };

/**
 * Photo try-on for a look with Shopping pieces in it (they aren't in the closet, so it can't be a saved outfit).
 * Every piece's picture is sent, shrunk, with its description; nothing is saved. Same provider and limits.
 */
export async function requestShopTryOn(pieces: ShopPiece[], fresh = false): Promise<TryOnResult> {
  // Innermost first (pictures, sheet and descriptions alike), matching the order the server names them in.
  pieces = wornOrder(pieces);
  const photos = await Promise.all(
    pieces.map(async (piece) => {
      const res = await fetch(aiPicture(piece)).catch(() => null);
      if (!res?.ok) throw new Error("A piece's picture couldn't be used. Try a clearer photo of just the piece.");
      return photoToJpeg(await res.blob(), 0.9, 1024);
    })
  );
  const formData = new FormData();
  const requestId = crypto.randomUUID();
  formData.append("requestId", requestId);
  formData.append("pieces", JSON.stringify(pieces.map((p) => ({ description: p.description, color: p.color ?? "", layeringRole: p.layeringRole }))));
  // The same pieces on the same photo show the earlier picture again for free; fresh asks for a new one.
  if (fresh) formData.append("fresh", "1");
  photos.forEach((photo, i) => formData.append(`garment:${i}`, photo, `${i}.jpg`));
  if (photos.length > 1) {
    const sheet = await garmentSheetJpeg(photos, 0.9, SHEET_SIDE).catch(() => null);
    if (sheet) formData.append("garmentSheet", sheet, "garments.jpg");
  }
  const res = await fetch("/api/shop/try-on", { method: "POST", body: formData });
  const data = (await res.json().catch(() => ({}))) as { error?: string; result?: TryOnResult };
  if (!res.ok || !data.result) throw new Error(data.error ?? "Couldn't run the try-on right now.");
  return { ...data.result, requestId };
}
