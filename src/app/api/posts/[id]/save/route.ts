import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { setSaved } from "@/lib/posts";

/** 🔖: { saved: true | false } (Saved → Inspiration, private). */
export async function POST(request: Request, ctx: RouteContext<"/api/posts/[id]/save">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { saved?: unknown };
  if (typeof body.saved !== "boolean") return NextResponse.json({ error: "Say saved true or false." }, { status: 400 });
  if (!(await setSaved(user.id, id, body.saved))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ saved: body.saved });
}
