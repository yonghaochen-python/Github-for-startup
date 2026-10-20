import { NextResponse } from "next/server";
import { checkDetectedItems, type CheckCrop } from "@/lib/detectItems";
import type { SavedImage } from "@/lib/images";
import { requireUser } from "@/lib/auth";

const MAX_CROPS = 15;
const MAX_CROP_BYTES = 3 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Step 3 of the "Add Clothes" flow: the app sends a close-up of each detected item, and each is checked for the
 * item it's meant to show (and tightened). The close-ups are only read here, never stored.
 */
export async function POST(request: Request) {
  try {
    await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const formData = await request.formData();
  let meta: { name: string; description: string; width: number; height: number }[];
  try {
    meta = JSON.parse(String(formData.get("items")));
    if (!Array.isArray(meta)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Missing item list." }, { status: 400 });
  }
  const files = formData.getAll("crops");
  if (!meta.length || meta.length > MAX_CROPS || files.length !== meta.length) {
    return NextResponse.json({ error: "Expected one close-up per item." }, { status: 400 });
  }

  const crops: CheckCrop[] = [];
  for (const [i, file] of files.entries()) {
    const m = meta[i];
    if (!(file instanceof File) || !TYPES.includes(file.type) || file.size > MAX_CROP_BYTES || !(m?.width > 0 && m?.height > 0)) {
      return NextResponse.json({ error: "One of the close-ups couldn't be read." }, { status: 400 });
    }
    const image: SavedImage = {
      url: "",
      base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      mediaType: file.type as SavedImage["mediaType"],
    };
    crops.push({
      name: String(m.name ?? "").slice(0, 120),
      description: String(m.description ?? "").slice(0, 200),
      image,
      size: { width: Math.round(m.width), height: Math.round(m.height) },
    });
  }

  try {
    return NextResponse.json({ results: await checkDetectedItems(crops) });
  } catch (err) {
    console.error("Item check failed:", err);
    return NextResponse.json({ error: "Couldn't check those pieces right now. Please try again." }, { status: 502 });
  }
}
