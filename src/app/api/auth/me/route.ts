import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { purgeLegacySelfie } from "@/lib/legacySelfie";
import { isSavedPhotoKey, photoVersion } from "@/lib/personalPhoto";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  // Photos stored by the old, public version of Try It On are still cleaned up; privately saved ones are kept.
  if (user?.selfieUrl && !isSavedPhotoKey(user.selfieUrl)) await purgeLegacySelfie(user.id, user.selfieUrl);
  const savedPhoto = user && isSavedPhotoKey(user.selfieUrl) ? photoVersion(user.selfieUrl) : null;
  return NextResponse.json(
    { user: user && { id: user.id, email: user.email, photoVersion: savedPhoto } },
    { headers: { "cache-control": "private, no-store" } }
  );
}
