import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOutfitsFromCloset, type OutfitRequest } from "@/lib/generateOutfits";
import { requireUser } from "@/lib/auth";
import { serializeOutfit } from "@/lib/outfits";
import { sanitizeLayeredOutfit } from "@/lib/layering";

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const body: unknown = await request.json().catch(() => ({}));
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const outfitRequest: OutfitRequest = {
    occasion: str(b.occasion),
    weather: str(b.weather),
    style: str(b.style),
    colorPreference: str(b.colorPreference),
    prompt: str(b.prompt),
  };

  const closet = await prisma.clothingItem.findMany({ where: { userId: user.id } });
  if (closet.length < 2) {
    return NextResponse.json(
      { error: "Add at least 2 items to your closet before generating outfits." },
      { status: 400 }
    );
  }

  let generated;
  try {
    generated = await generateOutfitsFromCloset(closet, outfitRequest);
  } catch (err) {
    console.error("Outfit generation failed:", err);
    return NextResponse.json(
      { error: "Couldn't generate outfits right now. Please try again in a moment." },
      { status: 502 }
    );
  }

  // The model is only asked (via prompt) to use owned items — verify it server-side
  // rather than trusting that, so a hallucinated id can't crash the create below.
  // Also apply the hard layering rule (drop a stray bottom alongside a one_piece)
  // as a safety net regardless of what the model proposed.
  const closetById = new Map(closet.map((item) => [item.id, item]));
  const valid = generated
    .map((outfit) => {
      const uniqueItems = [...new Set(outfit.itemIds)]
        .map((id) => closetById.get(id))
        .filter((item): item is (typeof closet)[number] => Boolean(item));
      const sanitized = sanitizeLayeredOutfit(uniqueItems);
      return { ...outfit, itemIds: sanitized.map((item) => item.id) };
    })
    .filter((outfit) => outfit.itemIds.length >= 2);

  if (valid.length === 0) {
    return NextResponse.json(
      { error: "Couldn't generate outfits right now. Please try again in a moment." },
      { status: 502 }
    );
  }

  const outfits = await Promise.all(
    valid.map((outfit) =>
      prisma.outfit.create({
        data: {
          userId: user.id,
          rationale: outfit.rationale,
          occasion: outfitRequest.occasion,
          weather: outfitRequest.weather,
          style: outfitRequest.style,
          items: { create: outfit.itemIds.map((itemId) => ({ itemId })) },
        },
        include: { items: { include: { item: true } } },
      })
    )
  );

  return NextResponse.json({ outfits: outfits.map(serializeOutfit) });
}
