import { prisma } from "@/lib/prisma";
import { deleteSavedImage } from "@/lib/images";

/**
 * Try It On no longer keeps anyone's photo, but the previous version saved one per user (a file in storage
 * plus User.selfieUrl). This removes that leftover for a user the first time their account is loaded after
 * the change, so old photos disappear without a manual sweep. It never touches a file that a closet item
 * also points at, and a failure is logged and retried next time rather than surfacing to the person.
 */
export async function purgeLegacySelfie(userId: string, selfieUrl: string): Promise<void> {
  try {
    const sharedWithCloset = await prisma.clothingItem.count({ where: { imageUrl: selfieUrl } });
    if (sharedWithCloset === 0) await deleteSavedImage(selfieUrl);
    await prisma.user.update({ where: { id: userId }, data: { selfieUrl: null } });
  } catch (err) {
    console.error("Couldn't remove a legacy saved photo:", err);
  }
}
