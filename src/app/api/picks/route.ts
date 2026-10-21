import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadOutfitTryOn } from "@/lib/personalPhoto";
import {
  deleteEndedPicks,
  deletePicks,
  MAX_LOOKS,
  MAX_OPEN_PICKS,
  MIN_LOOKS,
  newPickCode,
  PICK_HOURS,
  pickCounts,
  pickLabels,
  savePickImage,
  type PickImage,
} from "@/lib/picks";

const noStore = { "cache-control": "private, no-store" };
const MAX_CARD_BYTES = 3 * 1024 * 1024;
const LETTERS = "ABCD";

/** The signed-in person's open shares, newest first, with their votes so far. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  await deleteEndedPicks();
  const picks = await prisma.pick.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, labels: true, expiresAt: true },
  });
  const withCounts = await Promise.all(
    picks.map(async (pick) => {
      const labels = pickLabels(pick);
      return { code: pick.code, labels, counts: await pickCounts(pick.id, labels.length), expiresAt: pick.expiresAt };
    })
  );
  return NextResponse.json({ picks: withCounts }, { headers: noStore });
}

/**
 * Shares 2–4 of the person's tried-on looks. Their try-on pictures are copied for the link (so trying a look on
 * again later doesn't change what friends see), plus the side-by-side card the app made for link previews.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const formData = await request.formData().catch(() => null);
  const ids = (formData?.getAll("outfit") ?? []).map((v) => (typeof v === "string" ? v : ""));
  const card = formData?.get("card");
  if (ids.length < MIN_LOOKS || ids.length > MAX_LOOKS || ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: `Choose ${MIN_LOOKS} to ${MAX_LOOKS} different looks.` }, { status: 400, headers: noStore });
  }
  if (!(card instanceof File) || card.type !== "image/jpeg" || card.size > MAX_CARD_BYTES) {
    return NextResponse.json({ error: "Couldn't make the picture to share. Please try again." }, { status: 400, headers: noStore });
  }

  await deleteEndedPicks();
  const open = await prisma.pick.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } });
  if (open >= MAX_OPEN_PICKS) {
    return NextResponse.json({ error: "You're sharing lots of looks already. Stop one first." }, { status: 429, headers: noStore });
  }

  const outfits = await prisma.outfit.findMany({ where: { id: { in: ids }, userId: user.id }, select: { id: true, occasion: true } });
  const ordered = ids.map((id) => outfits.find((o) => o.id === id));
  if (ordered.some((o) => !o)) {
    return NextResponse.json({ error: "Look not found." }, { status: 404, headers: noStore });
  }
  const pictures = await Promise.all(ids.map((id) => loadOutfitTryOn(user.id, id)));
  if (pictures.some((p) => !p)) {
    return NextResponse.json({ error: "Try each look on first." }, { status: 400, headers: noStore });
  }

  const labels = ordered.map((o, i) => (o!.occasion?.trim() || `Look ${LETTERS[i]}`).slice(0, 40));
  const pick = await prisma.pick.create({
    data: {
      code: newPickCode(),
      userId: user.id,
      labels: JSON.stringify(labels),
      expiresAt: new Date(Date.now() + PICK_HOURS * 60 * 60 * 1000),
    },
  });
  try {
    await Promise.all([
      ...pictures.map((picture, i) => savePickImage(pick.id, String(i) as PickImage, picture!)),
      savePickImage(pick.id, "card", { bytes: new Uint8Array(await card.arrayBuffer()), mediaType: "image/jpeg" }),
    ]);
  } catch (err) {
    console.error("Couldn't store the shared looks' pictures:", err);
    await deletePicks([pick.id]).catch(() => {});
    return NextResponse.json({ error: "Couldn't make the link right now. Please try again." }, { status: 500, headers: noStore });
  }

  await track(user.id, "pick_created");
  return NextResponse.json({ code: pick.code, expiresAt: pick.expiresAt }, { status: 201, headers: noStore });
}
