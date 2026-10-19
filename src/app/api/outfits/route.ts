import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { serializeOutfit } from "@/lib/outfits";
import { withRetry } from "@/lib/dbRetry";
import { getCurrentLook, listOutfitTryOns, loadCurrentLook, saveOutfitTryOn } from "@/lib/personalPhoto";

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
    return NextResponse.json({ outfits: outfits.map((o) => ({ ...serializeOutfit(o), tryOn: tryOns.get(o.id) ?? null })) });
  } catch (err) {
    console.error("Failed to load outfits:", err);
    return NextResponse.json({ error: "Couldn't load your outfits right now." }, { status: 500 });
  }
}

/**
 * Which outfits have a try-on picture. Try-ons made before pictures were kept per outfit only exist as the
 * current look, so that one is copied over to its outfit the first time.
 */
async function outfitTryOns(userId: string): Promise<Map<string, string>> {
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
