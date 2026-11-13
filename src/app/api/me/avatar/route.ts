import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { avatarUrl, deleteAvatar, saveAvatar } from "@/lib/profiles";

const noStore = { "cache-control": "private, no-store" };

/** Your public profile picture: POST (form field "picture", a small square prepared on the device) or DELETE. */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("picture");
  if (!(file instanceof File)) return NextResponse.json({ error: "No picture sent." }, { status: 400, headers: noStore });
  try {
    return NextResponse.json({ avatarUrl: avatarUrl(await saveAvatar(user.id, file)) }, { headers: noStore });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save that picture." }, { status: 400, headers: noStore });
  }
}

export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  await deleteAvatar(user.id);
  return NextResponse.json({ avatarUrl: null }, { headers: noStore });
}
