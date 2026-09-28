import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const outfits = await prisma.outfit.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: { include: { item: true } } },
  });

  return NextResponse.json({
    outfits: outfits.map((outfit) => ({
      id: outfit.id,
      rationale: outfit.rationale,
      createdAt: outfit.createdAt,
      items: outfit.items.map((oi) => oi.item),
    })),
  });
}
