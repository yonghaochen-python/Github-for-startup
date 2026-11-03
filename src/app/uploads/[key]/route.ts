import { env } from "cloudflare:workers";
import { isPrivateStorageKey } from "@/lib/personalPhoto";
import { withRetry } from "@/lib/dbRetry";

const noStore = { "cache-control": "no-store" };

export async function GET(_request: Request, ctx: RouteContext<"/uploads/[key]">) {
  const { key } = await ctx.params;
  // Saved try-on photos are only served to their owner, through /api/me/photo.
  if (isPrivateStorageKey(key)) return new Response("Not found", { status: 404, headers: noStore });

  // Storage can stumble for a moment like the database: try again, and never let a failure look like a missing
  // photo that the browser remembers.
  let object: R2ObjectBody | null;
  try {
    object = await withRetry(() => env.UPLOADS.get(key));
  } catch (err) {
    console.error("Couldn't read a photo:", err instanceof Error ? err.message : err);
    return new Response("Try again", { status: 503, headers: { ...noStore, "retry-after": "2" } });
  }

  if (!object) {
    return new Response("Not found", { status: 404, headers: noStore });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}
