import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ownedPieces, serializeOutfit } from "@/lib/outfits";
import { withRetry } from "@/lib/dbRetry";
import { explainOutfit } from "@/lib/generateOutfits";
import { getCurrentLook, listOutfitTryOns, loadCurrentLook, saveOutfitTryOn, type OutfitTryOn } from "@/lib/personalPhoto";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  try {
    const outfits = await withRetry(() =>
      prisma.outfit.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { items: { include: { item: true } } },
      })
    );
    const tryOns = await outfitTryOns(user.id);
    return NextResponse.json({
      outfits: outfits.map((o) => ({ ...serializeOutfit(o), tryOn: tryOns.get(o.id)?.version ?? null, tryOnAt: tryOns.get(o.id)?.at ?? null })),
    });
  } catch (err) {
    console.error("Failed to load outfits:", err);
    return NextResponse.json({ error: "Couldn't load your outfits right now." }, { status: 500 });
  }
}

/** A new outfit from pieces the person picked themselves (the Studio). */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const body = (await request.json().catch(() => ({}))) as { itemIds?: unknown; occasion?: unknown };
  const items = await ownedPieces(user.id, body.itemIds);
  if (!items) return NextResponse.json({ error: "Pick at least one piece from your closet." }, { status: 400 });
  const occasion = typeof body.occasion === "string" && body.occasion.trim() ? body.occasion.trim().slice(0, 120) : null;

  try {
    const rationale = await explainOutfit(items).catch(() => "");
    const outfit = await prisma.outfit.create({
      data: { userId: user.id, rationale, occasion, items: { create: items.map((item) => ({ itemId: item.id })) } },
      include: { items: { include: { item: true } } },
    });
    return NextResponse.json({ outfit: { ...serializeOutfit(outfit), tryOn: null } });
  } catch (err) {
    console.error("Failed to create outfit:", err);
    return NextResponse.json({ error: "Couldn't save this outfit right now." }, { status: 500 });
  }
}

/**
 * Which outfits have a try-on picture. Try-ons made before pictures were kept per outfit only exist as the
 * current look, so that one is copied over to its outfit the first time.
 */
async function outfitTryOns(userId: string): Promise<Map<string, OutfitTryOn>> {
  try {
    const found = await listOutfitTryOns(userId);
    const look = await getCurrentLook(userId);
    if (look && !found.has(look.outfitId)) {
      const image = await loadCurrentLook(userId);
      if (image) {
        await saveOutfitTryOn(userId, look.outfitId, `data:${image.mediaType};base64,${Buffer.from(image.bytes).toString("base64")}`);
        return listOutfitTryOns(userId);
      }
    }
    return found;
  } catch (err) {
    console.error("Couldn't list try-on pictures:", err);
    return new Map();
  }
}
