import { env } from "cloudflare:workers";

export async function GET(_request: Request, ctx: RouteContext<"/uploads/[key]">) {
  const { key } = await ctx.params;
  const object = await env.UPLOADS.get(key);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}
