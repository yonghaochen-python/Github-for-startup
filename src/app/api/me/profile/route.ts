import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { cleanDisplayName } from "@/lib/displayName";

const noStore = { "cache-control": "private, no-store" };

/**
 * Updates the signed-in person's own profile. Only the display name can change here; the login email is never
 * editable, and any other field in the request is ignored.
 */
export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }
  const body = (await request.json().catch(() => ({}))) as { displayName?: unknown };
  const displayName = cleanDisplayName(body.displayName);
  if (displayName === undefined) {
    return NextResponse.json({ error: "Enter a name, or leave it empty." }, { status: 400, headers: noStore });
  }
  try {
    await prisma.user.update({ where: { id: user.id }, data: { displayName } });
    return NextResponse.json({ displayName }, { headers: noStore });
  } catch (err) {
    console.error("Failed to update name:", err);
    return NextResponse.json({ error: "Couldn't save your name. Please try again." }, { status: 500, headers: noStore });
  }
}
