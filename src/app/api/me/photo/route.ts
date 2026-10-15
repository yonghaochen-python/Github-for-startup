import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  MAX_PHOTO_BYTES,
  PHOTO_TYPES,
  deletePersonalPhoto,
  isSavedPhotoKey,
  loadPersonalPhoto,
  photoVersion,
  savePersonalPhoto,
} from "@/lib/personalPhoto";

const noStore = { "cache-control": "private, no-store" };

/** The signed-in person's saved try-on photo. Only its owner can read it; it is never cached publicly. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  if (!isSavedPhotoKey(user.selfieUrl)) return new Response("Not found", { status: 404, headers: noStore });

  const photo = await loadPersonalPhoto(user.selfieUrl);
  if (!photo) return new Response("Not found", { status: 404, headers: noStore });
  return new Response(new Blob([new Uint8Array(photo.bytes)]), {
    headers: { ...noStore, "content-type": photo.mediaType, "x-content-type-options": "nosniff" },
  });
}

/** Saves (or replaces) the person's try-on photo. Only called when they press "Save My Photo". */
export async function PUT(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const formData = await request.formData().catch(() => null);
  const photo = formData?.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "Choose a photo first." }, { status: 400, headers: noStore });
  }
  if (!PHOTO_TYPES.includes(photo.type)) {
    return NextResponse.json({ error: "Please use a JPG, PNG, or WebP photo." }, { status: 400, headers: noStore });
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "That photo is too large. Please use one under 12MB." }, { status: 413, headers: noStore });
  }

  try {
    const key = await savePersonalPhoto(user.id, { bytes: new Uint8Array(await photo.arrayBuffer()), mediaType: photo.type });
    await prisma.user.update({ where: { id: user.id }, data: { selfieUrl: key } });
    // Remove the photo this one replaces, once the new one is safely recorded.
    if (isSavedPhotoKey(user.selfieUrl)) await deletePersonalPhoto(user.selfieUrl).catch(() => {});
    return NextResponse.json({ photoVersion: photoVersion(key) }, { headers: noStore });
  } catch (err) {
    console.error("Failed to save try-on photo:", err);
    return NextResponse.json({ error: "Couldn't save your photo right now. Please try again." }, { status: 500, headers: noStore });
  }
}

/** Deletes the saved photo from storage and the account. */
export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  try {
    await prisma.user.update({ where: { id: user.id }, data: { selfieUrl: null } });
    if (isSavedPhotoKey(user.selfieUrl)) await deletePersonalPhoto(user.selfieUrl);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    console.error("Failed to remove try-on photo:", err);
    return NextResponse.json({ error: "Couldn't remove your photo right now. Please try again." }, { status: 500, headers: noStore });
  }
}
