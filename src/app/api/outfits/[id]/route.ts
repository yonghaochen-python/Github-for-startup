import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { serializeOutfit } from "@/lib/outfits";
import { explainOutfit } from "@/lib/generateOutfits";

async function loadOwnedOutfit(id: string, userId: string) {
  const outfit = await prisma.outfit.findUnique({
    where: { id },
    include: { items: { include: { item: true } } },
  });
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
  const outfit = await loadOwnedOutfit(id, user.id);
  if (!outfit) return NextResponse.json({ error: "Outfit not found." }, { status: 404 });

  return NextResponse.json({ outfit: serializeOutfit(outfit) });
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
  }

  if (typeof b.removeItemId === "string" && typeof b.addItemId === "string") {
    const stillOwns = outfit.items.some((oi) => oi.itemId === b.removeItemId);
    const replacement = await prisma.clothingItem.findUnique({ where: { id: b.addItemId } });
    if (!stillOwns || !replacement || replacement.userId !== user.id) {
      return NextResponse.json({ error: "Invalid item swap." }, { status: 400 });
    }

    await prisma.outfitItem.delete({ where: { outfitId_itemId: { outfitId: id, itemId: b.removeItemId } } });
    await prisma.outfitItem.create({ data: { outfitId: id, itemId: b.addItemId } });

    const newItems = [...outfit.items.map((oi) => oi.item).filter((i) => i.id !== b.removeItemId), replacement];
    const rationale = await explainOutfit(newItems);
    await prisma.outfit.update({ where: { id }, data: { rationale } });
  }

  const updated = await loadOwnedOutfit(id, user.id);
  if (!updated) return NextResponse.json({ error: "Outfit not found." }, { status: 404 });
  return NextResponse.json({ outfit: serializeOutfit(updated) });
}
