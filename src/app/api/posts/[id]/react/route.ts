import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { setReaction } from "@/lib/posts";

/** ❤️ / 👎: { kind: "like" | "dislike" | null }. A dislike is private (never counted or shown). */
export async function POST(request: Request, ctx: RouteContext<"/api/posts/[id]/react">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { kind?: unknown };
  const kind = body.kind === "like" || body.kind === "dislike" ? body.kind : body.kind === null ? null : undefined;
  if (kind === undefined) return NextResponse.json({ error: "Choose like, dislike or none." }, { status: 400 });
  const result = await setReaction(user.id, id, kind);
  if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
}
