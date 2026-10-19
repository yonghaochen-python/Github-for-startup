import type { LayeringRole } from "@/lib/layering";
import { garmentSheetJpeg, photoToJpeg } from "@/lib/clientImage";

type Piece = { id: string; imageUrl: string };
type NotShown = { role: LayeringRole; description: string; reason: string };
export type TryOnResult = { isMock: boolean; provider: string; imageDataUrl: string | null; notShown?: NotShown[] };

/**
 * Runs a try-on of a saved outfit on the person's saved photo (the server reads the photo; nothing is re-uploaded).
 * With a live provider, each garment's photo is shrunk here first so phones upload small files.
 */
export async function requestTryOn(outfitId: string, pieces: Piece[], liveProvider: boolean): Promise<TryOnResult> {
  const formData = new FormData();
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
