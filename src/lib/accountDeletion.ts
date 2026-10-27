import { env } from "cloudflare:workers";
import { prisma } from "@/lib/prisma";
import { clearCurrentLook, deleteAllOutfitTryOns, deletePersonalPhoto, isSavedPhotoKey } from "@/lib/personalPhoto";
import { deleteAllPicks } from "@/lib/picks";
import { clearTryOnCache } from "@/lib/tryOnCache";
import { deleteAllLiveVideos } from "@/lib/liveVideos";

/**
 * Permanently deletes an account and everything in it: the saved photo, the current look, every outfit's try-on
 * picture, remembered try-ons, shared picks and their pictures, saved live videos, the person's own clothing photos, and (through the database's
 * cascades) their closet, outfits, sessions, reset links and usage events. Starter-closet pictures are shared files and stay.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { selfieUrl: true, items: { select: { imageUrl: true } } },
  });
  if (!user) return;

  // Files first, so nothing is left behind if the database step fails partway.
  const ownUploads = user.items
    .map((item) => item.imageUrl)
    .filter((url) => url.startsWith("/uploads/"))
    .map((url) => decodeURIComponent(url.slice("/uploads/".length)));
  for (let i = 0; i < ownUploads.length; i += 1000) await env.UPLOADS.delete(ownUploads.slice(i, i + 1000));
  if (isSavedPhotoKey(user.selfieUrl)) await deletePersonalPhoto(user.selfieUrl);
  await clearCurrentLook(userId);
  await deleteAllOutfitTryOns(userId);
  await deleteAllPicks(userId);
  await clearTryOnCache(userId);
  await deleteAllLiveVideos(userId);

  await prisma.user.delete({ where: { id: userId } });
}
