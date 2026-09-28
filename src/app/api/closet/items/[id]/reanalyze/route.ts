import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadSavedImage } from "@/lib/images";
import { classifyClothingImage } from "@/lib/classify";

export async function POST(_request: Request, ctx: RouteContext<"/api/closet/items/[id]/reanalyze">) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server to re-analyze with real AI." },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const existing = await prisma.clothingItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const image = await loadSavedImage(existing.imageUrl);
  const attributes = await classifyClothingImage(image);

  const item = await prisma.clothingItem.update({ where: { id }, data: attributes });
  return NextResponse.json({ item });
}
