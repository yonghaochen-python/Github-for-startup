import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { tryOnPicture } from "@/lib/aiPicture";
import { prisma } from "@/lib/prisma";
import { withRetry } from "@/lib/dbRetry";
import { getCurrentLook, isSavedPhotoKey, loadOutfitTryOn, saveCurrentLook, saveOutfitTryOn } from "@/lib/personalPhoto";
import { cacheTryOn, tryOnCacheKey } from "@/lib/tryOnCache";

/** This outfit's latest try-on picture. Owner-only: pictures are stored under the signed-in person's own id. */
export async function GET(request: Request, ctx: RouteContext<"/api/outfits/[id]/try-on/image">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { id } = await ctx.params;
  const image = await loadOutfitTryOn(user.id, id);
  if (!image) return new Response("Not found", { status: 404, headers: { "cache-control": "private, no-store" } });
  // The URL carries a version that changes with each new try-on, so the browser may keep this privately.
  return new Response(new Blob([new Uint8Array(image.bytes)]), {
    headers: { "cache-control": "private, max-age=31536000, immutable", "content-type": image.mediaType, "x-content-type-options": "nosniff" },
  });
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * The same try-on picture with the person's real face put back (done on their device, see lib/keepFace): replaces
 * this outfit's picture, the remembered one, and the current look when it's this outfit. Only the owner, only their
 * own outfit; nothing else changes and nothing is charged.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/outfits/[id]/try-on/image">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { id } = await ctx.params;
  const form = await request.formData().catch(() => null);
  const file = form?.get("picture");
  if (!(file instanceof File) || !ACCEPTED.includes(file.type) || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That picture couldn't be used." }, { status: 400 });
  }
  const outfit = await withRetry(() => prisma.outfit.findUnique({ where: { id }, include: { items: { include: { item: true } } } }));
  if (!outfit || outfit.userId !== user.id || !(await loadOutfitTryOn(user.id, id))) {
    return NextResponse.json({ error: "Outfit not found." }, { status: 404 });
  }
  const dataUrl = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  await saveOutfitTryOn(user.id, id, dataUrl);
  if (isSavedPhotoKey(user.selfieUrl)) {
    const key = tryOnCacheKey(user.id, user.selfieUrl, outfit.items.map(({ item }) => ({ ...item, imageUrl: tryOnPicture(item) })));
    await cacheTryOn(key, dataUrl).catch(() => {});
  }
  const current = await getCurrentLook(user.id);
  const look = current?.outfitId === id ? await saveCurrentLook(user.id, id, dataUrl) : null;
  return NextResponse.json({ ok: true, look });
}
