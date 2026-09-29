import { NextResponse } from "next/server";
import { saveUploadedImage } from "@/lib/images";
import { detectClothingItems } from "@/lib/detectItems";
import { requireUser } from "@/lib/auth";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * Step 1-2 of the "Add Clothes" flow: save the photo and run detection over it.
 * Nothing is written to the closet yet — the client reviews/edits the detected
 * items and only persists them via POST /api/closet/items/bulk once confirmed.
 */
export async function POST(request: Request) {
  try {
    await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const formData = await request.formData();
  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo provided under the 'photo' field." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That photo is too large. Please use one under 20MB." }, { status: 400 });
  }

  let image;
  try {
    image = await saveUploadedImage(file);
  } catch (err) {
    console.error("Failed to save photo for detection:", err);
    return NextResponse.json(
      { error: "Couldn't read that photo. Use a JPG, PNG, GIF, or WebP image." },
      { status: 400 }
    );
  }

  try {
    const items = await detectClothingItems(image);
    return NextResponse.json({ imageUrl: image.url, items });
  } catch (err) {
    console.error("Item detection failed:", err);
    return NextResponse.json(
      { error: "Couldn't analyze that photo right now. Please try again." },
      { status: 502 }
    );
  }
}
