import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedImage } from "@/lib/images";
import { classifyClothingImage } from "@/lib/classify";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const items = await prisma.clothingItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const formData = await request.formData();
  const files = formData.getAll("images").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No images provided under the 'images' field." }, { status: 400 });
  }

  const items = await Promise.all(
    files.map(async (file) => {
      const image = await saveUploadedImage(file);
      const attributes = await classifyClothingImage(image);
      return prisma.clothingItem.create({
        data: { userId: user.id, imageUrl: image.url, ...attributes },
      });
    })
  );

  return NextResponse.json({ items }, { status: 201 });
}
