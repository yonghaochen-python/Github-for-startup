import { requireUser } from "@/lib/auth";
import { loadOutfitTryOn } from "@/lib/personalPhoto";

/** This outfit's latest try-on picture. Owner-only: pictures are stored under the signed-in person's own id. */
export async function GET(request: Request, ctx: RouteContext<"/api/outfits/[id]/try-on/image">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  const { id } = await ctx.params;
  const image = await loadOutfitTryOn(user.id, id);
  if (!image) return new Response("Not found", { status: 404, headers: { "cache-control": "private, no-store" } });
  // The URL carries a version that changes with each new try-on, so the browser may keep this privately.
  return new Response(new Blob([new Uint8Array(image.bytes)]), {
    headers: { "cache-control": "private, max-age=31536000, immutable", "content-type": image.mediaType, "x-content-type-options": "nosniff" },
  });
}
