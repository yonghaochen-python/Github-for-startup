import { NextResponse } from "next/server";
import { trackTimed } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withRetry } from "@/lib/dbRetry";
import { loadSavedImage } from "@/lib/images";
import { orderedLayerEntries, type LayeringRole } from "@/lib/layering";
import { runTryOn, TryOnError, type TryOnInputLayer } from "@/lib/tryOn";
import type { ImageBytes } from "@/lib/tryOn/types";
import { isSavedPhotoKey, loadPersonalPhoto, saveCurrentLook, saveOutfitTryOn } from "@/lib/personalPhoto";

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_GARMENT_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const STATUS_BY_CODE = { not_configured: 503, quota_exhausted: 503, rate_limited: 429, provider_error: 502 } as const;
const noStore = { "cache-control": "no-store" };

/**
 * Runs a try-on for one of the user's outfits. The person's photo either arrives with the request or is their
 * saved try-on photo (loaded privately from storage); either way it is held in memory for this call only and
 * handed to the replaceable provider (lib/tryOn). This route never stores the photo itself; a real result made
 * from the saved photo is kept privately as the person's current look. Garment photos may be sent too (already shrunk by the browser, as
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
  if (!formData) {
    return NextResponse.json({ error: "Add a photo of yourself first." }, { status: 400, headers: noStore });
  }
  // A photo sent with the request wins; otherwise the person's saved try-on photo is used.
  const sent = formData.get("photo");
  let person: ImageBytes | null = null;
  if (sent instanceof File) {
    if (!ACCEPTED_TYPES.includes(sent.type)) {
      return NextResponse.json({ error: "Please use a JPG, PNG, or WebP photo." }, { status: 400, headers: noStore });
    }
    if (sent.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "That photo is too large. Please use one under 12MB." }, { status: 413, headers: noStore });
    }
    person = { bytes: new Uint8Array(await sent.arrayBuffer()), mediaType: sent.type };
  } else if (isSavedPhotoKey(user.selfieUrl)) {
    person = await loadPersonalPhoto(user.selfieUrl);
  }
  if (!person) {
    return NextResponse.json({ error: "Add a photo of yourself first." }, { status: 400, headers: noStore });
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
        color: i.color,
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

    const result = await trackTimed(user.id, "tryon", () => runTryOn({ person, layers, garmentSheet }, user.id));

    // A real result made from the saved photo becomes the person's current look until they change it, and
    // stays with this outfit so its saved look shows it on them.
    const keep = !result.isMock && result.imageDataUrl && !(sent instanceof File) ? result.imageDataUrl : null;
    const [look] = keep
      ? await Promise.all([
          saveCurrentLook(user.id, outfit.id, keep).catch((err) => {
            console.error("Couldn't keep the try-on as the current look:", err);
            return null;
          }),
          saveOutfitTryOn(user.id, outfit.id, keep).catch((err) => console.error("Couldn't keep the outfit's try-on:", err)),
        ])
      : [null];

    return NextResponse.json({ result, look }, { headers: noStore });
  } catch (err) {
    if (err instanceof TryOnError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS_BY_CODE[err.code], headers: noStore });
    }
    console.error("Try-on failed:", err);
    return NextResponse.json({ error: "Couldn't run the try-on right now. Please try again." }, { status: 500, headers: noStore });
  }
}
