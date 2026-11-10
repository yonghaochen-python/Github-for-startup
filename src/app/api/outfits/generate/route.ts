import { NextResponse } from "next/server";
import { limitMessage, reserveCredit, settleCredit } from "@/lib/credits";
import { randomUUID } from "node:crypto";
import { newMeter } from "@/lib/anthropic";
import { track, trackAiCost, trackTimed } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { generateOutfitsFromCloset, type OutfitRequest } from "@/lib/generateOutfits";
import { asResponse, requireUser } from "@/lib/auth";
import { serializeOutfit } from "@/lib/outfits";
import { sanitizeLayeredOutfit } from "@/lib/layering";
import { readSavedSearch, saveSearch, searchKey } from "@/lib/styleSearchCache";
import { styleProfileFor } from "@/lib/studioReports";
import { profileColors } from "@/lib/styleProfile";

function str(value: unknown, maxLength = 200): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

const MAX_THEME_LENGTH = 120;

/** Style it is free, but each search is a paid AI call: at most this many per person in any 24 hours (Shuffle is unlimited). */
const DAILY_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }

  const body: unknown = await request.json().catch(() => ({}));
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const theme = str(b.theme, MAX_THEME_LENGTH);
  // "New ideas": skip the saved result and ask the AI again.
  const fresh = b.fresh === true;
  const outfitRequest: OutfitRequest = {
    theme,
    // A searched theme doubles as the outfit's label (shown as its occasion on cards).
    occasion: theme ?? str(b.occasion),
    weather: str(b.weather),
    style: str(b.style),
    colorPreference: str(b.colorPreference),
    prompt: str(b.prompt),
  };

  // The AI Stylist profile, when there is one (read from saved reports; no extra AI call): the ideas lean toward
  // their style direction and their colors. A few words more in the same request, so the cost doesn't change.
  const profile = await styleProfileFor(user.id).catch(() => null);
  if (profile?.style && !outfitRequest.style) {
    outfitRequest.style = `${profile.style.direction} (${profile.style.keywords.join(", ")})`.slice(0, 200);
  }
  if (profile && !outfitRequest.colorPreference) {
    const { wear, avoid } = profileColors(profile);
    if (wear.length) {
      outfitRequest.colorPreference = [
        `Prefer pieces in colors that suit them: ${wear.slice(0, 8).map((c) => c.name).join(", ")}.`,
        avoid.length ? `Go easy on: ${avoid.slice(0, 4).map((c) => c.name).join(", ")}.` : "",
        "Neutrals are always fine.",
      ]
        .join(" ")
        .slice(0, 400);
    }
  }

  const closet = await prisma.clothingItem.findMany({ where: { userId: user.id } });
  if (closet.length < 2) {
    return NextResponse.json(
      { error: "Add at least 2 items to your closet before generating outfits." },
      { status: 400 }
    );
  }

  // The same search with the same closet: show the outfits already made for it (free, and not counted).
  const key = await searchKey(user.id, outfitRequest, closet);
  if (!fresh) {
    const saved = await readSavedSearch(user.id, key);
    if (saved) {
      const outfits = await prisma.outfit.findMany({
        where: { userId: user.id, id: { in: saved } },
        include: { items: { include: { item: true } } },
      });
      // Only if every saved outfit is still there, whole, in its order.
      if (outfits.length === saved.length && outfits.every((o) => o.items.length >= 2)) {
        const byId = new Map(outfits.map((o) => [o.id, o]));
        await track(user.id, "style_it_reused");
        return NextResponse.json({ outfits: saved.map((id) => serializeOutfit(byId.get(id)!)), saved: true });
      }
    }
  }

  // The limit: searches started in the last 24 hours (counted at the start, so a burst can't slip past it).
  if (user.role !== "admin") {
    const since = new Date(Date.now() - DAY_MS);
    const recent = await prisma.analyticsEvent.findMany({
      where: { userId: user.id, name: "outfit_request", createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
      take: DAILY_LIMIT,
    });
    if (recent.length >= DAILY_LIMIT) {
      // When the oldest of them is a day old, there's room again.
      const hours = Math.max(1, Math.ceil((recent[0].createdAt.getTime() + DAY_MS - Date.now()) / 3_600_000));
      return NextResponse.json(
        {
          error: `That's ${DAILY_LIMIT} Style it searches in 24 hours. Try again in about ${hours} ${hours === 1 ? "hour" : "hours"}; Shuffle still works anytime.`,
          code: "daily_limit",
        },
        { status: 429 }
      );
    }
  }

  // One Style It search from the person's allowance (the trial's first). A saved search shown again (above) is free.
  const requestId = `style-${randomUUID()}`;
  const reservation = await reserveCredit(user, "style", requestId, { trial: { kind: "style" } });
  if (!reservation.ok) return NextResponse.json({ error: limitMessage("style", reservation), code: "no_credits" }, { status: 402 });

  await track(user.id, "outfit_request");
  let generated;
  const meter = newMeter();
  try {
    generated = await trackTimed(user.id, "outfit_generate", () => generateOutfitsFromCloset(closet, outfitRequest, meter));
    await trackAiCost(user.id, "ai_cost_style_it", meter);
    await settleCredit(user.id, requestId, "completed").catch(() => {});
  } catch (err) {
    await trackAiCost(user.id, "ai_cost_style_it", meter, false);
    await settleCredit(user.id, requestId, "released", "failed").catch(() => {});
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

  await saveSearch(user.id, key, outfits.map((o) => o.id)).catch(() => {});
  return NextResponse.json({ outfits: outfits.map(serializeOutfit) });
}
