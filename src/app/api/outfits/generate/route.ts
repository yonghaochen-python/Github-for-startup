import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOutfitsFromCloset } from "@/lib/generateOutfits";

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const prompt: string | undefined = typeof body.prompt === "string" ? body.prompt : undefined;

  const closet = await prisma.clothingItem.findMany();
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
