import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { LAYERING_ROLES } from "@/lib/clothingTaxonomy";
import { orderedLayerEntries, type LayeringRole } from "@/lib/layering";
import { isSavedPhotoKey, loadPersonalPhoto } from "@/lib/personalPhoto";
import { runTryOn, TryOnError, type TryOnInputItem } from "@/lib/tryOn";
import type { ImageBytes } from "@/lib/tryOn/types";

const MAX_PIECES = 6;
const MAX_GARMENT_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const STATUS_BY_CODE = { not_configured: 503, quota_exhausted: 503, rate_limited: 429, provider_error: 502 } as const;
const noStore = { "cache-control": "no-store" };

type Piece = { description: string; color: string; layeringRole: LayeringRole };

function readPieces(raw: FormDataEntryValue | null): Piece[] | null {
  try {
    const list = JSON.parse(typeof raw === "string" ? raw : "");
    if (!Array.isArray(list) || list.length === 0 || list.length > MAX_PIECES) return null;
    return list.map((p) => {
      const role = (LAYERING_ROLES as readonly string[]).includes(p?.layeringRole) ? (p.layeringRole as LayeringRole) : null;
      if (!role || typeof p.description !== "string") throw new Error("piece");
      return { description: p.description.slice(0, 120), color: typeof p.color === "string" ? p.color.slice(0, 40) : "", layeringRole: role };
    });
  } catch {
    return null;
  }
}

async function readImage(entry: FormDataEntryValue | null): Promise<ImageBytes | null> {
  if (!(entry instanceof File) || !ACCEPTED_TYPES.includes(entry.type) || entry.size > MAX_GARMENT_BYTES) return null;
  return { bytes: new Uint8Array(await entry.arrayBuffer()), mediaType: entry.type };
}

/**
 * Photo try-on for Shopping pieces (catalog items or imported pictures) on the person's saved full-body photo.
 * The garment pictures come from the browser (already shrunk) as `garment:<n>`, described in `pieces`. It uses the
 * same provider and hourly limit as the Studio try-on, but nothing is written to the closet, outfits or storage:
 * the picture is returned once and not kept.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const formData = await request.formData().catch(() => null);
  const pieces = readPieces(formData?.get("pieces") ?? null);
  if (!formData || !pieces) {
    return NextResponse.json({ error: "Pick a piece to try on." }, { status: 400, headers: noStore });
  }
  const images = await Promise.all(pieces.map((_, i) => readImage(formData.get(`garment:${i}`))));
  if (images.some((img) => !img)) {
    return NextResponse.json({ error: "That piece's picture couldn't be used. Try a clear JPG or PNG under 4MB." }, { status: 400, headers: noStore });
  }
  const person = isSavedPhotoKey(user.selfieUrl) ? await loadPersonalPhoto(user.selfieUrl) : null;
  if (!person) {
    return NextResponse.json({ error: "Add a full-body photo in Profile first.", code: "no_photo" }, { status: 400, headers: noStore });
  }

  const items: TryOnInputItem[] = pieces.map((p, i) => ({
    id: `shop-${i}`,
    imageUrl: "",
    description: p.description,
    color: p.color,
    layeringRole: p.layeringRole,
    getImage: async () => images[i]!,
  }));
  const garmentSheet = (await readImage(formData.get("garmentSheet"))) ?? undefined;

  try {
    const result = await runTryOn({ person, layers: orderedLayerEntries(items), garmentSheet }, user.id);
    return NextResponse.json({ result }, { headers: noStore });
  } catch (err) {
    if (err instanceof TryOnError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS_BY_CODE[err.code], headers: noStore });
    }
    console.error("Shop try-on failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Couldn't run the try-on right now. Please try again." }, { status: 500, headers: noStore });
  }
}
