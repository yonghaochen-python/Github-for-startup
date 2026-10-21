import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadOutfitTryOn } from "@/lib/personalPhoto";
import { deleteEndedPicks, deletePicks, MAX_OPEN_PICKS, newPickCode, PICK_HOURS, savePickImage } from "@/lib/picks";

const noStore = { "cache-control": "private, no-store" };
const MAX_CARD_BYTES = 3 * 1024 * 1024;

/** The signed-in person's open picks, newest first, with their votes so far. */
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
    select: { code: true, labelA: true, labelB: true, votesA: true, votesB: true, expiresAt: true },
  });
  return NextResponse.json({ picks }, { headers: noStore });
}

/**
 * Starts a pick from two of the person's tried-on looks. The two try-on pictures are copied for the link (so
 * trying either look on again later doesn't change what friends see), plus the side-by-side card the app made
 * for link previews.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const formData = await request.formData().catch(() => null);
  const ids = [formData?.get("outfitA"), formData?.get("outfitB")].map((v) => (typeof v === "string" ? v : ""));
  const card = formData?.get("card");
  if (!ids[0] || !ids[1] || ids[0] === ids[1]) {
    return NextResponse.json({ error: "Choose two different looks." }, { status: 400, headers: noStore });
  }
  if (!(card instanceof File) || card.type !== "image/jpeg" || card.size > MAX_CARD_BYTES) {
    return NextResponse.json({ error: "Couldn't make the picture to share. Please try again." }, { status: 400, headers: noStore });
  }

  await deleteEndedPicks();
  const open = await prisma.pick.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } });
  if (open >= MAX_OPEN_PICKS) {
    return NextResponse.json({ error: "You have lots of picks going. End one first." }, { status: 429, headers: noStore });
  }

  const outfits = await prisma.outfit.findMany({ where: { id: { in: ids }, userId: user.id }, select: { id: true, occasion: true } });
  const ordered = ids.map((id) => outfits.find((o) => o.id === id));
  if (ordered.some((o) => !o)) {
    return NextResponse.json({ error: "Look not found." }, { status: 404, headers: noStore });
  }
  const pictures = await Promise.all(ids.map((id) => loadOutfitTryOn(user.id, id)));
  if (pictures.some((p) => !p)) {
    return NextResponse.json({ error: "Try both looks on first." }, { status: 400, headers: noStore });
  }

  const label = (occasion: string | null | undefined, fallback: string) => (occasion?.trim() || fallback).slice(0, 40);
  const pick = await prisma.pick.create({
    data: {
      code: newPickCode(),
      userId: user.id,
      labelA: label(ordered[0]!.occasion, "Look A"),
      labelB: label(ordered[1]!.occasion, "Look B"),
      expiresAt: new Date(Date.now() + PICK_HOURS * 60 * 60 * 1000),
    },
  });
  try {
    await Promise.all([
      savePickImage(pick.id, "a", pictures[0]!),
      savePickImage(pick.id, "b", pictures[1]!),
      savePickImage(pick.id, "card", { bytes: new Uint8Array(await card.arrayBuffer()), mediaType: "image/jpeg" }),
    ]);
  } catch (err) {
    console.error("Couldn't store the pick's pictures:", err);
    await deletePicks([pick.id]).catch(() => {});
    return NextResponse.json({ error: "Couldn't start the pick right now. Please try again." }, { status: 500, headers: noStore });
  }

  await track(user.id, "pick_created");
  return NextResponse.json({ code: pick.code, expiresAt: pick.expiresAt }, { status: 201, headers: noStore });
}
