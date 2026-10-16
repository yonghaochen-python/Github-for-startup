import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { clearCurrentLook, loadCurrentLook } from "@/lib/personalPhoto";

const noStore = { "cache-control": "private, no-store" };

/** The signed-in person's current look (their latest try-on result). Owner-only, never cached publicly. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  const look = await loadCurrentLook(user.id);
  if (!look) return new Response("Not found", { status: 404, headers: noStore });
  return new Response(new Blob([new Uint8Array(look.bytes)]), {
    headers: { ...noStore, "content-type": look.mediaType, "x-content-type-options": "nosniff" },
  });
}

/** "Take off look": go back to showing the plain saved photo. */
export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  try {
    await clearCurrentLook(user.id);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    console.error("Failed to clear current look:", err);
    return NextResponse.json({ error: "Couldn't take off this look. Please try again." }, { status: 500, headers: noStore });
  }
}
