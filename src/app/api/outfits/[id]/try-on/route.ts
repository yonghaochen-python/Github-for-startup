import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { generateTryOnPreview } from "@/lib/tryOn";

export async function GET(request: Request, ctx: RouteContext<"/api/outfits/[id]/try-on">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  if (!user.selfieUrl) {
    return NextResponse.json({ error: "Upload a photo of yourself first." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const outfit = await prisma.outfit.findUnique({
    where: { id },
    include: { items: { include: { item: true } } },
  });
  if (!outfit || outfit.userId !== user.id) {
    return NextResponse.json({ error: "Outfit not found." }, { status: 404 });
  }

  const preview = await generateTryOnPreview(
    user.selfieUrl,
    outfit.items.map((oi) => ({ imageUrl: oi.item.imageUrl, description: oi.item.description }))
  );

  return NextResponse.json({ preview });
}
