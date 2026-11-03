import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { MAX_PORTRAIT_BYTES, PORTRAIT_TYPES, deletePortrait, loadPortrait, savePortrait } from "@/lib/portrait";
import type { PortraitChecks } from "@/lib/studioModules";

const noStore = { "cache-control": "private, no-store" };

async function signedIn(request: Request) {
  try {
    return { user: await requireUser(request) };
  } catch (res) {
    return { res: asResponse(res) };
  }
}

/** The person's Studio portrait. Only its owner can read it; it's never cached publicly. */
export async function GET(request: Request) {
  const { user, res } = await signedIn(request);
  if (!user) return res;
  const portrait = await loadPortrait(user.id);
  if (!portrait) return new Response("Not found", { status: 404, headers: noStore });
  return new Response(new Blob([new Uint8Array(portrait.bytes)]), {
    headers: { ...noStore, "content-type": portrait.mediaType, "x-content-type-options": "nosniff" },
  });
}

/** The device's quality checks, if sensible (they only decide what the page says, never who can do what). */
function readChecks(raw: FormDataEntryValue | null): PortraitChecks | null {
  try {
    const c = JSON.parse(typeof raw === "string" ? raw : "") as PortraitChecks;
    const n = (v: unknown, max: number) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
    if (!n(c.width, 20000) || !n(c.height, 20000) || !n(c.brightness, 255) || !["clear", "small", "none", "unknown"].includes(c.face)) return null;
    return { width: Math.round(c.width), height: Math.round(c.height), brightness: Math.round(c.brightness), face: c.face };
  } catch {
    return null;
  }
}

/** Saves (or replaces) the portrait. Earlier reports stay; they remember which portrait they were made from. */
export async function PUT(request: Request) {
  const { user, res } = await signedIn(request);
  if (!user) return res;
  const formData = await request.formData().catch(() => null);
  const photo = formData?.get("photo");
  if (!(photo instanceof File) || !PORTRAIT_TYPES.includes(photo.type)) {
    return NextResponse.json({ error: "Please use a JPG, PNG, or WebP photo." }, { status: 400, headers: noStore });
  }
  if (photo.size > MAX_PORTRAIT_BYTES) {
    return NextResponse.json({ error: "That photo is too large. Please use one under 8MB." }, { status: 413, headers: noStore });
  }
  try {
    const info = await savePortrait(user.id, new Uint8Array(await photo.arrayBuffer()), photo.type, readChecks(formData?.get("checks") ?? null));
    return NextResponse.json({ portrait: info }, { headers: noStore });
  } catch (err) {
    console.error("Failed to save portrait:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Couldn't save your portrait right now. Please try again." }, { status: 500, headers: noStore });
  }
}

export async function DELETE(request: Request) {
  const { user, res } = await signedIn(request);
  if (!user) return res;
  await deletePortrait(user.id);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
