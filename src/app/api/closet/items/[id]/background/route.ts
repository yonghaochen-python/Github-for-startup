import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asResponse, requireUser } from "@/lib/auth";
import { cutoutOriginal, isCutout, saveCutout } from "@/lib/images";
import { withRetry } from "@/lib/dbRetry";
import { env } from "cloudflare:workers";

/**
 * "Remove background" / "Keep background" for one closet piece. The cut-out itself is made on the person's device
 * (src/lib/cutout.ts) and sent here as a PNG; the original photo is never deleted, so switching back is instant.
 */
async function ownItem(request: Request, ctx: RouteContext<"/api/closet/items/[id]/background">) {
  const user = await requireUser(request);
  const { id } = await ctx.params;
  const item = await prisma.clothingItem.findFirst({ where: { id, userId: user.id }, select: { id: true, imageUrl: true } });
  return item;
}

/** Remove background: saves the cut-out and shows it instead of the photo. */
export async function POST(request: Request, ctx: RouteContext<"/api/closet/items/[id]/background">) {
  let item;
  try {
    item = await ownItem(request, ctx);
  } catch (res) {
    return asResponse(res);
  }
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("cutout");
  if (!(file instanceof File)) return NextResponse.json({ error: "No picture sent." }, { status: 400 });

  // Already a cut-out: replace it, but remember the true original. If that record can't be read, the old cut-out
  // itself becomes the "original", so it must not be deleted below (or Keep background would bring back nothing).
  const knownOriginal = isCutout(item.imageUrl) ? await withRetry(() => cutoutOriginal(item.imageUrl)).catch(() => null) : item.imageUrl;
  const original = knownOriginal ?? item.imageUrl;
  let url: string;
  try {
    url = await withRetry(() => saveCutout(original, file));
  } catch {
    return NextResponse.json({ error: "That picture couldn't be used." }, { status: 400 });
  }
  // Only if the picture is still the one read above (two quick changes can't cross over and lose a picture).
  const { count } = await withRetry(() => prisma.clothingItem.updateMany({ where: { id: item.id, imageUrl: item.imageUrl }, data: { imageUrl: url } }));
  if (count === 0) {
    await env.UPLOADS.delete(url.replace(/^\/uploads\//, "")).catch(() => {});
    const current = await prisma.clothingItem.findUnique({ where: { id: item.id } });
    return NextResponse.json({ item: current, error: "This piece just changed. Please try again." }, { status: 409 });
  }
  if (isCutout(item.imageUrl) && knownOriginal) await env.UPLOADS.delete(item.imageUrl.replace(/^\/uploads\//, "")).catch(() => {});
  const updated = await prisma.clothingItem.findUnique({ where: { id: item.id } });
  return NextResponse.json({ item: updated });
}

/** Keep background: goes back to the original photo. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/closet/items/[id]/background">) {
  let item;
  try {
    item = await ownItem(request, ctx);
  } catch (res) {
    return asResponse(res);
  }
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });
  if (!isCutout(item.imageUrl)) return NextResponse.json({ item });

  const original = await withRetry(() => cutoutOriginal(item.imageUrl)).catch(() => null);
  if (!original) return NextResponse.json({ error: "The original photo couldn't be found." }, { status: 409 });
  // The original must really still be there before switching to it.
  const exists = await withRetry(() => env.UPLOADS.head(original.replace(/^\/uploads\//, ""))).catch(() => null);
  if (original.startsWith("/uploads/") && !exists) {
    return NextResponse.json({ error: "The original photo couldn't be found." }, { status: 409 });
  }
  const { count } = await withRetry(() => prisma.clothingItem.updateMany({ where: { id: item.id, imageUrl: item.imageUrl }, data: { imageUrl: original } }));
  if (count === 0) return NextResponse.json({ error: "This piece just changed. Please try again." }, { status: 409 });
  await env.UPLOADS.delete(item.imageUrl.replace(/^\/uploads\//, "")).catch(() => {});
  const updated = await prisma.clothingItem.findUnique({ where: { id: item.id } });
  return NextResponse.json({ item: updated });
}
