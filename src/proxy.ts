import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Virm's address. */
const HOME_HOST = "virmstyle.com";
/** Older addresses that now send people to virmstyle.com. */
const OLD_HOSTS = new Set(["www.virmstyle.com", "virm-virtualmirror.yonghaochen.workers.dev"]);

/**
 * Pages opened at an older address (the workers.dev one, or www.) move to the same page on virmstyle.com, so links
 * people shared keep working. Only page visits move: requests to /api/ (Stripe's payment notifications, sign-in
 * callbacks, the app's own calls) are answered where they arrive, so nothing in flight breaks.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  if (!OLD_HOSTS.has(host)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/") || (request.method !== "GET" && request.method !== "HEAD")) return NextResponse.next();
  return NextResponse.redirect(`https://${HOME_HOST}${pathname}${search}`, 301);
}
