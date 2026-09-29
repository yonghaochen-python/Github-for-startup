import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadSavedImage } from "@/lib/images";
import { classifyClothingImage } from "@/lib/classify";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request, ctx: RouteContext<"/api/closet/items/[id]/reanalyze">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set for this deployment." },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const existing = await prisma.clothingItem.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const image = await loadSavedImage(existing.imageUrl);
  const attributes = await classifyClothingImage(image);

  const item = await prisma.clothingItem.update({ where: { id }, data: attributes });
  return NextResponse.json({ item });
}
