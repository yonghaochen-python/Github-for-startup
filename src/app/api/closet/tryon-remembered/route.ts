import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { aiPicture } from "@/lib/aiPicture";
import { asResponse, requireUser } from "@/lib/auth";
import { isSavedPhotoKey } from "@/lib/personalPhoto";
import { prisma } from "@/lib/prisma";
import { tryOnCacheKey } from "@/lib/tryOnCache";

/**
 * Whether a try-on of exactly these closet pieces on the saved photo was made before (so showing it again is free).
 * Only answers yes or no: nothing is generated, nothing is counted.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const body = ((await request.json().catch(() => ({}))) ?? {}) as { pieceIds?: unknown };
  const ids = Array.isArray(body.pieceIds) ? body.pieceIds.filter((id): id is string => typeof id === "string").slice(0, 12) : [];
  if (!ids.length || !isSavedPhotoKey(user.selfieUrl)) return NextResponse.json({ remembered: false });

  const items = await prisma.clothingItem.findMany({ where: { userId: user.id, id: { in: ids } } });
  if (items.length !== ids.length) return NextResponse.json({ remembered: false });
  // The same picture the try-on uses (the piece's own, never the AI-enhanced one).
  const key = tryOnCacheKey(user.id, user.selfieUrl, items.map((item) => ({ ...item, imageUrl: aiPicture(item) })));
  const found = await env.UPLOADS.head(key).catch(() => null);
  return NextResponse.json({ remembered: Boolean(found) }, { headers: { "cache-control": "no-store" } });
}
