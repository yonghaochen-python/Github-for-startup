import { NextResponse } from "next/server";
import { limitMessage, reserveCredit, settleCredit } from "@/lib/credits";
import { randomUUID } from "node:crypto";
import { newMeter } from "@/lib/anthropic";
import { track, trackAiCost } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { saveUploadedImage } from "@/lib/images";
import { classifyClothingImage } from "@/lib/classify";
import { asResponse, requireUser } from "@/lib/auth";
import { withRetry } from "@/lib/dbRetry";
import { removeBackground } from "@/lib/visualAssets";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
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
    return asResponse(res);
  }

  const formData = await request.formData();
  const files = formData.getAll("images").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No images provided under the 'images' field." }, { status: 400 });
  }

  const meter = newMeter();
  // One clothing photo per photo tagged (the trial's first); a photo over the limit isn't saved or sent.
  let limitNote: string | null = null;
  const results = await Promise.allSettled(
    files.map(async (file) => {
      const requestId = `closet-${randomUUID()}`;
      const reservation = await reserveCredit(user, "closet", requestId, { trial: { kind: "closet" } });
      if (!reservation.ok) {
        limitNote = limitMessage("closet", reservation);
        throw new Error("no_credits");
      }
      try {
        const image = await saveUploadedImage(file);
        const [isolatedUrl, attributes] = await Promise.all([
          removeBackground(image.url),
          classifyClothingImage(image, meter),
        ]);
        const item = await prisma.clothingItem.create({
          data: { userId: user.id, imageUrl: isolatedUrl, ...attributes },
        });
        await settleCredit(user.id, requestId, "completed").catch(() => {});
        return item;
      } catch (err) {
        await settleCredit(user.id, requestId, "released", "failed").catch(() => {});
        throw err;
      }
    })
  );

  await trackAiCost(user.id, "ai_cost_closet", meter);
  const items = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const failedCount = results.length - items.length;
  for (const r of results) {
    if (r.status === "rejected") console.error("Failed to process an uploaded photo:", r.reason);
  }

  if (items.length === 0 && limitNote) {
    return NextResponse.json({ error: limitNote, code: "no_credits" }, { status: 402 });
  }
  if (items.length === 0) {
    return NextResponse.json(
      { error: "Couldn't process any of those photos. Use JPG, PNG, GIF, or WebP images." },
      { status: 400 }
    );
  }

  if (items.length > 0) await track(user.id, "clothes_added");

  return NextResponse.json(
    {
      items,
      ...(failedCount > 0 && {
        // Over the limit: say which allowance stopped them, not that the photos were bad.
        warning: limitNote ?? `${failedCount} of ${results.length} photos couldn't be processed and ${failedCount === 1 ? "was" : "were"} skipped.`,
      }),
    },
    { status: 201 }
  );
}
