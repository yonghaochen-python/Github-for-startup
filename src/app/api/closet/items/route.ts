import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedImage } from "@/lib/images";
import { classifyClothingImage } from "@/lib/classify";
import { requireUser } from "@/lib/auth";
import { withRetry } from "@/lib/dbRetry";
import { removeBackground } from "@/lib/visualAssets";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  try {
    const items = await withRetry(() =>
      prisma.clothingItem.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      })
    );
    return NextResponse.json({ items });
  } catch (err) {
    console.error("Failed to load closet items:", err);
    return NextResponse.json({ error: "Couldn't load your closet right now." }, { status: 500 });
  }
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

  const results = await Promise.allSettled(
    files.map(async (file) => {
      const image = await saveUploadedImage(file);
      const [isolatedUrl, attributes] = await Promise.all([
        removeBackground(image.url),
        classifyClothingImage(image),
      ]);
      return prisma.clothingItem.create({
        data: { userId: user.id, imageUrl: isolatedUrl, ...attributes },
      });
    })
  );

  const items = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const failedCount = results.length - items.length;
  for (const r of results) {
    if (r.status === "rejected") console.error("Failed to process an uploaded photo:", r.reason);
  }

  if (items.length === 0) {
    return NextResponse.json(
      { error: "Couldn't process any of those photos. Use JPG, PNG, GIF, or WebP images." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      items,
      ...(failedCount > 0 && {
        warning: `${failedCount} of ${results.length} photos couldn't be processed and ${failedCount === 1 ? "was" : "were"} skipped.`,
      }),
    },
    { status: 201 }
  );
}
