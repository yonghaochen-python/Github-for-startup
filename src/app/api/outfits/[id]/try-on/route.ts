import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { generateTryOnPreview } from "@/lib/tryOn";
import { withRetry } from "@/lib/dbRetry";

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
  try {
    const outfit = await withRetry(() =>
      prisma.outfit.findUnique({
        where: { id },
        include: { items: { include: { item: true } } },
      })
    );
    if (!outfit || outfit.userId !== user.id) {
      return NextResponse.json({ error: "Outfit not found." }, { status: 404 });
    }

    const preview = await generateTryOnPreview(
      user.selfieUrl,
      outfit.items.map((oi) => ({ imageUrl: oi.item.imageUrl, description: oi.item.description }))
    );

    return NextResponse.json({ preview });
  } catch (err) {
    console.error("Failed to load try-on preview:", err);
    return NextResponse.json({ error: "Couldn't load this preview right now." }, { status: 500 });
  }
}
