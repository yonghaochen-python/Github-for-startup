import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedImage } from "@/lib/images";
import { requireUser } from "@/lib/auth";
import { CATEGORIES, FORMALITIES, SEASONS, type ClothingAttributes } from "@/lib/clothingTaxonomy";

function isValidItem(value: unknown): value is ClothingAttributes {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.category === "string" &&
    CATEGORIES.includes(v.category as (typeof CATEGORIES)[number]) &&
    typeof v.formality === "string" &&
    FORMALITIES.includes(v.formality as (typeof FORMALITIES)[number]) &&
    typeof v.season === "string" &&
    SEASONS.includes(v.season as (typeof SEASONS)[number]) &&
    typeof v.color === "string" &&
    v.color.trim().length > 0 &&
    typeof v.pattern === "string" &&
    v.pattern.trim().length > 0 &&
    typeof v.material === "string" &&
    v.material.trim().length > 0 &&
    typeof v.description === "string" &&
    v.description.trim().length > 0
  );
}

/**
 * Step 4 of the "Add Clothes" flow: persist the items the user reviewed and
 * confirmed (already-classified, no AI call here) as separate closet entries,
 * each with its own cropped image.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const formData = await request.formData();
  const files = formData.getAll("images").filter((f): f is File => f instanceof File);
  const itemsRaw = formData.get("items");

  if (files.length === 0) {
    return NextResponse.json({ error: "No items to add." }, { status: 400 });
  }
  if (typeof itemsRaw !== "string") {
    return NextResponse.json({ error: "Missing item metadata." }, { status: 400 });
  }

  let parsedItems: unknown;
  try {
    parsedItems = JSON.parse(itemsRaw);
  } catch {
    return NextResponse.json({ error: "Malformed item metadata." }, { status: 400 });
  }

  if (!Array.isArray(parsedItems) || parsedItems.length !== files.length) {
    return NextResponse.json({ error: "Item metadata doesn't match the uploaded photos." }, { status: 400 });
  }
  if (!parsedItems.every(isValidItem)) {
    return NextResponse.json({ error: "One or more items has invalid or missing details." }, { status: 400 });
  }

  const results = await Promise.allSettled(
    files.map(async (file, i) => {
      const image = await saveUploadedImage(file);
      const attributes = parsedItems[i] as ClothingAttributes;
      return prisma.clothingItem.create({
        data: { userId: user.id, imageUrl: image.url, ...attributes },
      });
    })
  );

  const items = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const failedCount = results.length - items.length;
  for (const r of results) {
    if (r.status === "rejected") console.error("Failed to save a confirmed closet item:", r.reason);
  }

  if (items.length === 0) {
    return NextResponse.json({ error: "Couldn't add any of those items. Please try again." }, { status: 500 });
  }

  return NextResponse.json(
    {
      items,
      ...(failedCount > 0 && {
        warning: `${failedCount} of ${results.length} items couldn't be saved and ${failedCount === 1 ? "was" : "were"} skipped.`,
      }),
    },
    { status: 201 }
  );
}
