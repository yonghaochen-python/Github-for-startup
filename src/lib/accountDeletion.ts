import { env } from "cloudflare:workers";
import { prisma } from "@/lib/prisma";
import { pictureKeys } from "@/lib/images";
import { clearCurrentLook, deleteAllOutfitTryOns, deletePersonalPhoto, isSavedPhotoKey } from "@/lib/personalPhoto";
import { deleteAllPicks } from "@/lib/picks";
import { clearTryOnCache } from "@/lib/tryOnCache";
import { deleteAllLiveVideos } from "@/lib/liveVideos";
import { deletePortrait } from "@/lib/portrait";
import { deleteSavedSearches } from "@/lib/styleSearchCache";
import { deleteEnhanceCopies } from "@/lib/enhance";
import { deleteStripeCustomer } from "@/lib/billing";

/**
 * Permanently deletes an account and everything in it: the saved photo, the current look, every outfit's try-on
 * picture, remembered try-ons, shared picks and their pictures, saved live videos, the Studio portrait, the person's own clothing photos, and (through the database's
 * cascades) their closet, outfits, sessions, reset links and usage events. Starter-closet pictures are shared files and stay.
 */

export async function deleteAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { selfieUrl: true, stripeCustomerId: true, items: { select: { imageUrl: true, plainUrl: true, enhancedUrl: true } } },
  });
  if (!user) return;

  // Stripe first: deleting the customer ends any Plus subscription at once (no further charges) and removes the
  // saved card. If Stripe can't be reached, the deletion stops here and can be tried again, so nobody is left paying
  // for an account that no longer exists.
  if (user.stripeCustomerId) await deleteStripeCustomer(user.stripeCustomerId);

  // Files first, so nothing is left behind if the database step fails partway.
  // A piece with its background removed has two files: the cut-out and the original photo.
  // Every picture a piece has: the one shown, and (with AI enhancement) its plain and enhanced versions.
  const pictures = user.items.flatMap((item) => [item.imageUrl, item.plainUrl, item.enhancedUrl].filter((u): u is string => Boolean(u)));
  const ownUploads = [...new Set((await Promise.all([...new Set(pictures)].map((url) => pictureKeys(url)))).flat())];
  for (let i = 0; i < ownUploads.length; i += 1000) await env.UPLOADS.delete(ownUploads.slice(i, i + 1000));
  if (isSavedPhotoKey(user.selfieUrl)) await deletePersonalPhoto(user.selfieUrl);
  await clearCurrentLook(userId);
  await deleteAllOutfitTryOns(userId);
  await deleteAllPicks(userId);
  await clearTryOnCache(userId);
  await deleteAllLiveVideos(userId);
  await deletePortrait(userId);
  await deleteSavedSearches(userId);
  await deleteEnhanceCopies(userId);

  // Stripe's billing messages stay (they hold no card details) but no longer point at the account.
  await prisma.billingEvent.updateMany({ where: { userId }, data: { userId: null } });
  await prisma.user.delete({ where: { id: userId } });
}
