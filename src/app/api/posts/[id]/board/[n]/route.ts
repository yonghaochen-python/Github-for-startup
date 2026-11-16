import { env } from "cloudflare:workers";
import { asResponse, requireUser } from "@/lib/auth";
import { getBoard } from "@/lib/posts";

const noStore = { "cache-control": "private, no-store" };

/** Only the person who posted it: one picture of the post's layout (kept privately). */
export async function GET(request: Request, ctx: RouteContext<"/api/posts/[id]/board/[n]">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const { id, n } = await ctx.params;
  const key = (await getBoard(id, user.id))?.keys[Number(n)];
  const object = key ? await env.UPLOADS.get(key).catch(() => null) : null;
  if (!object) return new Response("Not found", { status: 404, headers: noStore });
  const headers = new Headers(noStore);
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, no-store");
  return new Response(object.body, { headers });
}
