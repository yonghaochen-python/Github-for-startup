import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOutfitsFromCloset } from "@/lib/generateOutfits";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const body: unknown = await request.json().catch(() => ({}));
  const prompt =
    body && typeof body === "object" && "prompt" in body && typeof body.prompt === "string"
      ? body.prompt
      : undefined;

  const closet = await prisma.clothingItem.findMany({ where: { userId: user.id } });
  if (closet.length < 2) {
    return NextResponse.json(
      { error: "Add at least 2 items to your closet before generating outfits." },
      { status: 400 }
    );
  }

  const generated = await generateOutfitsFromCloset(closet, prompt);

  const outfits = await Promise.all(
    generated.map((outfit) =>
      prisma.outfit.create({
        data: {
          userId: user.id,
          rationale: outfit.rationale,
          items: { create: outfit.itemIds.map((itemId) => ({ itemId })) },
        },
        include: { items: { include: { item: true } } },
      })
    )
  );

  return NextResponse.json({
    outfits: outfits.map((outfit) => ({
      id: outfit.id,
      rationale: outfit.rationale,
      createdAt: outfit.createdAt,
      items: outfit.items.map((oi) => oi.item),
    })),
  });
}
