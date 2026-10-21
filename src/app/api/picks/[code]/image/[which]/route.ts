import { findOpenPick, loadPickImage, PICK_IMAGES, type PickImage } from "@/lib/picks";

/** A pick's pictures (A, B, or the side-by-side card used for link previews), for anyone with the link while it's open. */
export async function GET(_request: Request, ctx: RouteContext<"/api/picks/[code]/image/[which]">) {
  const { code, which } = await ctx.params;
  const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  if (!PICK_IMAGES.includes(which as PickImage)) return notFound();
  const pick = await findOpenPick(code);
  if (!pick) return notFound();
  const image = await loadPickImage(pick.id, which as PickImage);
  if (!image) return notFound();
  // Short caching only: once the pick ends, the pictures should stop showing.
  return new Response(new Blob([new Uint8Array(image.bytes)]), {
    headers: { "cache-control": "public, max-age=60", "content-type": image.mediaType, "x-content-type-options": "nosniff" },
  });
}
