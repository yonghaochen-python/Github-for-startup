import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { ImportError, importProduct } from "@/lib/productImport";

const noStore = { "cache-control": "private, no-store" };
const STATUS = { invalid: 400, blocked: 422, unreachable: 422, "no-image": 422, "too-large": 413 } as const;

/** "Try on from any store": reads a product link's published details and picture (see lib/productImport). */
export async function POST(request: Request) {
  try {
    await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  const body = (await request.json().catch(() => ({}))) as { url?: unknown };
  if (typeof body.url !== "string" || body.url.length > 2048) {
    return NextResponse.json({ error: "Paste a product link." }, { status: 400, headers: noStore });
  }
  try {
    return NextResponse.json({ product: await importProduct(body.url) }, { headers: noStore });
  } catch (err) {
    if (err instanceof ImportError) return NextResponse.json({ error: err.message, reason: err.reason }, { status: STATUS[err.reason], headers: noStore });
    console.error("Product import failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Couldn't read that page. Upload a photo of the item instead." }, { status: 502, headers: noStore });
  }
}
