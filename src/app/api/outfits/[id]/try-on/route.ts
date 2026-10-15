import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withRetry } from "@/lib/dbRetry";
import { loadSavedImage } from "@/lib/images";
import { orderedLayerEntries, type LayeringRole } from "@/lib/layering";
import { runTryOn, TryOnError, type TryOnInputLayer } from "@/lib/tryOn";

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_GARMENT_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const STATUS_BY_CODE = { not_configured: 503, quota_exhausted: 503, rate_limited: 429, provider_error: 502 } as const;
const noStore = { "cache-control": "no-store" };

/**
 * Runs a try-on for one of the user's outfits. The person's photo arrives with the request, is held in
 * memory for this call only, and is handed to the replaceable provider (lib/tryOn). It is never written
 * to storage or the database. Garment photos may be sent too (already shrunk by the browser, as
 * `garment:<itemId>`); only items that really belong to this outfit are used, and any without one fall
 * back to the stored closet photo. A `garmentSheet` (every piece on one canvas) may also be sent for
 * providers that take the whole outfit in one call.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/outfits/[id]/try-on">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const formData = await request.formData().catch(() => null);
  const photo = formData?.get("photo");
  if (!formData || !(photo instanceof File)) {
    return NextResponse.json({ error: "Add a photo of yourself first." }, { status: 400, headers: noStore });
  }
  if (!ACCEPTED_TYPES.includes(photo.type)) {
    return NextResponse.json({ error: "Please use a JPG, PNG, or WebP photo." }, { status: 400, headers: noStore });
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "That photo is too large. Please use one under 12MB." }, { status: 413, headers: noStore });
  }

  const { id } = await ctx.params;
  try {
    const outfit = await withRetry(() =>
      prisma.outfit.findUnique({
        where: { id },
        include: { items: { include: { item: true } } },
      })
    );
    if (!outfit || outfit.userId !== user.id) {
      return NextResponse.json({ error: "Outfit not found." }, { status: 404, headers: noStore });
    }

    const layers: TryOnInputLayer[] = orderedLayerEntries(outfit.items.map((oi) => oi.item)).map(({ role, items }) => ({
      role,
      items: items.map((i) => ({
        id: i.id,
        imageUrl: i.imageUrl,
        description: i.description,
        layeringRole: i.layeringRole as LayeringRole,
        getImage: async () => {
          const supplied = formData.get(`garment:${i.id}`);
          if (supplied instanceof File && ACCEPTED_TYPES.includes(supplied.type) && supplied.size <= MAX_GARMENT_BYTES) {
            return { bytes: new Uint8Array(await supplied.arrayBuffer()), mediaType: supplied.type };
          }
          const saved = await loadSavedImage(i.imageUrl);
          return { bytes: new Uint8Array(Buffer.from(saved.base64, "base64")), mediaType: saved.mediaType };
        },
      })),
    }));
    if (layers.length === 0) {
      return NextResponse.json({ error: "This outfit has no items to try on." }, { status: 400, headers: noStore });
    }

    const sheet = formData.get("garmentSheet");
    const garmentSheet =
      sheet instanceof File && ACCEPTED_TYPES.includes(sheet.type) && sheet.size <= MAX_GARMENT_BYTES
        ? { bytes: new Uint8Array(await sheet.arrayBuffer()), mediaType: sheet.type }
        : undefined;

    const result = await runTryOn(
      { person: { bytes: new Uint8Array(await photo.arrayBuffer()), mediaType: photo.type }, layers, garmentSheet },
      user.id
    );

    return NextResponse.json({ result }, { headers: noStore });
  } catch (err) {
    if (err instanceof TryOnError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS_BY_CODE[err.code], headers: noStore });
    }
    console.error("Try-on failed:", err);
    return NextResponse.json({ error: "Couldn't run the try-on right now. Please try again." }, { status: 500, headers: noStore });
  }
}
