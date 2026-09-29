import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { saveUploadedImage, deleteSavedImage } from "@/lib/images";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const formData = await request.formData();
  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo provided under the 'photo' field." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id: user.id } });
  if (existing?.selfieUrl) {
    await deleteSavedImage(existing.selfieUrl).catch(() => {});
  }

  const image = await saveUploadedImage(file);
  await prisma.user.update({ where: { id: user.id }, data: { selfieUrl: image.url } });

  return NextResponse.json({ selfieUrl: image.url });
}

export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const existing = await prisma.user.findUnique({ where: { id: user.id } });
  if (existing?.selfieUrl) {
    await deleteSavedImage(existing.selfieUrl).catch(() => {});
  }
  await prisma.user.update({ where: { id: user.id }, data: { selfieUrl: null } });

  return NextResponse.json({ ok: true });
}
