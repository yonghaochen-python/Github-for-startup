import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { storeShelves } from "@/lib/storeFeeds";

/** PREVIEW, admin only: real store shelves (see src/lib/storeFeeds.ts). Everyone else gets "not found". ?refresh=1 reads the stores again. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (res) {
    return res as Response;
  }
  return NextResponse.json({ stores: await storeShelves(new URL(request.url).searchParams.get("refresh") === "1") }, { headers: { "cache-control": "no-store" } });
}
