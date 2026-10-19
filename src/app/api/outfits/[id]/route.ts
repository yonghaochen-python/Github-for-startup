import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { clearCurrentLook, deleteOutfitTryOns, getCurrentLook, outfitTryOnVersion } from "@/lib/personalPhoto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { serializeOutfit } from "@/lib/outfits";
import { explainOutfit } from "@/lib/generateOutfits";
import { withRetry } from "@/lib/dbRetry";

async function loadOwnedOutfit(id: string, userId: string) {
  const outfit = await withRetry(() =>
    prisma.outfit.findUnique({
      where: { id },
      include: { items: { include: { item: true } } },
    })
  );
  if (!outfit || outfit.userId !== userId) return null;
  return outfit;
}

export async function GET(request: Request, ctx: RouteContext<"/api/outfits/[id]">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const { id } = await ctx.params;
  try {
    const outfit = await loadOwnedOutfit(id, user.id);
    if (!outfit) return NextResponse.json({ error: "Outfit not found." }, { status: 404 });
    return NextResponse.json({ outfit: { ...serializeOutfit(outfit), tryOn: await tryOnOf(user.id, id) } });
  } catch (err) {
    console.error("Failed to load outfit:", err);
    return NextResponse.json({ error: "Couldn't load this outfit right now." }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/outfits/[id]">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const { id } = await ctx.params;
  const outfit = await loadOwnedOutfit(id, user.id);
  if (!outfit) return NextResponse.json({ error: "Outfit not found." }, { status: 404 });

  const body: unknown = await request.json().catch(() => ({}));
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  if (typeof b.isFavorite === "boolean") {
    await prisma.outfit.update({ where: { id }, data: { isFavorite: b.isFavorite } });
    if (b.isFavorite && !outfit.isFavorite) await track(user.id, "look_saved");
  }

  if (typeof b.removeItemId === "string" && typeof b.addItemId === "string") {
    const stillOwns = outfit.items.some((oi) => oi.itemId === b.removeItemId);
    const replacement = await prisma.clothingItem.findUnique({ where: { id: b.addItemId } });
    if (!stillOwns || !replacement || replacement.userId !== user.id) {
      return NextResponse.json({ error: "Invalid item swap." }, { status: 400 });
    }

    await prisma.outfitItem.delete({ where: { outfitId_itemId: { outfitId: id, itemId: b.removeItemId } } });
    await prisma.outfitItem.create({ data: { outfitId: id, itemId: b.addItemId } });

    // A current look of this outfit shows the old piece now, so take it off rather than show a stale try-on.
    const look = await getCurrentLook(user.id).catch(() => null);
    if (look?.outfitId === id) await clearCurrentLook(user.id).catch(() => {});
    await deleteOutfitTryOns(user.id, [id]).catch(() => {});

    const newItems = [...outfit.items.map((oi) => oi.item).filter((i) => i.id !== b.removeItemId), replacement];
    try {
      const rationale = await explainOutfit(newItems);
      await prisma.outfit.update({ where: { id }, data: { rationale } });
    } catch (err) {
      // The swap itself already succeeded above — don't fail the whole request
      // just because the follow-up rationale call did.
      console.error("Failed to refresh rationale after item swap:", err);
    }
  }

  const updated = await loadOwnedOutfit(id, user.id);
  if (!updated) return NextResponse.json({ error: "Outfit not found." }, { status: 404 });
  return NextResponse.json({ outfit: { ...serializeOutfit(updated), tryOn: await tryOnOf(user.id, id) } });
}

/** The outfit's try-on picture version; a storage hiccup just means the page shows the clothes instead. */
function tryOnOf(userId: string, outfitId: string) {
  return outfitTryOnVersion(userId, outfitId).catch((err) => {
    console.error("Couldn't check the outfit's try-on picture:", err);
    return null;
  });
}
