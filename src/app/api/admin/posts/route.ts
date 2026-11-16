import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { asResponse, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postStorageKeys } from "@/lib/posts";

const noStore = { "cache-control": "private, no-store" };

/** Admin: posts waiting for review (hidden by reports, or with open reports), with their reports. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (res) {
    return asResponse(res);
  }
  const posts = await prisma.post.findMany({
    where: { OR: [{ status: "hidden" }, { status: "published", reports: { some: { status: "open" } } }] },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      imageKey: true,
      caption: true,
      status: true,
      createdAt: true,
      user: { select: { username: true } },
      reports: { where: { status: "open" }, select: { reason: true, note: true, createdAt: true } },
    },
  });
  const [published, total] = await Promise.all([prisma.post.count({ where: { status: "published" } }), prisma.post.count()]);
  return NextResponse.json(
    {
      published,
      total,
      queue: posts.map((p) => ({ ...p, imageUrl: `/uploads/${p.imageKey}`, username: p.user.username, user: undefined, imageKey: undefined })),
    },
    { headers: noStore }
  );
}

/**
 * Admin review: restore (published again, reports dismissed), remove (taken down, its pictures deleted, reports
 * kept as actioned), or dismiss (reports closed, post untouched).
 */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
  } catch (res) {
    return asResponse(res);
  }
  const body = (await request.json().catch(() => ({}))) as { postId?: unknown; action?: unknown };
  const postId = typeof body.postId === "string" ? body.postId : "";
  const post = postId ? await prisma.post.findUnique({ where: { id: postId }, select: { imageKey: true, board: true, items: { select: { imageKey: true } } } }) : null;
  if (!post) return NextResponse.json({ error: "Not found." }, { status: 404, headers: noStore });
  const now = new Date();
  if (body.action === "restore" || body.action === "dismiss") {
    await prisma.postReport.updateMany({ where: { postId, status: "open" }, data: { status: "dismissed", reviewedAt: now } });
    if (body.action === "restore") await prisma.post.update({ where: { id: postId }, data: { status: "published" } });
  } else if (body.action === "remove") {
    await prisma.postReport.updateMany({ where: { postId, status: "open" }, data: { status: "actioned", reviewedAt: now } });
    await prisma.post.update({ where: { id: postId }, data: { status: "removed", board: null } });
    await env.UPLOADS.delete(postStorageKeys(post)).catch(() => {});
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400, headers: noStore });
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
