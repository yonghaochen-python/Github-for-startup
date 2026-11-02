import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { purgeLegacySelfie } from "@/lib/legacySelfie";
import { getCurrentLook, isSavedPhotoKey, photoVersion } from "@/lib/personalPhoto";

export async function GET(request: Request) {
  let user;
  try {
    user = await getCurrentUser(request);
  } catch (err) {
    // Couldn't reach the database: say so, rather than answering "nobody is signed in".
    console.error("Couldn't check the session:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "cache-control": "no-store", "retry-after": "2" } });
  }
  // Photos stored by the old, public version of Try It On are still cleaned up; privately saved ones are kept.
  if (user?.selfieUrl && !isSavedPhotoKey(user.selfieUrl)) await purgeLegacySelfie(user.id, user.selfieUrl);
  const savedPhoto = user && isSavedPhotoKey(user.selfieUrl) ? photoVersion(user.selfieUrl) : null;
  const look = user && savedPhoto ? await getCurrentLook(user.id).catch(() => null) : null;
  return NextResponse.json(
    {
      user: user && {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        photoVersion: savedPhoto,
        look,
        isAdmin: user.role === "admin",
      },
    },
    { headers: { "cache-control": "private, no-store" } }
  );
}
