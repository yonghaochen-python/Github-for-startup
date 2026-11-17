import { env } from "cloudflare:workers";
import { isPrivateStorageKey } from "@/lib/personalPhoto";
import { withRetry } from "@/lib/dbRetry";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request, ctx: RouteContext<"/uploads/[key]">) {
  const { key } = await ctx.params;
  // Saved try-on photos are only served to their owner, through /api/me/photo.
  if (isPrivateStorageKey(key)) return new Response("Not found", { status: 404, headers: noStore });

  // Post videos are played in parts (byte ranges), which iPhones need to play video at all.
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const head = await withRetry(() => env.UPLOADS.head(key)).catch(() => null);
    if (!head) return new Response("Not found", { status: 404, headers: noStore });
    const size = head.size;
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    const base = { "content-type": head.httpMetadata?.contentType ?? "application/octet-stream", "accept-ranges": "bytes", etag: head.httpEtag };
    if (start > end) return new Response(null, { status: 416, headers: { ...base, "content-range": `bytes */${size}` } });
    const part = await withRetry(() => env.UPLOADS.get(key, { range: { offset: start, length: end - start + 1 } })).catch(() => null);
    if (!part) return new Response("Try again", { status: 503, headers: { ...noStore, "retry-after": "2" } });
    return new Response(part.body, {
      status: 206,
      headers: {
        ...base,
        "cache-control": "public, max-age=31536000, immutable",
        "content-range": `bytes ${start}-${end}/${size}`,
        "content-length": String(end - start + 1),
      },
    });
  }

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
  headers.set("accept-ranges", "bytes");

  return new Response(object.body, { headers });
}
