import { NextResponse } from "next/server";
import { trackAiCost } from "@/lib/analytics";
import { newMeter } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { loadSavedImage } from "@/lib/images";
import { classifyClothingImage } from "@/lib/classify";
import { asResponse, requireUser } from "@/lib/auth";

export async function POST(request: Request, ctx: RouteContext<"/api/closet/items/[id]/reanalyze">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
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

  let attributes;
  const meter = newMeter();
  try {
    const image = await loadSavedImage(existing.imageUrl);
    attributes = await classifyClothingImage(image, meter);
    await trackAiCost(user.id, "ai_cost_closet", meter);
  } catch (err) {
    await trackAiCost(user.id, "ai_cost_closet", meter, false);
    console.error("Re-analyze failed:", err);
    return NextResponse.json({ error: "Couldn't re-analyze this item right now." }, { status: 502 });
  }

  const item = await prisma.clothingItem.update({ where: { id }, data: attributes });
  return NextResponse.json({ item });
}
