import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { serializeOutfit } from "@/lib/outfits";
import { withRetry } from "@/lib/dbRetry";

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
    return NextResponse.json({ outfits: outfits.map(serializeOutfit) });
  } catch (err) {
    console.error("Failed to load outfits:", err);
    return NextResponse.json({ error: "Couldn't load your outfits right now." }, { status: 500 });
  }
}
