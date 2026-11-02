import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackTimed } from "@/lib/analytics";
import { StylistError, profileView, styleLook, withCorrections, type Corrections, type StyleReading } from "@/lib/stylist";

const MAX_OCCASION = 80;
const noStore = { "cache-control": "no-store" };

/**
 * A new look from the person's saved style profile (no photo, text only), optionally for an occasion. Like Studio's
 * "Style it", it doesn't use a try-on credit.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  const row = await prisma.styleProfile.findUnique({ where: { userId: user.id } });
  if (!row) return NextResponse.json({ error: "Get your style reading first." }, { status: 404, headers: noStore });

  const body = ((await request.json().catch(() => ({}))) ?? {}) as { occasion?: unknown };
  const occasion = typeof body.occasion === "string" && body.occasion.trim() ? body.occasion.trim().slice(0, MAX_OCCASION) : null;
  const closet = await prisma.clothingItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  if (closet.length < 2) {
    return NextResponse.json({ error: "Add at least 2 pieces to your closet first." }, { status: 400, headers: noStore });
  }

  try {
    const reading = withCorrections(JSON.parse(row.reading) as StyleReading, JSON.parse(row.corrections) as Corrections);
    const look = await trackTimed(user.id, "style_look", () => styleLook(reading, closet, occasion));
    const updated = await prisma.styleProfile.update({ where: { userId: user.id }, data: { look: JSON.stringify(look) } });
    return NextResponse.json({ profile: profileView(updated) }, { headers: noStore });
  } catch (err) {
    if (err instanceof StylistError) return NextResponse.json({ error: err.message }, { status: 422, headers: noStore });
    console.error("Stylist look failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Couldn't style a new look right now. Please try again in a moment." }, { status: 502, headers: noStore });
  }
}
