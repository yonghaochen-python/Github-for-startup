import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackTimed } from "@/lib/analytics";
import { CreditError, requestIdFrom, withCredit } from "@/lib/credits";
import { BODY_SHAPES, UNDERTONES, StylistError, parseJson, profileView, readStyle, type Corrections, type StyledLook, type StyledPiece } from "@/lib/stylist";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
// The page shrinks the photo before sending it; this is a safety limit.
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const noStore = { "cache-control": "no-store" };

async function signedIn(request: Request) {
  try {
    return { user: await requireUser(request) };
  } catch (res) {
    return { res: res as Response };
  }
}

export async function GET(request: Request) {
  const { user, res } = await signedIn(request);
  if (!user) return res;
  const row = await prisma.styleProfile.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ profile: row ? profileView(row) : null }, { headers: noStore });
}

/**
 * A new style reading from a photo the person chose (sent by the page, already shrunk). One photo credit, counted
 * only when a real reading comes back. The photo is passed to the AI and not stored; only the written results are.
 */
export async function POST(request: Request) {
  const { user, res } = await signedIn(request);
  if (!user) return res;

  const formData = await request.formData().catch(() => null);
  const photo = formData?.get("photo");
  if (!(photo instanceof File) || !PHOTO_TYPES.includes(photo.type) || photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Choose a clear JPG or PNG photo." }, { status: 400, headers: noStore });
  }
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const closet = await prisma.clothingItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });

  try {
    const result = await withCredit(
      user,
      "photo",
      requestIdFrom(formData?.get("requestId")),
      () => trackTimed(user.id, "style_reading", () => readStyle({ bytes, mediaType: photo.type }, closet)),
      (r) => !r.reading.practice
    );
    // A new reading starts fresh: earlier corrections were about the earlier photo.
    const data = { reading: JSON.stringify(result.reading), corrections: "{}", look: result.look ? JSON.stringify(result.look) : null };
    const row = await prisma.styleProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    return NextResponse.json({ profile: profileView(row) }, { headers: noStore });
  } catch (err) {
    if (err instanceof CreditError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "duplicate" ? 409 : 402, headers: noStore });
    }
    if (err instanceof StylistError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422, headers: noStore });
    }
    console.error("Style reading failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "The stylist couldn't read that photo right now. Please try again in a moment." }, { status: 502, headers: noStore });
  }
}

/** The person's own corrections (undertone, body shape), or edits to the look (a piece swapped or taken out). */
export async function PATCH(request: Request) {
  const { user, res } = await signedIn(request);
  if (!user) return res;
  const row = await prisma.styleProfile.findUnique({ where: { userId: user.id } });
  if (!row) return NextResponse.json({ error: "Get your style reading first." }, { status: 404, headers: noStore });

  const body = ((await request.json().catch(() => ({}))) ?? {}) as { corrections?: Record<string, unknown>; pieces?: unknown };
  const data: { corrections?: string; look?: string } = {};

  if (body.corrections) {
    const next: Corrections = {};
    const { undertone, bodyShape } = body.corrections;
    if ((UNDERTONES as readonly unknown[]).includes(undertone)) next.undertone = undertone as Corrections["undertone"];
    if ((BODY_SHAPES as readonly unknown[]).includes(bodyShape)) next.bodyShape = bodyShape as Corrections["bodyShape"];
    data.corrections = JSON.stringify(next);
  }

  if (Array.isArray(body.pieces)) {
    const look = parseJson<StyledLook | null>(row.look, null);
    if (!look) return NextResponse.json({ error: "There's no look to change." }, { status: 404, headers: noStore });
    // The page sends the look as it now stands; only this person's own pieces are kept, alternates of the same kind.
    const sent = body.pieces.slice(0, 8).filter((p): p is StyledPiece => typeof p?.itemId === "string" && Array.isArray(p?.alternates));
    const ids = [...new Set(sent.flatMap((p) => [p.itemId, ...p.alternates]))].filter((id) => typeof id === "string");
    const closet = await prisma.clothingItem.findMany({ where: { userId: user.id, id: { in: ids } }, select: { id: true, category: true } });
    const category = new Map(closet.map((i) => [i.id, i.category]));
    const pieces = sent
      .filter((p) => category.has(p.itemId))
      .map((p) => ({
        itemId: p.itemId,
        why: typeof p.why === "string" ? p.why.slice(0, 240) : "",
        alternates: [...new Set(p.alternates)].filter((a) => a !== p.itemId && category.get(a) === category.get(p.itemId)).slice(0, 4),
      }));
    data.look = JSON.stringify({ ...look, pieces });
  }

  const updated = await prisma.styleProfile.update({ where: { userId: user.id }, data });
  return NextResponse.json({ profile: profileView(updated) }, { headers: noStore });
}

/** Deletes the person's style profile. */
export async function DELETE(request: Request) {
  const { user, res } = await signedIn(request);
  if (!user) return res;
  await prisma.styleProfile.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
