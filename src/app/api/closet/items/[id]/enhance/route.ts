import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { prisma } from "@/lib/prisma";
import { asResponse, requireAdmin, requireUser } from "@/lib/auth";
import { withRetry } from "@/lib/dbRetry";
import { cutoutOriginal, isCutout } from "@/lib/images";
import { EnhanceError, enhancePicture, saveEnhanced, type EnhanceMode } from "@/lib/enhance";
import { track } from "@/lib/analytics";
import { ENHANCE_MICROS } from "@/lib/aiCosts";

/**
 * AI clothing enhancement for one closet piece (admins only for now; no credits used).
 * - POST { mode?: "tidy" | "flat" }: the tidied version ("flat": unfolded and laid flat) of the piece's plain picture (made once by FLUX 3, then kept; the same picture is never
 *   sent again). Nothing on the piece changes yet.
 * - PUT: saves the enhanced picture the device prepared (background removed) and shows it. The plain picture and the
 *   uploaded original are never changed or deleted.
 * - PATCH { show: "enhanced" | "original" }: switches which picture is shown. No AI, no cost.
 */
type Ctx = RouteContext<"/api/closet/items/[id]/enhance">;
const noStore = { "cache-control": "private, no-store" };
const STATUS = { not_configured: 503, declined: 422, busy: 429, failed: 502, too_large: 413 } as const;

async function loadItem(userId: string, ctx: Ctx) {
  const { id } = await ctx.params;
  return prisma.clothingItem.findFirst({ where: { id, userId }, select: { id: true, imageUrl: true, plainUrl: true, enhancedUrl: true, description: true, color: true } });
}

/** The picture enhancement works from: the plain one (never an enhanced one). */
const plainOf = (item: { imageUrl: string; plainUrl: string | null; enhancedUrl: string | null }) =>
  item.enhancedUrl && item.imageUrl === item.enhancedUrl ? (item.plainUrl ?? item.imageUrl) : item.imageUrl;

export async function POST(request: Request, ctx: Ctx) {
  let user;
  try {
    user = await requireAdmin(request);
  } catch (res) {
    return asResponse(res);
  }
  const item = await loadItem(user.id, ctx);
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404, headers: noStore });
  // The AI gets the original photo, not a cut-out: a cut-out's rough or see-through edges (often at the sleeves) would
  // be copied into the result. The result's background is removed on the device afterwards, as before.
  const plain = plainOf(item);
  const source = isCutout(plain) ? ((await cutoutOriginal(plain).catch(() => null)) ?? plain) : plain;
  if (!source.startsWith("/uploads/")) return NextResponse.json({ error: "This picture can't be enhanced." }, { status: 400, headers: noStore });
  const object = await env.UPLOADS.get(source.replace(/^\/uploads\//, "")).catch(() => null);
  if (!object) return NextResponse.json({ error: "The picture couldn't be found." }, { status: 404, headers: noStore });

  try {
    const body = (await request.json().catch(() => ({}))) as { mode?: unknown };
    const mode: EnhanceMode = body.mode === "flat" ? "flat" : "tidy";
    const result = await enhancePicture(user.id, { bytes: new Uint8Array(await object.arrayBuffer()), type: object.httpMetadata?.contentType ?? "image/jpeg" }, mode, `${item.description}${item.color ? ` (color: ${item.color})` : ""}`.slice(0, 200));
    if (result.reused) await track(user.id, "enhance_reused");
    else if (!result.practice) {
      // The real cost when BFL says it, otherwise the set rate (recorded as an estimate).
      if (result.costMicros !== null) await track(user.id, "ai_cost_enhance", { costMicros: result.costMicros });
      else await track(user.id, "ai_cost_enhance_est", { costMicros: ENHANCE_MICROS });
    }
    return NextResponse.json({ image: result.imageDataUrl, practice: result.practice, reused: result.reused }, { headers: noStore });
  } catch (err) {
    if (err instanceof EnhanceError) return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS[err.code], headers: noStore });
    console.error("Enhancement failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Couldn't enhance this picture right now. Your picture is unchanged." }, { status: 500, headers: noStore });
  }
}

export async function PUT(request: Request, ctx: Ctx) {
  let user;
  try {
    user = await requireAdmin(request);
  } catch (res) {
    return asResponse(res);
  }
  const item = await loadItem(user.id, ctx);
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404, headers: noStore });
  const form = await request.formData().catch(() => null);
  const file = form?.get("picture");
  if (!(file instanceof File)) return NextResponse.json({ error: "No picture sent." }, { status: 400, headers: noStore });

  const plain = plainOf(item);
  // The enhanced file notes the true uploaded photo (a cut-out's own original, when the plain picture is a cut-out).
  const original = isCutout(plain) ? ((await cutoutOriginal(plain).catch(() => null)) ?? plain) : plain;
  let url: string;
  try {
    url = await saveEnhanced(original, file);
  } catch {
    return NextResponse.json({ error: "That picture couldn't be used." }, { status: 400, headers: noStore });
  }
  // Only if the piece is still as read above (two quick changes can't cross over).
  const { count } = await withRetry(() =>
    prisma.clothingItem.updateMany({ where: { id: item.id, imageUrl: item.imageUrl }, data: { plainUrl: plain, enhancedUrl: url, imageUrl: url } })
  );
  if (count === 0) {
    await env.UPLOADS.delete(url.replace(/^\/uploads\//, "")).catch(() => {});
    return NextResponse.json({ error: "This piece just changed. Please try again." }, { status: 409, headers: noStore });
  }
  // A replaced earlier enhancement isn't needed any more (its kept AI copy stays, so nothing is paid twice).
  if (item.enhancedUrl && item.enhancedUrl !== url) await env.UPLOADS.delete(item.enhancedUrl.replace(/^\/uploads\//, "")).catch(() => {});
  const updated = await prisma.clothingItem.findUnique({ where: { id: item.id } });
  return NextResponse.json({ item: updated }, { headers: noStore });
}

export async function PATCH(request: Request, ctx: Ctx) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const item = await loadItem(user.id, ctx);
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404, headers: noStore });
  const body = (await request.json().catch(() => ({}))) as { show?: unknown };
  if (body.show !== "enhanced" && body.show !== "original") return NextResponse.json({ error: "Choose a picture." }, { status: 400, headers: noStore });
  if (!item.enhancedUrl || !item.plainUrl) return NextResponse.json({ error: "This piece has no enhanced picture." }, { status: 409, headers: noStore });
  const next = body.show === "enhanced" ? item.enhancedUrl : item.plainUrl;
  if (next !== item.imageUrl) {
    await withRetry(() => prisma.clothingItem.updateMany({ where: { id: item.id, imageUrl: item.imageUrl }, data: { imageUrl: next } }));
  }
  const updated = await prisma.clothingItem.findUnique({ where: { id: item.id } });
  return NextResponse.json({ item: updated }, { headers: noStore });
}
