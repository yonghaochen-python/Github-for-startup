import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const outfits = await prisma.outfit.findMany({
    where: { userId: user.id },
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
